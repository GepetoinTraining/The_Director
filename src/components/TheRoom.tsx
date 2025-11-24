import React, { useEffect, useRef, useState } from 'react';
import { Terminal, Mic, MessageSquare, Activity, XCircle } from 'lucide-react';

interface LogEntry {
  id: string;
  source: 'PRODUCER' | 'DIRECTOR' | 'EXPERT' | 'SYSTEM';
  message: string;
  timestamp: number;
  type: 'info' | 'success' | 'error' | 'command';
  metadata?: any; 
}

interface TheRoomProps {
  logs: LogEntry[];
  activeExpert: string | null; // e.g., 'AUDIO_ENGINEER', 'VISUAL_RESEARCHER'
  onSendMessage: (text: string, expertId: string) => void;
}

export default function TheRoom({ logs, activeExpert, onSendMessage }: TheRoomProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    // If no expert is active, we default to Director or System
    const target = activeExpert || 'DIRECTOR';
    onSendMessage(input, target);
    setInput('');
  };

  return (
    <div className="h-1/3 min-h-[200px] border-t border-zinc-800 bg-zinc-950 flex flex-col font-mono text-xs">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/50 select-none">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-zinc-100 font-bold tracking-wider">
            <Terminal className="w-4 h-4 text-purple-500" />
            <span>THE ROOM</span>
          </div>
          
          {/* Active Expert Indicator */}
          {activeExpert ? (
            <div className="flex items-center gap-2 bg-purple-500/10 px-2 py-1 rounded border border-purple-500/20 text-purple-400 animate-pulse">
              <Activity className="w-3 h-3" />
              <span>LIVE: {activeExpert}</span>
            </div>
          ) : (
            <div className="text-zinc-600">IDLE</div>
          )}
        </div>
      </div>

      {/* Console Output */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-1.5 scrollbar-thin scrollbar-thumb-zinc-800"
      >
        {logs.map((log) => (
          <div key={log.id} className="flex gap-3 group hover:bg-zinc-900/50 -mx-2 px-2 rounded">
            <span className="text-zinc-600 w-[60px] shrink-0">
              {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}
            </span>
            <span className={`w-[80px] shrink-0 font-bold ${
              log.source === 'PRODUCER' ? 'text-yellow-500' :
              log.source === 'DIRECTOR' ? 'text-blue-500' :
              log.source === 'EXPERT' ? 'text-purple-500' : 'text-zinc-500'
            }`}>
              [{log.source}]
            </span>
            <span className={`flex-1 break-words ${
              log.type === 'error' ? 'text-red-400' :
              log.type === 'success' ? 'text-green-400' :
              log.type === 'command' ? 'text-cyan-300' : 'text-zinc-300'
            }`}>
              {log.message}
            </span>
          </div>
        ))}
      </div>

      {/* Input Line */}
      <form onSubmit={handleSubmit} className="p-2 border-t border-zinc-800 flex gap-2 bg-black">
        <div className="text-purple-500 pt-1.5">
          <MessageSquare className="w-4 h-4" />
        </div>
        <input 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 bg-transparent outline-none text-zinc-200 placeholder-zinc-700"
          placeholder={activeExpert ? `Talk to ${activeExpert}...` : "Waiting for active channel..."}
          autoFocus
        />
      </form>
    </div>
  );
}