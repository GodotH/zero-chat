import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Message, AppConfig, DEFAULT_CONFIG_MD, MakerSessionData, TokenUsage, Attachment } from './types';
import ChatInterface from './components/ChatInterface';
import ConfigEditor from './components/ConfigEditor';
import FilePreview from './components/FilePreview';
import Sidebar from './components/Sidebar';
import ErrorBoundary from './components/ErrorBoundary';
import { parseConfig } from './services/configParser';
import { generateSimpleResponse, decomposeTask, generateCandidates, voteOnCandidates } from './services/geminiService';
import { processFiles } from './services/fileHelpers';
import { Send, ToggleLeft, ToggleRight, Sparkles, AlertOctagon, StopCircle, Trash2, Coins, Paperclip, HardDrive, Menu, Skull } from 'lucide-react';

const App: React.FC = () => {
  // SESSION MANAGEMENT & ZOMBIE KILLER
  const [sessions, setSessions] = useState<{id: string, title: string, timestamp: number, messages: Message[]}[]>(() => {
    try {
      const saved = localStorage.getItem('zero-chat-sessions');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [currentSessionId, setCurrentSessionId] = useState<string>(() => {
    return localStorage.getItem('zero-chat-current-session') || '';
  });

  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      // Legacy single-history fallback
      if (!localStorage.getItem('zero-chat-current-session')) {
        const legacy = localStorage.getItem('zero-chat-history');
        if (legacy) {
          const parsed = JSON.parse(legacy);
          // SANITIZE ZOMBIES
          return parsed.map((m: Message) => {
             if (m.makerData && !m.makerData.isComplete && !m.makerData.isStopped) {
               return { ...m, makerData: { ...m.makerData, status: 'stopped' as const, isStopped: true }, content: m.content + "\n\n[SYSTEM: EXECUTION INTERRUPTED ON RELOAD]" };
             }
             return m;
          });
        }
      }
      return [];
    } catch (e) { return []; }
  });

  // State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
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

  // Initialize Session if none
  useEffect(() => {
    if (!currentSessionId) {
      createNewSession();
    } else {
      // Load selected session
      const session = sessions.find(s => s.id === currentSessionId);
      if (session) {
        // SANITIZE ZOMBIES ON LOAD
        const cleanMessages = session.messages.map(m => {
           if (m.makerData && !m.makerData.isComplete && !m.makerData.isStopped) {
             return { 
               ...m, 
               makerData: { ...m.makerData, status: 'stopped' as const, isStopped: true },
               content: m.content + "\n\n[SYSTEM: EXECUTION INTERRUPTED]" 
             };
           }
           return m;
        });
        setMessages(cleanMessages);
      }
    }
  }, [currentSessionId]);

  // Save Messages to Current Session
  useEffect(() => {
    if (!currentSessionId) return;
    
    setSessions(prev => {
      const updated = prev.map(s => 
        s.id === currentSessionId 
          ? { ...s, messages, title: s.messages.length === 0 ? 'New Chat' : s.title === 'New Chat' && messages[0] ? messages[0].content.substring(0, 30) : s.title } 
          : s
      );
      localStorage.setItem('zero-chat-sessions', JSON.stringify(updated));
      return updated;
    });
    localStorage.setItem('zero-chat-current-session', currentSessionId);
  }, [messages, currentSessionId]);

  // Calculate Cost
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

  const createNewSession = () => {
    const newId = Date.now().toString();
    const newSession = { id: newId, title: 'New Chat', timestamp: Date.now(), messages: [] };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newId);
    setMessages([]);
    setIsSidebarOpen(false); // Close sidebar on mobile when selecting new
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSessions = sessions.filter(s => s.id !== id);
    setSessions(newSessions);
    localStorage.setItem('zero-chat-sessions', JSON.stringify(newSessions));
    if (currentSessionId === id) {
      if (newSessions.length > 0) setCurrentSessionId(newSessions[0].id);
      else createNewSession();
    }
  };

  const selectSession = (id: string) => {
    setCurrentSessionId(id);
    setIsSidebarOpen(false);
  };

  const handleConfigChange = (newConfig: AppConfig) => {
    setConfig(newConfig);
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    // FORCE KILL STATE
    setIsProcessing(false);
    setMessages(prev => {
      const last = prev[prev.length - 1];
      if (last && last.role === 'model') {
         const updated = [...prev];
         updated[updated.length - 1] = {
           ...last,
           makerData: last.makerData ? { ...last.makerData, status: 'stopped' as const, isStopped: true } : undefined,
           content: last.makerData ? last.content : (last.content + " [STOPPED]")
         };
         return updated;
      }
      return prev;
    });
  };

  // Emergency Reset
  const forceReset = () => {
    if (confirm("Force reset active tasks? This fixes 'stuck' states.")) {
      handleStop();
      window.location.reload();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const { valid, errors } = await processFiles(e.target.files);
      setFiles(prev => [...prev, ...valid]);
      if (errors.length > 0) setUploadErrors(prev => [...prev, ...errors]);
    }
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
      const { plan, usage: planUsage } = await decomposeTask(prompt, config, attachments, signal);
      addUsage(planUsage);
      updateSession({ plan, status: 'generating_candidates' });

      let fullResultText = "";

      for (let i = 0; i < plan.length; i++) {
        if (signal.aborted) break;

        updateSession({ currentStepIndex: i, status: 'generating_candidates' });
        const context = `Original Request: ${prompt}\n\nCompleted Steps:\n${fullResultText}`;
        const step = plan[i];

        const { candidates, redFlagsCount, usage: genUsage } = await generateCandidates(step, context, attachments, config.votingK, config, signal);
        addUsage(genUsage);
        
        updateSession({ status: 'voting' });
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
         setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'system',
            content: `System Error: ${e.message}`,
            timestamp: Date.now()
         }]);
         updateSession({ status: 'stopped', isStopped: true });
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
    setUploadErrors([]);
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
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'system',
          content: "Error: Could not process request. " + error.message,
          timestamp: Date.now()
        }]);
      }
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <div className="flex h-[100dvh] bg-black text-zinc-100 font-sans overflow-hidden">
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/80 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed md:relative inset-y-0 left-0 z-50 w-72 bg-zinc-950 border-r border-zinc-900 transform transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <Sidebar 
          sessions={sessions} 
          currentId={currentSessionId} 
          onSelect={selectSession} 
          onNew={createNewSession}
          onDelete={deleteSession}
        />
      </div>

      <div className="flex-1 flex flex-col relative transition-all duration-300 h-full">
        
        <header className="h-14 shrink-0 border-b border-zinc-800 flex items-center justify-between px-4 bg-zinc-950/80 backdrop-blur">
          <div className="flex items-center gap-3">
            <button 
              className="md:hidden p-2 -ml-2 text-zinc-400 hover:text-white"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>
            <div className="w-3 h-3 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
            <h1 className="font-mono font-bold text-lg tracking-tight hidden sm:block">zero-chat</h1>
            <span className="text-[10px] text-zinc-500 border border-zinc-800 rounded px-1.5 py-0.5">v1.2.1</span>
          </div>

          <div className="flex items-center gap-3 sm:gap-6">
             <div className="flex items-center gap-2 px-3 py-1 rounded bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-400">
               <Coins size={14} className="text-yellow-500" />
               <span className="hidden sm:inline">${totalCost.toFixed(4)}</span>
             </div>

             <div className="flex items-center gap-2 sm:gap-4">
                <button 
                  onClick={forceReset}
                  className="p-2 bg-red-950/30 border border-red-900/50 hover:bg-red-900/50 text-red-500 rounded transition-colors"
                  title="Force Kill / Reset Tasks"
                >
                  <Skull size={16} />
                </button>

                <div className="h-6 w-px bg-zinc-800"></div>

                <div 
                  className="flex items-center gap-2 cursor-pointer group select-none"
                  onClick={() => setIsMakerMode(!isMakerMode)}
                >
                    <span className={`text-[10px] sm:text-xs font-mono font-bold transition-colors ${isMakerMode ? 'text-emerald-400' : 'text-zinc-500'}`}>
                      {isMakerMode ? 'MAKER' : 'CHAT'}
                    </span>
                    {isMakerMode ? (
                      <ToggleRight className="text-emerald-500" size={24} />
                    ) : (
                      <ToggleLeft className="text-zinc-600" size={24} />
                    )}
                </div>
             </div>
          </div>
        </header>

        <ErrorBoundary>
          <ChatInterface messages={messages} isMakerMode={isMakerMode} />
        </ErrorBoundary>

        <div className="p-3 sm:p-4 bg-black border-t border-zinc-900 shrink-0">
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
                  disabled={isProcessing}
                >
                   <Paperclip size={18} />
                </button>

                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={isMakerMode ? "Task or Analysis..." : "Message Gemini..."}
                    className="w-full h-full bg-zinc-900 border border-zinc-700 text-zinc-100 rounded-lg pl-4 pr-12 focus:outline-none focus:border-emerald-600/50 focus:ring-1 focus:ring-emerald-900/50 font-mono text-sm transition-all disabled:opacity-50"
                    disabled={isProcessing}
                  />
                  
                  {isProcessing ? (
                    <button
                      type="button"
                      onClick={handleStop}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-red-900/80 text-white rounded hover:bg-red-700 transition-colors animate-pulse"
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
                 </div>
                 <div className="hidden sm:block">
                    {isMakerMode ? 'MAKER ACTIVE' : 'STANDARD'}
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