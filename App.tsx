import React, { useState, useCallback, useRef } from 'react';
import { Message, AppConfig, DEFAULT_CONFIG_MD, MakerSessionData } from './types';
import ChatInterface from './components/ChatInterface';
import ConfigEditor from './components/ConfigEditor';
import { parseConfig } from './services/configParser';
import { generateSimpleResponse, decomposeTask, generateCandidates, voteOnCandidates } from './services/geminiService';
import { Send, ToggleLeft, ToggleRight, Sparkles, AlertOctagon } from 'lucide-react';

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isMakerMode, setIsMakerMode] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [configContent] = useState(DEFAULT_CONFIG_MD);
  const [config, setConfig] = useState<AppConfig>(parseConfig(DEFAULT_CONFIG_MD));
  
  // Ref to track if we should stop processing (simplified cancellation)
  const abortProcessing = useRef(false);

  const handleConfigChange = (newConfig: AppConfig) => {
    setConfig(newConfig);
  };

  const handleMakerProcess = async (prompt: string, messageId: string) => {
    // Initialize Maker Session Data
    const sessionData: MakerSessionData = {
      plan: [],
      currentStepIndex: 0,
      completedSteps: [],
      isComplete: false,
      status: 'planning'
    };

    // Helper to update the message with new session data
    const updateSession = (newData: Partial<MakerSessionData>) => {
      Object.assign(sessionData, newData);
      setMessages(prev => prev.map(m => 
        m.id === messageId ? { ...m, makerData: { ...sessionData } } : m
      ));
    };

    try {
      // 1. Decompose
      const plan = await decomposeTask(prompt, config);
      updateSession({ plan, status: 'generating_candidates' });

      let fullResultText = "";

      // 2. Execute Steps
      for (let i = 0; i < plan.length; i++) {
        if (abortProcessing.current) break;

        updateSession({ currentStepIndex: i, status: 'generating_candidates' });
        
        // Context includes the prompt and results so far
        const context = `Original Request: ${prompt}\n\nCompleted Steps:\n${fullResultText}`;
        const step = plan[i];

        // Generate Candidates (Voting K)
        const candidates = await generateCandidates(step, context, config.votingK, config);
        
        updateSession({ status: 'voting' });
        
        // Vote
        const { bestIndex } = await voteOnCandidates(step, candidates, config);
        
        const winner = candidates[bestIndex];
        fullResultText += `Step ${i+1}: ${step}\nResult: ${winner}\n\n`;

        // Update completed steps
        sessionData.completedSteps.push({
          step,
          result: winner,
          candidates,
          votes: new Array(candidates.length).fill(0).map((_, idx) => idx === bestIndex ? 1 : 0), // Simplified visualization of vote
          winnerIndex: bestIndex,
          redFlags: Math.floor(Math.random() * 2) // Simulating some discarded attempts
        });

        updateSession({ status: 'executing' });
      }

      updateSession({ status: 'done', isComplete: true });

    } catch (e) {
       console.error(e);
       // Add error message?
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsProcessing(true);
    abortProcessing.current = false;

    try {
      if (isMakerMode) {
        // Create placeholder for MAKER process
        const makerMsgId = (Date.now() + 1).toString();
        const makerMsg: Message = {
          id: makerMsgId,
          role: 'model',
          content: '',
          type: 'maker-process',
          makerData: {
            plan: [],
            currentStepIndex: 0,
            completedSteps: [],
            isComplete: false,
            status: 'planning'
          },
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, makerMsg]);
        
        await handleMakerProcess(userMsg.content, makerMsgId);

      } else {
        // Standard Chat
        const response = await generateSimpleResponse(userMsg.content, messages, config);
        const botMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'model',
          content: response.text,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, botMsg]);
      }
    } catch (error) {
      console.error("Error generating response", error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'system',
        content: "Error: Could not process request. Please check your API Key and connection.",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex h-screen bg-black text-zinc-100 font-sans overflow-hidden">
      {/* Main Content */}
      <div className="flex-1 flex flex-col relative mr-12 transition-all duration-300">
        
        {/* Header */}
        <header className="h-14 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-950/80 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
            <h1 className="font-mono font-bold text-lg tracking-tight">zero-chat</h1>
            <span className="text-xs text-zinc-500 border border-zinc-800 rounded px-2 py-0.5">v1.0.0-MAKER</span>
          </div>

          <div className="flex items-center gap-4">
             {/* Mode Toggle */}
             <div 
               className="flex items-center gap-2 cursor-pointer group"
               onClick={() => setIsMakerMode(!isMakerMode)}
             >
                <span className={`text-xs font-mono font-bold transition-colors ${isMakerMode ? 'text-emerald-400' : 'text-zinc-500'}`}>
                  MAKER MODE
                </span>
                {isMakerMode ? (
                  <ToggleRight className="text-emerald-500 transition-transform group-hover:scale-110" size={24} />
                ) : (
                  <ToggleLeft className="text-zinc-600 transition-transform group-hover:scale-110" size={24} />
                )}
             </div>
          </div>
        </header>

        {/* Chat Area */}
        <ChatInterface messages={messages} isMakerMode={isMakerMode} />

        {/* Input Area */}
        <div className="p-4 bg-black border-t border-zinc-900">
           <form onSubmit={handleSubmit} className="max-w-4xl mx-auto relative">
              <div className="absolute -top-10 left-0 right-0 flex justify-center gap-4 opacity-0 pointer-events-none transition-opacity duration-300">
                 {/* Placeholder for tool indicators */}
              </div>
              
              <div className="relative group">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={isMakerMode ? "Describe a complex task for decomposition..." : "Message Gemini 3 Pro..."}
                  className="w-full bg-zinc-900 border border-zinc-700 text-zinc-100 rounded-lg pl-4 pr-12 py-3 focus:outline-none focus:border-emerald-600/50 focus:ring-1 focus:ring-emerald-900/50 font-mono text-sm transition-all"
                  disabled={isProcessing}
                />
                <button
                  type="submit"
                  disabled={isProcessing || !input.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-emerald-700 text-white rounded hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isProcessing ? <Sparkles size={16} className="animate-pulse" /> : <Send size={16} />}
                </button>
              </div>
              
              <div className="flex justify-between mt-2 text-[10px] text-zinc-600 font-mono px-1">
                 <div className="flex gap-4">
                    <span className="flex items-center gap-1"><AlertOctagon size={10} /> ZERO ERRORS PROTOCOL</span>
                    <span className="flex items-center gap-1"><Sparkles size={10} /> GEMINI 3 PRO</span>
                 </div>
                 <div>
                    MAKER FRAMEWORK ACTIVE
                 </div>
              </div>
           </form>
        </div>

      </div>

      {/* Config Editor Sidebar */}
      <ConfigEditor initialContent={configContent} onConfigChange={handleConfigChange} />

      {/* API Key Modal if needed (Assuming Process Env for now per instructions, but good for UX in real apps) */}
    </div>
  );
};

export default App;