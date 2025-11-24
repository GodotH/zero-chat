import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Message, AppConfig, DEFAULT_CONFIG_MD, MakerSessionData, TokenUsage, Attachment } from './types';
import ChatInterface from './components/ChatInterface';
import ConfigEditor from './components/ConfigEditor';
import FilePreview from './components/FilePreview';
import { parseConfig } from './services/configParser';
import { generateSimpleResponse, decomposeTask, generateCandidates, voteOnCandidates } from './services/geminiService';
import { processFiles } from './services/fileHelpers';
import { Send, ToggleLeft, ToggleRight, Sparkles, AlertOctagon, StopCircle, Trash2, Coins, Paperclip, HardDrive } from 'lucide-react';

const App: React.FC = () => {
  // Load from local storage or default
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('zero-chat-history');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<Attachment[]>([]);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [isMakerMode, setIsMakerMode] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [configContent] = useState(DEFAULT_CONFIG_MD);
  const [config, setConfig] = useState<AppConfig>(parseConfig(DEFAULT_CONFIG_MD));
  const [totalCost, setTotalCost] = useState(0);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persistence Effect
  useEffect(() => {
    localStorage.setItem('zero-chat-history', JSON.stringify(messages));
  }, [messages]);

  // Recalculate total cost on load
  useEffect(() => {
    const cost = messages.reduce((acc, msg) => {
      let msgCost = msg.usage?.estimatedCost || 0;
      if (msg.type === 'maker-process' && msg.makerData?.totalUsage) {
        msgCost = msg.makerData.totalUsage.estimatedCost;
      }
      return acc + msgCost;
    }, 0);
    setTotalCost(cost);
  }, [messages]);

  const handleConfigChange = (newConfig: AppConfig) => {
    setConfig(newConfig);
  };

  const clearHistory = () => {
    if (window.confirm("Clear chat history?")) {
      setMessages([]);
      localStorage.removeItem('zero-chat-history');
      setTotalCost(0);
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsProcessing(false);
      
      // Mark last message as stopped if it exists
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'model') {
           const updated = [...prev];
           updated[updated.length - 1] = {
             ...last,
             makerData: last.makerData ? { ...last.makerData, status: 'stopped', isStopped: true } : undefined,
             content: last.makerData ? last.content : last.content + " [STOPPED]"
           };
           return updated;
        }
        return prev;
      });
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const { valid, errors } = await processFiles(e.target.files);
      
      setFiles(prev => [...prev, ...valid]);
      if (errors.length > 0) {
        setUploadErrors(prev => [...prev, ...errors]);
      }
    }
    // Reset input to allow selecting same file again if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeError = (index: number) => {
    setUploadErrors(prev => prev.filter((_, i) => i !== index));
  };

  const handleMakerProcess = async (prompt: string, attachments: Attachment[], messageId: string) => {
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    const sessionData: MakerSessionData = {
      plan: [],
      currentStepIndex: 0,
      completedSteps: [],
      isComplete: false,
      status: 'planning',
      totalUsage: { promptTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0 }
    };

    const updateSession = (newData: Partial<MakerSessionData>) => {
      Object.assign(sessionData, newData);
      setMessages(prev => prev.map(m => 
        m.id === messageId ? { ...m, makerData: { ...sessionData } } : m
      ));
    };

    const addUsage = (u: TokenUsage) => {
      if (!sessionData.totalUsage) return;
      sessionData.totalUsage.promptTokens += u.promptTokens;
      sessionData.totalUsage.outputTokens += u.outputTokens;
      sessionData.totalUsage.totalTokens += u.totalTokens;
      sessionData.totalUsage.estimatedCost += u.estimatedCost;
      setTotalCost(prev => prev + u.estimatedCost);
    };

    try {
      // 1. Decompose (with attachments)
      const { plan, usage: planUsage } = await decomposeTask(prompt, config, attachments, signal);
      addUsage(planUsage);
      updateSession({ plan, status: 'generating_candidates' });

      let fullResultText = "";

      // 2. Execute Steps
      for (let i = 0; i < plan.length; i++) {
        if (signal.aborted) break;

        updateSession({ currentStepIndex: i, status: 'generating_candidates' });
        
        const context = `Original Request: ${prompt}\n\nCompleted Steps:\n${fullResultText}`;
        const step = plan[i];

        // Generate Candidates (passing attachments here too, in case steps require checking the doc)
        const { candidates, redFlagsCount, usage: genUsage } = await generateCandidates(step, context, attachments, config.votingK, config, signal);
        addUsage(genUsage);
        
        updateSession({ status: 'voting' });
        
        // Vote
        const { bestIndex, usage: voteUsage } = await voteOnCandidates(step, candidates, config, signal);
        addUsage(voteUsage);
        
        const winner = candidates[bestIndex];
        fullResultText += `Step ${i+1}: ${step}\nResult: ${winner}\n\n`;

        sessionData.completedSteps.push({
          step,
          result: winner,
          candidates,
          votes: new Array(candidates.length).fill(0).map((_, idx) => idx === bestIndex ? 1 : 0),
          winnerIndex: bestIndex,
          redFlags: redFlagsCount,
          usage: { 
            promptTokens: genUsage.promptTokens + voteUsage.promptTokens,
            outputTokens: genUsage.outputTokens + voteUsage.outputTokens,
            totalTokens: genUsage.totalTokens + voteUsage.totalTokens,
            estimatedCost: genUsage.estimatedCost + voteUsage.estimatedCost
          }
        });

        updateSession({ status: 'executing' });
      }

      if (!signal.aborted) {
        updateSession({ status: 'done', isComplete: true });
      } else {
        updateSession({ status: 'stopped', isStopped: true });
      }

    } catch (e: any) {
       if (e.message === "Request aborted") {
         updateSession({ status: 'stopped', isStopped: true });
       } else {
         console.error(e);
       }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && files.length === 0) || isProcessing) return;

    abortControllerRef.current = new AbortController();

    const currentFiles = [...files];
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      attachments: currentFiles,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setFiles([]);
    setUploadErrors([]); // Clear errors on submit
    setIsProcessing(true);

    try {
      if (isMakerMode) {
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
        await handleMakerProcess(userMsg.content, currentFiles, makerMsgId);

      } else {
        const response = await generateSimpleResponse(userMsg.content, messages, currentFiles, config, abortControllerRef.current.signal);
        setTotalCost(prev => prev + (response.usage?.estimatedCost || 0));
        
        const botMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'model',
          content: response.text,
          timestamp: Date.now(),
          usage: response.usage
        };
        setMessages(prev => [...prev, botMsg]);
      }
    } catch (error: any) {
      if (error.message !== "Request aborted") {
        console.error("Error generating response", error);
        const errorMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'system',
          content: "Error: Could not process request.",
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, errorMsg]);
      }
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <div className="flex h-screen bg-black text-zinc-100 font-sans overflow-hidden">
      <div className="flex-1 flex flex-col relative mr-12 transition-all duration-300">
        
        <header className="h-14 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-950/80 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
            <h1 className="font-mono font-bold text-lg tracking-tight">zero-chat</h1>
            <span className="text-xs text-zinc-500 border border-zinc-800 rounded px-2 py-0.5">v1.2.0-FILES</span>
          </div>

          <div className="flex items-center gap-6">
             <div className="flex items-center gap-2 px-3 py-1 rounded bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-400">
               <Coins size={14} className="text-yellow-500" />
               <span>${totalCost.toFixed(4)}</span>
             </div>

             <div className="flex items-center gap-3">
                <button 
                  onClick={clearHistory}
                  className="p-2 hover:bg-red-900/20 text-zinc-500 hover:text-red-400 rounded transition-colors"
                  title="Clear History"
                >
                  <Trash2 size={18} />
                </button>

                <div className="h-6 w-px bg-zinc-800"></div>

                <div 
                  className="flex items-center gap-2 cursor-pointer group select-none"
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
          </div>
        </header>

        <ChatInterface messages={messages} isMakerMode={isMakerMode} />

        <div className="p-4 bg-black border-t border-zinc-900">
           <form onSubmit={handleSubmit} className="max-w-4xl mx-auto relative">
              <FilePreview 
                files={files} 
                errors={uploadErrors}
                onRemove={removeFile} 
                onRemoveError={removeError}
              />
              
              <div className="relative group flex gap-2">
                <input 
                  type="file" 
                  ref={fileInputRef}
                  className="hidden" 
                  multiple 
                  onChange={handleFileSelect}
                />
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 bg-zinc-900 border border-zinc-700 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-emerald-500 transition-colors"
                  title="Attach File"
                  disabled={isProcessing}
                >
                   <Paperclip size={18} />
                </button>

                <button 
                  type="button"
                  className="p-3 bg-zinc-900 border border-zinc-700 rounded-lg hover:bg-zinc-800 text-zinc-600 hover:text-zinc-400 transition-colors cursor-not-allowed opacity-50"
                  title="Google Drive (Coming Soon)"
                  disabled={true}
                >
                   <HardDrive size={18} />
                </button>

                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={isMakerMode ? "Describe a complex task or analyze attached file..." : "Message Gemini 3 Pro..."}
                    className="w-full h-full bg-zinc-900 border border-zinc-700 text-zinc-100 rounded-lg pl-4 pr-12 focus:outline-none focus:border-emerald-600/50 focus:ring-1 focus:ring-emerald-900/50 font-mono text-sm transition-all disabled:opacity-50"
                    disabled={isProcessing}
                  />
                  
                  {isProcessing ? (
                    <button
                      type="button"
                      onClick={handleStop}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-red-900/80 text-white rounded hover:bg-red-700 transition-colors animate-pulse"
                      title="Stop Generation"
                    >
                      <StopCircle size={16} />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!input.trim() && files.length === 0}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-emerald-700 text-white rounded hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Send size={16} />
                    </button>
                  )}
                </div>
              </div>
              
              <div className="flex justify-between mt-2 text-[10px] text-zinc-600 font-mono px-1">
                 <div className="flex gap-4">
                    <span className="flex items-center gap-1"><AlertOctagon size={10} /> ZERO ERROR PROTOCOL</span>
                    <span className="flex items-center gap-1"><Sparkles size={10} /> GEMINI 3 PRO</span>
                 </div>
                 <div>
                    {isMakerMode ? 'MAKER FRAMEWORK ACTIVE' : 'STANDARD CHAT'}
                 </div>
              </div>
           </form>
        </div>

      </div>

      <ConfigEditor initialContent={configContent} onConfigChange={handleConfigChange} />
    </div>
  );
};

export default App;