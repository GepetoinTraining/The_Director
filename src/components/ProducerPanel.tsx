import React from 'react';
import { Terminal, FolderOpen, CheckCircle2, Circle, Loader2, AlertCircle, Eye, EyeOff, Trash2 } from 'lucide-react';
import FileExplorer from './FileExplorer';

// Types shared with page.tsx
type Step = {
  id: string;
  action: string;
  description: string;
  params: any;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
};

type Manifest = {
  title: string;
  steps: Step[];
};

interface ProducerPanelProps {
  activeTab: 'chat' | 'files';
  setActiveTab: (tab: 'chat' | 'files') => void;
  manifest: Manifest | null;
  isProducerBusy: boolean;
  viewMode: 'full' | 'clean';
  setViewMode: (mode: 'full' | 'clean') => void;
  clearHistory: () => void;
  messages: any[];
  retryStep: (index: number) => void;
  sendMessage: (text: string) => void;
}

export default function ProducerPanel({
  activeTab,
  setActiveTab,
  manifest,
  isProducerBusy,
  viewMode,
  setViewMode,
  clearHistory,
  messages,
  retryStep,
  sendMessage
}: ProducerPanelProps) {

  // Helper to extract text safely from Vercel AI SDK messages
  const getMessageText = (m: any) => {
    if (typeof m.content === 'string') return m.content;
    if (Array.isArray(m.parts)) {
      return m.parts.map((p: any) => p.text || '').join('');
    }
    return '';
  };

  return (
    <div className="w-[25%] min-w-[300px] flex flex-col border-r border-zinc-800 bg-zinc-950">
      {/* Header / Tabs */}
      <div className="flex border-b border-zinc-800">
        <button onClick={() => setActiveTab('chat')} className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-2 ${activeTab === 'chat' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:text-zinc-400'}`}>
          <Terminal className="w-4 h-4" /> CONSOLE
        </button>
        <button onClick={() => setActiveTab('files')} className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-2 ${activeTab === 'files' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:text-zinc-400'}`}>
          <FolderOpen className="w-4 h-4" /> ASSETS
        </button>
      </div>

      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'chat' ? (
          <div className="absolute inset-0 flex flex-col">
            {/* Status Bar */}
            <div className="flex justify-between items-center p-2 border-b border-zinc-800 bg-zinc-900/50">
              <div className="text-[10px] font-mono text-zinc-500 flex items-center gap-2">
                {manifest ? <><CheckCircle2 className="w-3 h-3 text-green-500" /> PRODUCER ACTIVE</> : "DIRECTOR MODE"}
              </div>
              <div className="flex gap-1">
                <button onClick={() => setViewMode(viewMode === 'full' ? 'clean' : 'full')} className="p-1.5 hover:bg-zinc-800 rounded text-zinc-600" title="Toggle View Mode">
                  {viewMode === 'full' ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                </button>
                <button onClick={clearHistory} className="p-1.5 hover:bg-red-900/30 text-zinc-600 hover:text-red-500 rounded" title="Clear History">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Layer 1: Chat History */}
            <div className={`flex-1 overflow-y-auto p-3 space-y-4 scrollbar-thin ${manifest ? 'opacity-20 pointer-events-none' : ''}`}>
              {messages.filter(m => !getMessageText(m).includes('[PRODUCER_MODE]')).map((m, i) => (
                <div key={`${m.id}-${i}`} className={`text-xs whitespace-pre-wrap ${m.role === 'user' ? 'text-blue-300' : 'text-zinc-400'}`}>
                  <span className="font-bold uppercase opacity-50 block mb-1 text-[10px]">{m.role}</span>
                  {/* Safe Content Rendering */}
                  {m.content ? m.content : (
                    m.parts ? m.parts.map((part: any, idx: number) => {
                      if (part.type === 'text') return <span key={idx}>{part.text}</span>;
                      if (part.type === 'tool-invocation') return <div key={idx} className="bg-zinc-900 p-1 rounded border border-zinc-800 font-mono text-[10px] my-1 text-yellow-600">⚙️ Calling: {part.toolName}</div>;
                      return null;
                    }) : null
                  )}
                </div>
              ))}
            </div>

            {/* Layer 2: Producer Checklist Overlay */}
            {manifest && (
              <div className="absolute inset-0 top-8 bg-zinc-950/95 backdrop-blur-sm p-4 animate-in fade-in slide-in-from-bottom-4 z-10 flex flex-col">
                <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-widest border-b border-zinc-800 pb-2 flex justify-between items-center">
                  <span>Production Schedule</span>
                  {isProducerBusy && <Loader2 className="w-3 h-3 animate-spin" />}
                </h3>
                <div className="flex-1 overflow-y-auto space-y-2">
                  {manifest.steps.map((step, i) => (
                    <div key={step.id} className={`
                      p-3 rounded border text-xs flex items-center gap-3 transition-all
                      ${step.status === 'running' ? 'border-yellow-500/50 bg-yellow-500/10' : ''}
                      ${step.status === 'completed' ? 'border-green-900 bg-green-900/10 text-zinc-400' : ''}
                      ${step.status === 'pending' ? 'border-zinc-800 bg-zinc-900' : ''}
                      ${step.status === 'failed' ? 'border-red-800 bg-red-900/20' : ''}
                    `}>
                      <div className="shrink-0">
                        {step.status === 'running' && <Loader2 className="w-4 h-4 animate-spin text-yellow-500" />}
                        {step.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                        {step.status === 'pending' && <Circle className="w-4 h-4 text-zinc-600" />}
                        {step.status === 'failed' && (
                            <button onClick={(e) => { e.stopPropagation(); retryStep(i); }}><AlertCircle className="w-4 h-4 text-red-500 hover:text-white" /></button>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold mb-0.5 truncate">{step.action.toUpperCase()}</div>
                        <div className="opacity-70 truncate" title={step.description}>{step.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Input Area (Hidden in Producer Mode) */}
            {!manifest && (
              <div className="p-2 border-t border-zinc-800 bg-zinc-950">
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const target = e.target as HTMLFormElement;
                  const input = target.elements.namedItem('message') as HTMLInputElement;
                  if (input.value.trim()) sendMessage(input.value);
                  input.value = '';
                }}>
                  <input name="message" className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-xs text-white focus:border-blue-500 outline-none" placeholder="Command the Director..." />
                </form>
              </div>
            )}
          </div>
        ) : (
          <FileExplorer />
        )}
      </div>
    </div>
  );
}