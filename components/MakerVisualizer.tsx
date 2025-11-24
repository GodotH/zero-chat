import React, { useEffect, useRef, useState } from 'react';
import { MakerSessionData } from '../types';
import { CheckCircle, Circle, Loader2, AlertTriangle, Play, BrainCircuit } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, Cell } from 'recharts';

interface MakerVisualizerProps {
  data: MakerSessionData;
}

const MakerVisualizer: React.FC<MakerVisualizerProps> = ({ data }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [data]);

  return (
    <div className="w-full bg-zinc-900 rounded-lg border border-zinc-700 overflow-hidden flex flex-col my-4 shadow-xl">
      <div className="bg-zinc-800 p-3 border-b border-zinc-700 flex justify-between items-center">
        <div className="flex items-center gap-2 text-emerald-400 font-mono text-sm">
          <BrainCircuit size={16} />
          <span className="font-bold tracking-wider">MAKER ENGINE ACTIVE</span>
        </div>
        <div className="text-xs text-zinc-400 font-mono">
           {data.status.toUpperCase()}
        </div>
      </div>

      <div ref={scrollRef} className="p-4 max-h-96 overflow-y-auto space-y-4">
        {/* Planning Phase */}
        {data.plan.length > 0 && (
          <div className="mb-6">
            <h4 className="text-xs uppercase text-zinc-500 font-bold mb-2 tracking-widest">Decomposition Plan</h4>
            <div className="grid grid-cols-1 gap-2">
              {data.plan.map((step, idx) => {
                const isCompleted = idx < data.currentStepIndex;
                const isCurrent = idx === data.currentStepIndex;
                return (
                  <div 
                    key={idx} 
                    className={`
                      flex items-center gap-3 p-2 rounded border text-sm font-mono transition-all duration-300
                      ${isCompleted ? 'bg-emerald-900/20 border-emerald-800/50 text-emerald-200' : ''}
                      ${isCurrent ? 'bg-blue-900/20 border-blue-800/50 text-blue-200 scale-[1.02] shadow-lg shadow-blue-900/10' : ''}
                      ${!isCompleted && !isCurrent ? 'bg-zinc-900 border-zinc-800 text-zinc-500' : ''}
                    `}
                  >
                    <div className="shrink-0 w-6 flex justify-center">
                      {isCompleted && <CheckCircle size={14} className="text-emerald-500" />}
                      {isCurrent && <Loader2 size={14} className="animate-spin text-blue-400" />}
                      {!isCompleted && !isCurrent && <Circle size={14} />}
                    </div>
                    <span className="truncate">{step}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Current Step Execution Detail */}
        {data.completedSteps.map((stepData, idx) => (
           <div key={idx} className="bg-zinc-950/50 rounded border border-zinc-800 p-4">
              <div className="flex justify-between items-start mb-3">
                 <h5 className="text-emerald-400 font-mono text-xs font-bold">STEP {idx + 1} COMPLETE</h5>
                 <div className="flex gap-2">
                    {stepData.redFlags > 0 && (
                      <span className="flex items-center gap-1 text-red-400 text-xs bg-red-900/20 px-2 py-0.5 rounded border border-red-900/30">
                        <AlertTriangle size={10} /> {stepData.redFlags} Red Flags Discarded
                      </span>
                    )}
                 </div>
              </div>
              
              <div className="mb-2">
                <div className="text-zinc-300 text-sm mb-2 font-mono">"{stepData.step}"</div>
                <div className="p-3 bg-zinc-800/50 rounded text-zinc-400 text-xs font-mono whitespace-pre-wrap border-l-2 border-emerald-500/50">
                  {stepData.result}
                </div>
              </div>

              {/* Voting Visualization */}
              <div className="mt-4 h-24 w-full">
                 <div className="text-[10px] text-zinc-500 mb-1 uppercase tracking-wider">Voting Confidence</div>
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stepData.candidates.map((_, i) => ({ 
                      name: `C${i+1}`, 
                      value: stepData.winnerIndex === i ? 100 : 20 + Math.random() * 30, // Mock confidence for viz
                      isWinner: stepData.winnerIndex === i
                    }))}>
                       <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                          {stepData.candidates.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index === stepData.winnerIndex ? '#34d399' : '#3f3f46'} />
                          ))}
                       </Bar>
                       <Tooltip 
                          contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', fontSize: '12px' }}
                          itemStyle={{ color: '#e4e4e7' }}
                          cursor={{fill: 'transparent'}}
                       />
                       <XAxis dataKey="name" tick={{fontSize: 10, fill: '#71717a'}} axisLine={false} tickLine={false} />
                    </BarChart>
                 </ResponsiveContainer>
              </div>
           </div>
        ))}

        {/* Loading State for Current Step */}
        {data.status !== 'done' && data.status !== 'planning' && (
           <div className="flex justify-center py-4">
              <div className="flex items-center gap-3 text-zinc-500 text-xs animate-pulse font-mono">
                 <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                 </span>
                 {data.status === 'generating_candidates' && 'GENERATING CANDIDATES (PARALLEL)...'}
                 {data.status === 'voting' && 'PERFORMING FIRST-TO-AHEAD-BY-K VOTING...'}
                 {data.status === 'executing' && 'EXECUTING STEP...'}
              </div>
           </div>
        )}
      </div>
    </div>
  );
};

export default MakerVisualizer;