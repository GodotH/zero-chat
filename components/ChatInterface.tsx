import React, { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Message, Attachment } from '../types';
import MakerVisualizer from './MakerVisualizer';
import { User, Bot, Terminal, Globe, Cpu, FileText, Image as ImageIcon, File } from 'lucide-react';

interface ChatInterfaceProps {
  messages: Message[];
  isMakerMode: boolean;
}

const AttachmentDisplay: React.FC<{ attachments: Attachment[] }> = ({ attachments }) => {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-3 mb-1">
      {attachments.map((att, i) => (
        <div key={i} className="group relative border border-zinc-700 bg-zinc-900/50 rounded-lg overflow-hidden max-w-[200px]">
          {att.mimeType.startsWith('image/') ? (
            <div className="relative">
              <img 
                src={`data:${att.mimeType};base64,${att.data}`} 
                alt={att.name} 
                className="max-h-32 object-cover w-full opacity-80 group-hover:opacity-100 transition-opacity"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1 truncate text-[10px] text-zinc-300 font-mono px-2">
                {att.name}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3">
              <div className="p-2 bg-zinc-800 rounded text-zinc-400">
                {att.mimeType.includes('pdf') ? <FileText size={16} /> : <File size={16} />}
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-xs text-zinc-300 font-mono truncate" title={att.name}>{att.name}</span>
                <span className="text-[10px] text-zinc-600 uppercase">{att.mimeType.split('/')[1]}</span>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, isMakerMode }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6">
      {messages.length === 0 && (
        <div className="h-full flex flex-col items-center justify-center text-zinc-500 opacity-50">
           <Cpu size={64} className="mb-4 text-zinc-700" />
           <p className="font-mono text-sm">INITIALIZED: ZERO-CHAT [MAKER-COMPATIBLE]</p>
           <p className="font-mono text-xs mt-2">READY FOR DECOMPOSITION</p>
        </div>
      )}
      
      {messages.map((msg) => (
        <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
          
          {/* Avatar */}
          <div className={`
            w-8 h-8 rounded-none flex items-center justify-center shrink-0 border
            ${msg.role === 'user' 
              ? 'bg-zinc-800 border-zinc-600 text-zinc-300' 
              : 'bg-emerald-950 border-emerald-700/50 text-emerald-400'
            }
          `}>
            {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
          </div>

          {/* Bubble */}
          <div className={`
            max-w-[85%] rounded px-4 py-3 text-sm leading-relaxed
            ${msg.role === 'user' 
              ? 'bg-zinc-800 text-zinc-100 border border-zinc-700' 
              : 'bg-transparent text-zinc-300'
            }
          `}>
             <div className="prose prose-invert prose-sm max-w-none">
                <AttachmentDisplay attachments={msg.attachments || []} />
                
                {msg.type === 'maker-process' && msg.makerData ? (
                  <MakerVisualizer data={msg.makerData} />
                ) : (
                  <>
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                    {/* Render grounding metadata links if available */}
                    {msg.content.includes("http") && (
                       <div className="mt-2 flex gap-2 flex-wrap">
                          {/* Grounding chunks would be processed here in a real grounding implementation */}
                       </div>
                    )}
                  </>
                )}
             </div>
          </div>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
};

export default ChatInterface;