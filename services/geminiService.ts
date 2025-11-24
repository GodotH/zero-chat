import { GoogleGenAI, Tool, Type, Schema } from "@google/genai";
import { AppConfig, TokenUsage, Attachment } from '../types';

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key not found");
  return new GoogleGenAI({ apiKey });
};

// Pricing estimation (approximate for Pro tier)
const COST_PER_1M_INPUT = 1.25;
const COST_PER_1M_OUTPUT = 5.00;

const calculateUsage = (response: any): TokenUsage => {
  const promptTokens = response.usageMetadata?.promptTokenCount || 0;
  const outputTokens = response.usageMetadata?.candidatesTokenCount || 0;
  
  const inputCost = (promptTokens / 1_000_000) * COST_PER_1M_INPUT;
  const outputCost = (outputTokens / 1_000_000) * COST_PER_1M_OUTPUT;

  return {
    promptTokens,
    outputTokens,
    totalTokens: promptTokens + outputTokens,
    estimatedCost: inputCost + outputCost
  };
};

const formatContentsWithAttachments = (text: string, attachments: Attachment[] = [], role: string = 'user') => {
  const parts: any[] = [{ text }];
  
  attachments.forEach(att => {
    parts.push({
      inlineData: {
        mimeType: att.mimeType,
        data: att.data
      }
    });
  });

  return { role, parts };
};

export const generateSimpleResponse = async (
  prompt: string,
  history: { role: string; content: string; attachments?: Attachment[] }[],
  attachments: Attachment[],
  config: AppConfig,
  signal?: AbortSignal
) => {
  const ai = getClient();
  const tools: Tool[] = [];
  if (config.enableTools) {
    tools.push({ googleSearch: {} });
  }

  const contents = history.map(msg => {
    // For history, we mostly just care about text context to save tokens, 
    // but if we want full multimodal history, we'd reconstruct it here.
    // For now, let's keep history text-only to avoid massive token usage, 
    // unless it's the very last turn, but the current implementation sends text.
    // NOTE: Ideally, we should summarize images in history.
    return {
      role: msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    };
  });
  
  // Add current user message with attachments
  contents.push(formatContentsWithAttachments(prompt, attachments, 'user'));
  
  const response = await ai.models.generateContent({
    model: config.modelName,
    contents: contents,
    config: {
      temperature: config.temperature,
      systemInstruction: config.systemPrompt,
      tools: tools.length > 0 ? tools : undefined,
    }
  });

  if (signal?.aborted) throw new Error("Request aborted");

  return {
    text: response.text || "No response generated.",
    groundingMetadata: response.candidates?.[0]?.groundingMetadata,
    usage: calculateUsage(response)
  };
};

/**
 * RED FLAGGING LOGIC
 * Detects signs of unreliability in model output
 */
const checkRedFlags = (text: string): boolean => {
  if (!text) return true;
  // 1. Length Heuristic: Answers that are too verbose for atomic steps often indicate confusion
  if (text.length > 2000) return true;
  
  // 2. Refusal/Confusion Patterns
  const failurePatterns = [
    "I cannot", "I am unable", "I'm sorry", "as an AI", 
    "I don't have access", "cannot execute", "I cant"
  ];
  if (failurePatterns.some(p => text.toLowerCase().includes(p))) return true;

  // 3. Formatting check is implicit in JSON parsing phases, but for raw text steps:
  return false;
};

export const decomposeTask = async (
  task: string, 
  config: AppConfig, 
  attachments: Attachment[] = [],
  signal?: AbortSignal
) => {
  const ai = getClient();
  
  const userMessage = formatContentsWithAttachments(
    `Task: ${task}\n\nDecompose this task into a sequential list of atomic, execution-ready subtasks. Return a JSON array of strings.`,
    attachments
  );

  const response = await ai.models.generateContent({
    model: config.modelName,
    contents: [userMessage],
    config: { 
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    }
  });

  if (signal?.aborted) throw new Error("Request aborted");

  const usage = calculateUsage(response);

  try {
    const text = response.text || "[]";
    const plan = JSON.parse(text) as string[];
    return { plan, usage };
  } catch (e) {
    console.error("Failed to parse decomposition", e);
    return { plan: [task], usage };
  }
};

export const generateCandidates = async (
  step: string, 
  context: string, 
  attachments: Attachment[] = [],
  count: number, 
  config: AppConfig,
  signal?: AbortSignal
) => {
  const ai = getClient();
  const candidates: string[] = [];
  let totalUsage: TokenUsage = { promptTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0 };
  let redFlagsCount = 0;

  // We loop to generate 'count' valid candidates, retrying if red flags occur
  let attempts = 0;
  const maxAttempts = count * 3; // Allow more retries

  while (candidates.length < count && attempts < maxAttempts) {
    if (signal?.aborted) throw new Error("Request aborted");
    attempts++;

    // High temperature for diversity in sampling
    const temp = 0.7 + (Math.random() * 0.3); 

    const userMessage = formatContentsWithAttachments(
      `Context so far:\n${context}\n\nCurrent Step To Execute: ${step}\n\nProvide the result of this step ONLY. Be concise and precise. Do not explain.`,
      attachments
    );

    const response = await ai.models.generateContent({
      model: config.modelName,
      contents: [userMessage],
      config: { temperature: temp }
    });

    const currentUsage = calculateUsage(response);
    totalUsage.promptTokens += currentUsage.promptTokens;
    totalUsage.outputTokens += currentUsage.outputTokens;
    totalUsage.totalTokens += currentUsage.totalTokens;
    totalUsage.estimatedCost += currentUsage.estimatedCost;

    const text = response.text || "";

    if (checkRedFlags(text)) {
      redFlagsCount++;
      continue; // Discard
    }

    candidates.push(text);
  }

  if (candidates.length === 0) candidates.push("Error: Could not generate valid candidate after multiple attempts.");

  return { candidates, redFlagsCount, usage: totalUsage };
};

export const voteOnCandidates = async (
  step: string,
  candidates: string[],
  config: AppConfig,
  signal?: AbortSignal
) => {
  const ai = getClient();

  const candidatesFormatted = candidates.map((c, i) => `Option ${i}: ${c.substring(0, 1000)}`).join('\n---\n');

  const votingPrompt = `
    You are a judge in a zero-error system.
    Step: "${step}"
    
    Candidates:
    ${candidatesFormatted}
    
    Select the index (0-${candidates.length - 1}) of the most accurate, error-free result.
  `;

  const response = await ai.models.generateContent({
    model: config.modelName,
    contents: [{ role: 'user', parts: [{ text: votingPrompt }] }],
    config: { 
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          bestIndex: { type: Type.INTEGER },
          reason: { type: Type.STRING }
        },
        required: ["bestIndex", "reason"]
      }
    }
  });

  if (signal?.aborted) throw new Error("Request aborted");

  const usage = calculateUsage(response);

  try {
    const json = JSON.parse(response.text || "{}");
    // Validate index range
    let bestIndex = typeof json.bestIndex === 'number' ? json.bestIndex : 0;
    if (bestIndex < 0 || bestIndex >= candidates.length) bestIndex = 0;
    
    return {
      bestIndex,
      reason: json.reason || "Selected by judge",
      usage
    };
  } catch (e) {
    console.error("Voting parse error", e);
    return { bestIndex: 0, reason: "Fallback due to parse error", usage };
  }
};