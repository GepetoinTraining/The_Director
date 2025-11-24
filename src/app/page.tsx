'use client';

import { useChat } from '@ai-sdk/react'; // ✅ Correct import for SDK 5.x
import { useState, useEffect } from 'react';
import { Terminal, FolderOpen, Play, Trash2 } from 'lucide-react';
import FileExplorer from '../components/FileExplorer';
import SpecEditor from '../components/SpecEditor';

export default function DirectorConsole() {
  const [activeTab, setActiveTab] = useState<'chat' | 'files'>('chat');
  const [currentSpec, setCurrentSpec] = useState<any>(null);
  const [latestVideo, setLatestVideo] = useState<string | null>(null);
  const [videoKey, setVideoKey] = useState(0);

  // 1. Manually manage the input state
  const [inputValue, setInputValue] = useState('');

  // 2. Destructure only what exists in SDK 5.0 (removed input/handleSubmit)
  const { messages, isLoading, append, setMessages } = useChat({
    maxSteps: 20, // Match your API route config
    api: '/api/chat',
    onError: (e) => console.error("Chat Error:", e), // Handy for debugging
  });

  // 3. Create a custom submit handler
  const onSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim()) return;

    // Save the input content before clearing
    const userMessage = inputValue;
    setInputValue(''); // Clear UI immediately

    // Send to the agent
    await append({
      role: 'user',
      content: userMessage,
    });
  };

  // ... (Keep your existing useEffects for History and Sync) ...
  // [Re-paste your existing useEffects here if you aren't replacing the whole file]
  // 1. Load History on Mount
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

  useEffect(() => {
    const reversedMessages = [...messages].reverse();
    for (const m of reversedMessages) {
      // Note: Check 'content' array in SDK 5 if toolInvocations is missing on client,
      // but usually toolInvocations is preserved on the client-side message object.
      if (m.toolInvocations) {
        const renderResult = m.toolInvocations.find(
          (inv) => inv.toolName === 'renderVideo' && inv.state === 'result'
        );
        if (renderResult && 'result' in renderResult) {
          const result = renderResult.result as any;
          if (result.success && result.url !== latestVideo) {
            setLatestVideo(result.url);
            setCurrentSpec(result.spec);
            setVideoKey(prev => prev + 1);
            break; // Stop after finding the latest
          }
        }
      }
    }
  }, [messages, latestVideo]);

  const handleManualRender = async () => {
    if (!currentSpec) return;
    append({
      role: 'user',
      content: `Re-render the video using this updated specification: ${JSON.stringify(currentSpec)}`
    });
  };

  return (
    <div className="flex h-screen bg-black text-zinc-200 font-sans overflow-hidden">
      
      {/* --- PANE 1: LEFT (Sidebar) --- */}
      <div className="w-[14%] min-w-[200px] flex flex-col border-r border-zinc-800 bg-zinc-950">
        {/* ... (Keep your existing Tab Buttons) ... */}
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
                      {/* Render Text Content */}
                      {m.content}
                    </div>
                    {/* Render Tools */}
                    {m.toolInvocations?.map(t => (
                      <div key={t.toolCallId} className="mt-1 text-[10px] text-zinc-600 font-mono">
                        ⚙️ {t.toolName} ({t.state})
                      </div>
                    ))}
                  </div>
                ))}
                {isLoading && <div className="text-zinc-600 animate-pulse text-xs">Director is thinking...</div>}
              </div>
              
              {/* 4. Updated Form with new Handlers */}
              <form onSubmit={onSubmit} className="p-2 border-t border-zinc-800">
                <textarea
                  className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-xs focus:border-red-900 outline-none resize-none"
                  rows={3}
                  value={inputValue} // Bound to local state
                  onChange={(e) => setInputValue(e.target.value)} // Update local state
                  placeholder="Instruct..."
                  onKeyDown={(e) => {
                    if(e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      onSubmit(); // Call custom submit
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