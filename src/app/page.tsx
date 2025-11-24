'use client';

import { useChat } from '@ai-sdk/react';
import { useState, useEffect } from 'react';
import { Terminal, FolderOpen, Play, Trash2 } from 'lucide-react';
import { DefaultChatTransport } from 'ai';
import FileExplorer from '../components/FileExplorer';
import SpecEditor from '../components/SpecEditor';

export default function DirectorConsole() {
  const [activeTab, setActiveTab] = useState<'chat' | 'files'>('chat');
  const [currentSpec, setCurrentSpec] = useState<any>(null);
  const [latestVideo, setLatestVideo] = useState<string | null>(null);
  const [videoKey, setVideoKey] = useState(0);
  const [inputValue, setInputValue] = useState('');

  const { messages, status, sendMessage, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
    }),
    onError: (e) => console.error("Chat Error:", e),
  });

  const isLoading = status === 'streaming' || status === 'submitted';

  // Load History on Mount
  useEffect(() => {
    fetch('/api/chat/history')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setMessages(data);
        }
      });
  }, [setMessages]);

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
      // In AI SDK 5, check parts for tool invocations
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

  // Fixed Submit Handler
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

  // Manual Render Handler
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
      
      {/* --- PANE 1: LEFT (Sidebar - 14%) --- */}
      <div className="w-[14%] min-w-[200px] flex flex-col border-r border-zinc-800 bg-zinc-950">
        <div className="flex border-b border-zinc-800">
          <button 
            onClick={() => setActiveTab('chat')}
            className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-2 ${activeTab === 'chat' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:text-zinc-400'}`}
          >
            <Terminal className="w-4 h-4" /> CHAT
          </button>
          <button 
            onClick={() => setActiveTab('files')}
            className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-2 ${activeTab === 'files' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:text-zinc-400'}`}
          >
            <FolderOpen className="w-4 h-4" /> FILES
          </button>
        </div>

        <div className="flex-1 overflow-hidden relative">
          {activeTab === 'chat' ? (
            <div className="absolute inset-0 flex flex-col">
              <div className="flex justify-end p-2 border-b border-zinc-800">
                <button onClick={clearHistory} className="text-xs text-zinc-600 hover:text-red-500 flex items-center gap-1">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-thin">
                {messages.map((m) => (
                  <div key={m.id} className={`text-xs ${m.role === 'user' ? 'text-blue-300' : 'text-zinc-400'}`}>
                    <span className="font-bold opacity-50 uppercase mb-1 block">{m.role}</span>
                    <div className="whitespace-pre-wrap">
                      {m.parts.map((part, idx) => {
                        if (part.type === 'text') {
                          return <div key={idx}>{part.text}</div>;
                        } else if (part.type === 'tool-call') {
                          return (
                            <div key={idx} className="mt-1 text-[10px] text-zinc-600 font-mono">
                              ⚙️ {(part as any).toolName} (calling)
                            </div>
                          );
                        } else if (part.type === 'tool-result') {
                          return (
                            <div key={idx} className="mt-1 text-[10px] text-zinc-500 font-mono">
                              ✓ {(part as any).toolName} (complete)
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </div>
                ))}
                {isLoading && <div className="text-zinc-600 animate-pulse text-xs">Director is thinking...</div>}
              </div>
              
              <form onSubmit={onSubmit} className="p-2 border-t border-zinc-800">
                <textarea
                  className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-xs focus:border-red-900 outline-none resize-none"
                  rows={3}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Instruct..."
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

      {/* --- PANE 2: MIDDLE (Editor - Flex) --- */}
      <div className="flex-1 flex flex-col bg-zinc-900/50 border-r border-zinc-800">
        <SpecEditor 
          spec={currentSpec} 
          onUpdate={setCurrentSpec} 
          onRender={handleManualRender}
        />
      </div>

      {/* --- PANE 3: RIGHT (Preview - 30%) --- */}
      <div className="w-[30%] min-w-[400px] bg-black flex flex-col relative">
        <div className="absolute top-4 left-4 text-zinc-600 font-mono text-xs flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-yellow-500 animate-ping' : 'bg-red-600'}`}></div>
          {isLoading ? 'PROCESSING' : 'LIVE MONITOR'}
        </div>
        
        <div className="flex-1 flex items-center justify-center p-8">
          {latestVideo ? (
            <div className="relative w-full h-full flex items-center justify-center">
              <video 
                key={videoKey} 
                src={latestVideo} 
                controls 
                autoPlay 
                loop 
                className="max-h-full max-w-full shadow-2xl border border-zinc-800"
              />
            </div>
          ) : (
            <div className="text-zinc-700 flex flex-col items-center">
              <Play className="w-16 h-16 mb-4 opacity-20" />
              <p className="font-mono text-xs tracking-widest">NO SIGNAL</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}