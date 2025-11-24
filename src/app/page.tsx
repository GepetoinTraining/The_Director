'use client';

import { useChat } from '@ai-sdk/react';
import { useState, useEffect } from 'react';
import { Terminal, FolderOpen, Play, Trash2, Eye, EyeOff } from 'lucide-react';
import { DefaultChatTransport } from 'ai';
import FileExplorer from '../components/FileExplorer';
import SpecEditor from '../components/SpecEditor';

export default function DirectorConsole() {
  const [activeTab, setActiveTab] = useState<'chat' | 'files'>('chat');
  const [currentSpec, setCurrentSpec] = useState<any>(null);
  const [latestVideo, setLatestVideo] = useState<string | null>(null);
  const [videoKey, setVideoKey] = useState(0);
  const [inputValue, setInputValue] = useState('');
  
  // NEW: View Mode State
  const [viewMode, setViewMode] = useState<'full' | 'clean'>('full');

  const { messages, status, sendMessage, setMessages, reload } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
    }),
    onError: (e) => console.error("Chat Error:", e),
  });

  const isLoading = status === 'streaming' || status === 'submitted';

  // Load History with Filtering Strategy
  const fetchHistory = (mode: 'full' | 'clean') => {
    fetch(`/api/chat/history?view=${mode}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setMessages(data);
        }
      });
  };

  // Initial Load
  useEffect(() => {
    fetchHistory(viewMode);
  }, []); // Only run on mount

  // Handle Mode Toggle
  const toggleViewMode = () => {
    const newMode = viewMode === 'full' ? 'clean' : 'full';
    setViewMode(newMode);
    // If we are NOT streaming, we can fetch the filtered history from server
    if (status === 'ready') {
      fetchHistory(newMode);
    }
  };

  const clearHistory = async () => {
    await fetch('/api/chat/history', { method: 'DELETE' });
    setMessages([]);
    setLatestVideo(null);
    setCurrentSpec(null);
  };

  // Smart State Sync (Detecting the Render Tool Result)
  useEffect(() => {
    const reversedMessages = [...messages].reverse();
    for (const m of reversedMessages) {
      if (m.parts) {
        for (const part of m.parts) {
          if (part.type === 'tool-result' && (part as any).toolName === 'renderVideo') {
            const result = (part as any).result;
            if (result?.success && result.url !== latestVideo) {
              setLatestVideo(result.url);
              setCurrentSpec(result.spec);
              setVideoKey(prev => prev + 1);
              break;
            }
          }
        }
      }
    }
  }, [messages, latestVideo]);

  const onSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    const userMessage = inputValue.trim();
    setInputValue('');
    try {
      await sendMessage({ text: userMessage });
    } catch (error) {
      console.error('Failed to send message:', error);
      setInputValue(userMessage);
    }
  };

  const handleManualRender = async () => {
    if (!currentSpec || isLoading) return;
    try {
      await sendMessage({ 
        text: `Re-render the video using this updated specification: ${JSON.stringify(currentSpec)}` 
      });
    } catch (error) {
      console.error('Failed to re-render:', error);
    }
  };

  return (
    <div className="flex h-screen bg-black text-zinc-200 font-sans overflow-hidden">
      
      {/* --- PANE 1: LEFT (Sidebar) --- */}
      <div className="w-[20%] min-w-[250px] flex flex-col border-r border-zinc-800 bg-zinc-950">
        <div className="flex border-b border-zinc-800">
          <button 
            onClick={() => setActiveTab('chat')}
            className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-2 ${activeTab === 'chat' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:text-zinc-400'}`}
          >
            <Terminal className="w-4 h-4" /> CONSOLE
          </button>
          <button 
            onClick={() => setActiveTab('files')}
            className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-2 ${activeTab === 'files' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:text-zinc-400'}`}
          >
            <FolderOpen className="w-4 h-4" /> ASSETS
          </button>
        </div>

        <div className="flex-1 overflow-hidden relative">
          {activeTab === 'chat' ? (
            <div className="absolute inset-0 flex flex-col">
              {/* Chat Toolbar */}
              <div className="flex justify-between items-center p-2 border-b border-zinc-800 bg-zinc-900/50">
                <div className="text-[10px] font-mono text-zinc-500 flex items-center gap-2">
                  STATUS: <span className={isLoading ? "text-yellow-500 animate-pulse" : "text-green-500"}>{isLoading ? 'THINKING' : 'IDLE'}</span>
                </div>
                <div className="flex gap-1">
                  <button 
                    onClick={toggleViewMode} 
                    title={viewMode === 'full' ? "Hide Thinking" : "Show All Details"}
                    className={`p-1.5 rounded hover:bg-zinc-800 ${viewMode === 'clean' ? 'text-blue-400' : 'text-zinc-600'}`}
                  >
                    {viewMode === 'full' ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={clearHistory} className="p-1.5 rounded hover:bg-red-900/30 text-zinc-600 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Chat Stream */}
              <div className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-thin">
                {messages.map((m) => (
                  <div key={m.id} className={`text-xs group ${m.role === 'user' ? 'text-blue-300' : 'text-zinc-400'}`}>
                    <span className="font-bold opacity-50 uppercase mb-1 block text-[10px] tracking-wider">{m.role}</span>
                    
                    <div className="whitespace-pre-wrap leading-relaxed">
                      {m.parts.map((part, idx) => {
                        // RENDER TEXT
                        if (part.type === 'text') {
                          return <div key={idx}>{part.text}</div>;
                        } 
                        
                        // RENDER TOOL CALLS (Only if in FULL mode or if actively streaming)
                        else if (part.type === 'tool-call') {
                          if (viewMode === 'clean' && status === 'ready') return null;
                          return (
                            <div key={idx} className="mt-2 mb-2 p-2 bg-zinc-900 rounded border border-zinc-800 font-mono text-[10px] text-yellow-600/80 flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-yellow-600 animate-pulse"></div>
                              Executing: {(part as any).toolName}
                            </div>
                          );
                        } 
                        
                        // RENDER TOOL RESULTS
                        else if (part.type === 'tool-result') {
                          const toolName = (part as any).toolName;
                          const isRender = toolName === 'renderVideo';
                          
                          if (viewMode === 'clean' && !isRender) return null;

                          return (
                            <div key={idx} className={`mt-1 text-[10px] font-mono flex items-center gap-2 ${isRender ? 'text-green-400 p-2 bg-green-900/20 border border-green-900/50 rounded' : 'text-zinc-600'}`}>
                              {isRender ? '✅ RENDER COMPLETE' : `✓ ${toolName}`}
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </div>
                ))}
              </div>
              
              <form onSubmit={onSubmit} className="p-2 border-t border-zinc-800 bg-zinc-950">
                <textarea
                  className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-xs focus:border-zinc-600 focus:bg-zinc-800 outline-none resize-none text-zinc-200 placeholder-zinc-600"
                  rows={3}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Command the Director..."
                  disabled={isLoading}
                  onKeyDown={(e) => {
                    if(e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      onSubmit();
                    }
                  }}
                />
              </form>
            </div>
          ) : (
            <FileExplorer />
          )}
        </div>
      </div>

      {/* --- PANE 2: MIDDLE (Editor) --- */}
      <div className="flex-1 flex flex-col bg-zinc-900/50 border-r border-zinc-800">
        <SpecEditor 
          spec={currentSpec} 
          onUpdate={setCurrentSpec} 
          onRender={handleManualRender}
        />
      </div>

      {/* --- PANE 3: RIGHT (Preview) --- */}
      <div className="w-[30%] min-w-[400px] bg-black flex flex-col relative">
        <div className="absolute top-4 left-4 z-10 flex items-center gap-3">
          <div className="bg-zinc-950/80 backdrop-blur border border-zinc-800 px-3 py-1.5 rounded-full flex items-center gap-2 shadow-lg">
            <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-yellow-500 animate-ping' : 'bg-green-500'}`}></div>
            <span className="text-[10px] font-mono font-bold text-zinc-300 tracking-widest">
              {isLoading ? 'PROCESSING' : 'LIVE FEED'}
            </span>
          </div>
        </div>
        
        <div className="flex-1 flex items-center justify-center p-8 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-900 to-black">
          {latestVideo ? (
            <div className="relative w-full h-full flex items-center justify-center group">
              {/* Video Container */}
              <div className="relative max-h-full max-w-full aspect-[9/16] shadow-2xl border border-zinc-800 rounded-lg overflow-hidden bg-black">
                <video 
                  key={videoKey} 
                  src={latestVideo} 
                  controls 
                  autoPlay 
                  loop 
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          ) : (
            <div className="text-zinc-800 flex flex-col items-center gap-4">
              <div className="w-24 h-24 rounded-full border-2 border-dashed border-zinc-800 flex items-center justify-center">
                <Play className="w-10 h-10 opacity-20" />
              </div>
              <p className="font-mono text-xs tracking-widest opacity-50">AWAITING SIGNAL</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}