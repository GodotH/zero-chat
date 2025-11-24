import { GoogleGenAI, Tool } from "@google/genai";
import { AppConfig } from '../types';

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key not found");
  return new GoogleGenAI({ apiKey });
};

export const generateSimpleResponse = async (
  prompt: string,
  history: { role: string; content: string }[],
  config: AppConfig
) => {
  const ai = getClient();
  const tools: Tool[] = [];
  if (config.enableTools) {
    tools.push({ googleSearch: {} });
  }

  // Map history to API format
  // Note: Simple chat without full MAKER process
  const contents = history.map(msg => ({
    role: msg.role === 'model' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));
  
  // Add current prompt
  contents.push({
    role: 'user',
    parts: [{ text: prompt }]
  });

  const response = await ai.models.generateContent({
    model: config.modelName,
    contents: contents,
    config: {
      temperature: config.temperature,
      systemInstruction: config.systemPrompt,
      tools: tools.length > 0 ? tools : undefined,
    }
  });

  return {
    text: response.text || "No response generated.",
    groundingMetadata: response.candidates?.[0]?.groundingMetadata
  };
};

/**
 * MAKER FRAMEWORK IMPLEMENTATION
 * 1. Decomposition
 * 2. Voting/Generation of candidates
 * 3. Selection
 */

export const decomposeTask = async (task: string, config: AppConfig) => {
  const ai = getClient();
  // We use a specialized prompt to force decomposition
  const decompositionPrompt = `
    Task: ${task}
    
    Decompose this task into a sequential list of atomic, execution-ready subtasks. 
    Do not output any explanation. Output ONLY a JSON array of strings, where each string is a step.
    Example: ["Find the current stock price of AAPL", "Compare it to the 50-day moving average", "Generate a buy/sell recommendation"]
  `;

  const response = await ai.models.generateContent({
    model: config.modelName, // Ideally use a reasoning model like gemini-3-pro-preview
    contents: [{ role: 'user', parts: [{ text: decompositionPrompt }] }],
    config: { responseMimeType: 'application/json' }
  });

  try {
    const text = response.text || "[]";
    return JSON.parse(text) as string[];
  } catch (e) {
    console.error("Failed to parse decomposition", e);
    return [task]; // Fallback to single step
  }
};

export const generateCandidates = async (
  step: string, 
  context: string, 
  count: number, 
  config: AppConfig
) => {
  const ai = getClient();
  const promises = [];
  
  for (let i = 0; i < count; i++) {
    // We add slight variation to temperature to encourage diversity for voting
    const temp = 0.7 + (i * 0.1); 
    
    promises.push(ai.models.generateContent({
      model: config.modelName,
      contents: [
        { role: 'user', parts: [{ text: `Context so far:\n${context}\n\nCurrent Step: ${step}\n\nExecute this step. Be concise and precise.` }] }
      ],
      config: {
        temperature: Math.min(temp, 1.0), 
      }
    }));
  }

  const results = await Promise.all(promises);
  return results.map(r => r.text || "");
};

export const voteOnCandidates = async (
  step: string,
  candidates: string[],
  config: AppConfig
) => {
  const ai = getClient();
  // Using the model as a discriminator/judge
  const votingPrompt = `
    I need to evaluate the best response for the step: "${step}".
    
    Candidates:
    ${candidates.map((c, i) => `Candidate ${i}:\n${c}\n---`).join('\n')}
    
    Analyze these candidates for correctness, completeness, and adherence to the step.
    Select the index (0-${candidates.length - 1}) of the best candidate.
    
    Output JSON: { "bestIndex": number, "reason": string }
  `;

  const response = await ai.models.generateContent({
    model: config.modelName,
    contents: [{ role: 'user', parts: [{ text: votingPrompt }] }],
    config: { responseMimeType: 'application/json' }
  });

  try {
    const json = JSON.parse(response.text || "{}");
    return {
      bestIndex: typeof json.bestIndex === 'number' ? json.bestIndex : 0,
      reason: json.reason
    };
  } catch (e) {
    return { bestIndex: 0, reason: "Fallback due to parsing error" };
  }
};