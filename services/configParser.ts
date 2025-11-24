import { AppConfig } from '../types';

export const parseConfig = (mdContent: string): AppConfig => {
  const config: AppConfig = {
    modelName: 'gemini-3-pro-preview',
    votingK: 3,
    maxSteps: 10,
    temperature: 0.7,
    enableTools: true,
    enableMcp: true,
    systemPrompt: 'You are Zero-Chat.',
  };

  const lines = mdContent.split('\n');
  let currentSection = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) {
      continue; // Skip comments and headers for basic parsing logic simplified
    }
    
    // Simple key-value parsing
    if (trimmed.includes(':')) {
      const [key, ...values] = trimmed.split(':');
      const value = values.join(':').trim();
      const lowerKey = key.trim().toLowerCase();

      if (lowerKey === 'model') config.modelName = value;
      else if (lowerKey === 'votingk') config.votingK = parseInt(value, 10) || 3;
      else if (lowerKey === 'maxdecompositionsteps') config.maxSteps = parseInt(value, 10) || 10;
      else if (lowerKey === 'temperature') config.temperature = parseFloat(value) || 0.7;
      else if (lowerKey === 'enablebrowsing') config.enableTools = value.toLowerCase() === 'true';
      else if (lowerKey === 'enablemcp') config.enableMcp = value.toLowerCase() === 'true';
    }
  }
  
  // Extract system prompt (heuristic: everything after "System Prompt" header if we were doing robust parsing, 
  // but for now let's just use a fixed extraction or the default if complex)
  // Re-implementing a simple block extractor for System Prompt
  const sysPromptMatch = mdContent.match(/## System Prompt\n([\s\S]*?)$/);
  if (sysPromptMatch) {
    config.systemPrompt = sysPromptMatch[1].trim();
  }

  return config;
};