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
  // --- STATE INITIALIZATION ---
  
  // 1. Sessions (Lazy load from LS)
  const [sessions, setSessions] = useState<{id: string, title: string, timestamp: number, messages: Message[]}[]>(() => {
    try {
      const saved = localStorage.getItem('zero-chat-sessions');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  // 2. Current Session ID (Lazy load)
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => {
    return localStorage.getItem('zero-chat-current-session') || '';
  });

  // 3. Messages (CRITICAL FIX: Load immediately from sessions based on ID)
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const currentId = localStorage.getItem('zero-chat-current-session');
      if (currentId) {
        const savedSessionsRaw = localStorage.getItem('zero-chat-sessions');
        const savedSessions = savedSessionsRaw ? JSON.parse(savedSessionsRaw) : [];
        const activeSession = savedSessions.find((s: any) => s.id === currentId);
        
        if (activeSession) {
          // Zombie sanitization on boot
          return activeSession.messages.map((m: Message) => {
             if (m.makerData && !m.makerData.isComplete && !m.makerData.isStopped) {
               return { 
                 ...m, 
                 makerData: { ...m.makerData, status: 'stopped' as const, isStopped: true },
                 content: m.content + "\n\n[SYSTEM: EXECUTION INTERRUPTED ON RELOAD]" 
               };
             }
             return m;
          });
        }
      }
      return [];
    } catch (e) { return []; }
  });

  // UI State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true); // Default to Collapsed
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  
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

  // --- EFFECTS ---

  // Initialize Session if absolutely none exist
  useEffect(() => {
    if (!currentSessionId && sessions.length === 0) {
      createNewSession();
    }
  }, []);

  // Sync Messages -> Sessions -> LocalStorage
  const saveMessagesToSession = (newMessages: Message[]) => {
    setMessages(newMessages); // Update UI
    
    setSessions(prevSessions => {
      const updatedSessions = prevSessions.map(s => {
        if (s.id === currentSessionId) {
          // Auto-title logic
          const newTitle = s.messages.length === 0 && newMessages.length > 0
            ? newMessages[0].content.substring(0, 30) || "Image Analysis"
            : s.title === 'New Chat' && newMessages.length > 0 
              ? newMessages[0].content.substring(0, 30) 
              : s.title;
          
          return { ...s, messages: newMessages, title: newTitle };
        }
        return s;
      });
      
      localStorage.setItem('zero-chat-sessions', JSON.stringify(updatedSessions));
      return updatedSessions;
    });
  };

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

  // --- ACTIONS ---

  const createNewSession = () => {
    const newId = Date.now().toString();
    const newSession = { id: newId, title: 'New Chat', timestamp: Date.now(), messages: [] };
    
    setSessions(prev => {
      const updated = [newSession, ...prev];
      localStorage.setItem('zero-chat-sessions', JSON.stringify(updated));
      return updated;
    });
    setCurrentSessionId(newId);
    localStorage.setItem('zero-chat-current-session', newId);
    setMessages([]);
    setIsMobileMenuOpen(false); 
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSessions = sessions.filter(s => s.id !== id);
    setSessions(newSessions);
    localStorage.setItem('zero-chat-sessions', JSON.stringify(newSessions));
    
    if (currentSessionId === id) {
      if (newSessions.length > 0) {
        selectSession(newSessions[0].id);
      } else {
        setMessages([]);
        setCurrentSessionId('');
        localStorage.removeItem('zero-chat-current-session');
      }
    }
  };

  const selectSession = (id: string) => {
    const session = sessions.find(s => s.id === id);
    if (session) {
      setCurrentSessionId(id);
      localStorage.setItem('zero-chat-current-session', id);
      setMessages(session.messages);
      setIsMobileMenuOpen(false);
    }
  };

  const handleConfigChange = (newConfig: AppConfig) => {
    setConfig(newConfig);
    setIsConfigOpen(false);
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsProcessing(false);
    
    const updatedMessages = [...messages];
    const last = updatedMessages[updatedMessages.length - 1];
    if (last && last.role === 'model') {
       updatedMessages[updatedMessages.length - 1] = {
         ...last,
         makerData: last.makerData ? { ...last.makerData, status: 'stopped' as const, isStopped: true } : undefined,
         content: last.makerData ? last.content : (last.content + " [STOPPED]")
       };
       saveMessagesToSession(updatedMessages);
    }
  };

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

  // --- MAKER LOGIC ---

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
      
      setMessages(prevMessages => {
        const newMsgs = prevMessages.map(m => 
          m.id === messageId ? { ...m, makerData: { ...sessionData } } : m
        );
        return newMsgs;
      });
    };

    const persistState = () => {
       setSessions(prev => prev.map(s => 
         s.id === currentSessionId 
           ? { 
               ...s, 
               messages: s.messages.map(m => m.id === messageId ? { ...m, makerData: { ...sessionData } } : m) 
             } 
           : s
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
      persistState();

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
        persistState(); 
      }

      if (!signal.aborted) {
        updateSession({ status: 'done', isComplete: true });
        persistState();
      } else {
        updateSession({ status: 'stopped', isStopped: true });
        persistState();
      }

    } catch (e: any) {
       if (e.message === "Request aborted") {
         updateSession({ status: 'stopped', isStopped: true });
       } else {
         console.error(e);
         setMessages(prev => {
            const newMsgs = [...prev, {
              id: Date.now().toString(),
              role: 'system',
              content: `System Error: ${e.message}`,
              timestamp: Date.now()
           } as Message];
           
           return newMsgs.map(m => m.id === messageId ? { ...m, makerData: { ...m.makerData!, status: 'stopped' as const, isStopped: true } } : m);
         });
       }
       setSessions(prev => {
         const current = prev.find(s => s.id === currentSessionId);
         if(current) {
            return prev.map(s => s.id === currentSessionId ? { ...s, messages: messages } : s); 
         }
         return prev;
       });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && files.length === 0) || isProcessing) return;

    if (input.trim() === '/clear') {
       saveMessagesToSession([]); 
       setInput('');
       setFiles([]);
       return;
    }

    abortControllerRef.current = new AbortController();
    const currentFiles = [...files];
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      attachments: currentFiles,
      timestamp: Date.now()
    };

    const newMessages = [...messages, userMsg];
    saveMessagesToSession(newMessages);
    
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
        saveMessagesToSession([...newMessages, makerMsg]);
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
        saveMessagesToSession([...newMessages, botMsg]);
      }
    } catch (error: any) {
      if (error.message !== "Request aborted") {
        const errorMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'system',
          content: "Error: Could not process request. " + error.message,
          timestamp: Date.now()
        };
        saveMessagesToSession([...messages, userMsg, errorMsg]);
      }
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  };

  return (
    // Added pt-[env(safe-area-inset-top)] for notch support and select-none for app-feel
    <div className="flex h-[100dvh] bg-black text-zinc-100 font-sans overflow-hidden select-none pt-[env(safe-area-inset-top)]">
      
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/80 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed md:relative inset-y-0 left-0 z-50 bg-zinc-950 border-r border-zinc-900 
        transform transition-all duration-300 ease-in-out pt-[env(safe-area-inset-top)] md:pt-0
        ${isMobileMenuOpen ? 'translate-x-0 w-72' : '-translate-x-full md:translate-x-0'}
        ${isSidebarCollapsed ? 'md:w-16' : 'md:w-72'}
      `}>
        <Sidebar 
          sessions={sessions} 
          currentId={currentSessionId} 
          isCollapsed={isMobileMenuOpen ? false : isSidebarCollapsed}
          onSelect={selectSession} 
          onNew={createNewSession}
          onDelete={deleteSession}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onOpenConfig={() => setIsConfigOpen(true)}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative transition-all duration-300 h-full min-w-0">
        
        <header className="h-14 shrink-0 border-b border-zinc-800 flex items-center justify-between px-4 bg-zinc-950/80 backdrop-blur">
          <div className="flex items-center gap-3">
            <button 
              className="md:hidden p-2 -ml-2 text-zinc-400 hover:text-white"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu size={20} />
            </button>
            <div className="w-3 h-3 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
            <h1 className="font-mono font-bold text-lg tracking-tight hidden sm:block">zero-chat</h1>
            <span className="text-[10px] text-zinc-500 border border-zinc-800 rounded px-1.5 py-0.5">v1.3.0</span>
          </div>

          <div className="flex items-center gap-3 sm:gap-6">
             <div className="flex items-center gap-2 px-3 py-1 rounded bg-zinc-900/50 border border-zinc-800 text-xs font-mono text-zinc-400">
               <Coins size={14} className="text-yellow-500" />
               <span className="hidden sm:inline">${totalCost.toFixed(4)}</span>
             </div>

             <div className="h-6 w-px bg-zinc-800/50"></div>

             <div className="flex items-center gap-2">
                <button 
                  onClick={forceReset}
                  className="p-1.5 hover:bg-red-900/30 text-zinc-500 hover:text-red-500 rounded transition-colors"
                  title="Force Kill Tasks"
                >
                  <Skull size={16} />
                </button>

                <div 
                  className="flex items-center gap-2 cursor-pointer group select-none ml-2"
                  onClick={() => setIsMakerMode(!isMakerMode)}
                  title={isMakerMode ? "Switch to Standard Chat" : "Switch to Maker Agent"}
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
          <div className="flex-1 overflow-y-auto select-text">
             <ChatInterface messages={messages} isMakerMode={isMakerMode} />
          </div>
        </ErrorBoundary>

        <div className="p-3 sm:p-4 bg-black border-t border-zinc-900 shrink-0 pb-[env(safe-area-inset-bottom)]">
           <form onSubmit={handleSubmit} className="max-w-4xl mx-auto relative mb-[env(safe-area-inset-bottom)]">
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
                    placeholder={isMakerMode ? "Task or Analysis... (/clear to reset)" : "Message Gemini... (/clear to reset)"}
                    className="w-full h-full bg-zinc-900 border border-zinc-700 text-zinc-100 rounded-lg pl-4 pr-12 focus:outline-none focus:border-emerald-600/50 focus:ring-1 focus:ring-emerald-900/50 font-mono text-sm transition-all disabled:opacity-50 select-text"
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
              
              <div className="flex justify-betweupdaen mt-2 text-[10px] text-zinc-600 font-mono px-1">
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

      <ConfigEditor 
        isOpen={isConfigOpen} 
        onClose={() => setIsConfigOpen(false)}
        initialContent={configContent} 
        onConfigChange={handleConfigChange} 
      />
    </div>
  );
};

export default App;