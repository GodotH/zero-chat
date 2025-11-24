export interface Message {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  type?: 'text' | 'maker-process';
  makerData?: MakerSessionData;
  timestamp: number;
}

export interface MakerSessionData {
  plan: string[];
  currentStepIndex: number;
  completedSteps: {
    step: string;
    result: string;
    candidates: string[];
    votes: number[];
    winnerIndex: number;
    redFlags: number;
  }[];
  isComplete: boolean;
  status: 'planning' | 'generating_candidates' | 'voting' | 'executing' | 'done';
}

export interface AppConfig {
  modelName: string;
  votingK: number;
  maxSteps: number;
  temperature: number;
  enableTools: boolean;
  enableMcp: boolean;
  systemPrompt: string;
}

export const DEFAULT_CONFIG_MD = `# Zero-Chat Configuration

## Model Settings
Model: gemini-3-pro-preview
Temperature: 0.7
MaxOutputTokens: 8192

## MAKER Framework Settings
# "First-to-ahead-by-k" voting threshold
VotingK: 3
# Maximum steps for decomposition
MaxDecompositionSteps: 10
# Strictness for Red-Flagging (0.0 - 1.0)
RedFlagThreshold: 0.8

## Tools & Context
EnableBrowsing: true
EnableMCP: true

## System Prompt
You are Zero-Chat, an implementation of the MAKER framework. 
You solve complex problems by decomposing them into atomic subtasks 
and verifying each step to ensure zero errors.
`;