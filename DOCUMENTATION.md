# Zero-Chat: MAKER Framework Implementation
> v1.2.0-FILES

## 1. Executive Summary
Zero-Chat is a high-precision chat interface implementing the **MAKER framework** (Massively Decomposed Agentic Processes). Unlike standard LLM chat interfaces that rely on a single inference pass, Zero-Chat decomposes complex tasks into atomic subtasks, executes them independently, generates multiple candidate solutions for each step, and uses a voting mechanism to ensure zero-error progression.

This project uses **Google Gemini 3 Pro** (via the `gemini-3-pro-preview` model) as the reasoning engine, leveraging its large context window and high reasoning capability to manage the decomposition and voting overhead.

## 2. Product Requirements Document (PRD)

### 2.1 Core Objectives
- **Zero Error**: Minimize hallucination and logic errors in multi-step tasks.
- **Observability**: Provide the user with a visual understanding of the "thinking" process (Plans, Votes, Red Flags).
- **Multimodality**: Support analysis of documents and images within the rigorous verification pipeline.
- **Control**: Allow users to intervene (Stop) to prevent token wastage.

### 2.2 Feature Specifications
| Feature | Description | Status |
| :--- | :--- | :--- |
| **Maker Mode** | Toggle between Standard Chat and MAKER Agent. | ✅ Implemented |
| **Decomposition** | Breaks prompts into a JSON plan of atomic steps. | ✅ Implemented |
| **Multimodal Inputs** | Upload images, PDFs, and text files for analysis. | ✅ Implemented |
| **Red Flagging** | Detects and discards low-quality responses (e.g., refusals, excessive length) before voting. | ✅ Implemented |
| **Voting** | Generates $K$ candidates per step and uses a Judge LLM to select the winner. | ✅ Implemented |
| **Cost Tracking** | Real-time session cost display based on token usage metadata. | ✅ Implemented |
| **Persistence** | Auto-save chat history to LocalStorage. | ✅ Implemented |
| **Stop Mechanism** | Abort functionality to kill long-running loops. | ✅ Implemented |

## 3. Architecture & Code Structure

### 3.1 Tech Stack
- **Framework**: React 19 (ES Modules via CDN).
- **Styling**: Tailwind CSS + Lucide Icons.
- **AI**: Google GenAI SDK (v1.30.0).
- **Server**: Lightweight Node.js server for static serving and on-the-fly TypeScript transpilation.
- **State Management**: React `useState` / `useRef` + LocalStorage.

### 3.2 Key Components
- **`App.tsx`**: Central controller. Manages the chat loop, state (MakerSessionData), file uploads, and AbortController.
- **`services/geminiService.ts`**:
  - `decomposeTask`: Uses `responseSchema` to strictly enforce JSON array output.
  - `generateCandidates`: Parallelized generation loop with temperature jitter (0.7 - 1.0). Implements Red Flagging.
  - `voteOnCandidates`: Uses a "Judge" pattern with `responseSchema` to select the best candidate index.
  - Handles `inlineData` injection for base64 file attachments.
- **`services/fileHelpers.ts`**: Handles client-side file validation and Base64 conversion.
- **`components/MakerVisualizer.tsx`**: A complex UI component that visualizes the MAKER state machine, showing the decomposition tree, active step status, and voting bar charts.

## 4. MAKER Paper Implementation Verification

The implementation largely follows the **MAKER (Maximal Agentic Decomposition)** framework described in recent literature, with specific practical adaptations for a real-time web interface.

### 4.1 Decomposition (MAD)
- **Paper**: Decompose into "minimal subtasks".
- **Implementation**: We use a specific prompt strategy in `decomposeTask` to force the model to output a linear JSON plan.
- **Verdict**: **Accurate**.

### 4.2 Error Correction (Voting)
- **Paper**: Mentions "First-to-ahead-by-k". This implies a sequential sampling process where sampling continues until one candidate (or semantic group of candidates) leads the runner-up by $K$ votes.
- **Implementation**: We use a **"Generate K, Judge Best"** approach.
  - We generate $K$ candidates immediately (parallelizable).
  - We use a discriminator (Judge) to pick the winner from the set.
- **Analysis**: While the paper's method is statistically more robust for infinite sampling, the "Judge" approach is more cost-effective and faster for a UI-based chat application while still providing significant error reduction over single-shot inference.
- **Deviation**: Use of a Judge LLM instead of pure frequency counting. This is necessary because exact string matching rarely works for open-ended text tasks.

### 4.3 Red-Flagging
- **Paper**: Discard responses that show signs of unreliability (formatting errors, excessive length).
- **Implementation**:
  - **Length Check**: `checkRedFlags` in `geminiService.ts` discards atomic step answers > 2000 chars.
  - **Pattern Check**: Discards refusals ("I cannot", "I am unable").
- **Verdict**: **Accurate**.

## 5. Potential Improvements

1. **Multi-Model Orchestration**: 
   - Configure different models for different roles.
   - *Example*: Use `gemini-2.5-flash` for high-volume candidate generation (cheaper/faster) and `gemini-3-pro` for the "Judge" and "Decomposer" roles (higher intelligence).
   
2. **OpenRouter / OpenAI Compatible Support**:
   - Abstract the API layer to support OpenRouter.
   - Allows access to Claude 3.5 Sonnet, DeepSeek R1, or o3-mini as alternative reasoning engines within the MAKER framework.

3. **Semantic Grouping**: 
   - Instead of asking the Judge to pick an index, embed candidates and cluster them. If a cluster has > 50% density, auto-select it.

4. **Branching Plans**: 
   - The current decomposition is linear. Complex tasks often require DAGs (Directed Acyclic Graphs).

5. **Tool Integration**: 
   - Integrate tools (Search, Code Execution) into the *atomic steps* of the MAKER process (Research Agents).

6. **Streaming**: 
   - Stream the text of the *winning* candidate to improve perceived latency.

## 6. Security Note
API Key management is strictly handled via `process.env.API_KEY` to comply with security best practices. No user-facing input for keys is permitted.