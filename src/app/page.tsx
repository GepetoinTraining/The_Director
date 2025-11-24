'use client';

import { useChat } from '@ai-sdk/react';
import { useState, useEffect, useRef } from 'react';
import ProducerPanel from '../components/ProducerPanel';
import SpecEditor from '../components/SpecEditor';
import PreviewPanel from '../components/PreviewPanel';
import TheRoom from '../components/TheRoom';

// --- TYPES ---
type LogEntry = {
  id: string;
  source: 'PRODUCER' | 'DIRECTOR' | 'EXPERT' | 'SYSTEM' | 'USER';
  message: string;
  timestamp: number;
  type: 'info' | 'success' | 'error' | 'command';
};

type Step = {
  id: string;
  action: string;
  description: string;
  params: any;
  status: 'pending' | 'running' | 'completed' | 'failed';
};

type Manifest = {
  title: string;
  steps: Step[];
};

export default function DirectorConsole() {
  // --- STATE ---
  const [activeTab, setActiveTab] = useState<'chat' | 'files'>('chat');
  const [viewMode, setViewMode] = useState<'full' | 'clean'>('full');
  const [currentSpec, setCurrentSpec] = useState<any>(null);
  const [latestVideo, setLatestVideo] = useState<string | null>(null);
  const [videoKey, setVideoKey] = useState(0);
  
  // --- SWARM STATE ---
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [isProducerBusy, setIsProducerBusy] = useState(false);
  const [roomLogs, setRoomLogs] = useState<LogEntry[]>([]);
  const [activeExpert, setActiveExpert] = useState<string | null>('DIRECTOR'); 
  const producerQueueRef = useRef<boolean>(false); 

  // --- LOGGING SYSTEM ---
  const addLog = (source: LogEntry['source'], message: string, type: LogEntry['type'] = 'info') => {
    setRoomLogs(prev => [...prev, {
      id: Math.random().toString(36),
      timestamp: Date.now(),
      source,
      message,
      type
    }]);
  };

  // --- UNIFIED AGENT (THE ROOM) ---
  const { 
    append: roomAppend, 
    messages: roomMessages, 
    isLoading: isRoomLoading 
  } = useChat({
    api: '/api/room', 
    id: 'the-room-v2', // <--- CHANGED: Forces a fresh hook instance
    onError: (e) => addLog('SYSTEM', `Room Error: ${e.message}`, 'error'),
    onFinish: (msg) => {
      // Manifest Detection (Director Logic)
      if (msg.role === 'assistant') {
        const text = msg.content;
        const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\{[\s\S]*\}/);
        if (jsonMatch && !manifest) {
          try {
            const jsonStr = jsonMatch[1] || jsonMatch[0];
            const data = JSON.parse(jsonStr);
            if (data.type === 'manifest') {
              addLog('DIRECTOR', 'Manifest generated. Transferring control to Producer.', 'success');
              setManifest({ ...data, steps: data.steps.map((s:any) => ({ ...s, status: 'pending' })) });
              setActiveExpert('EXPERT'); // Switch default context
            }
          } catch (e) { /* Not a manifest */ }
        }
      }
    }
  });

  // --- PRODUCER ENGINE (The Executor) ---
  useEffect(() => {
    if (!manifest || isProducerBusy || producerQueueRef.current) return;

    const nextStepIdx = manifest.steps.findIndex(s => s.status === 'pending');
    if (nextStepIdx === -1) {
      addLog('PRODUCER', 'Production Wrap. All tasks complete.', 'success');
      return; 
    }

    executeStep(nextStepIdx);
  }, [manifest, isProducerBusy]);

  const executeStep = async (index: number) => {
    if (!manifest) return;
    setIsProducerBusy(true);
    producerQueueRef.current = true;

    const step = manifest.steps[index];
    
    // UI Update
    const newSteps = [...manifest.steps];
    newSteps[index].status = 'running';
    setManifest({ ...manifest, steps: newSteps });

    addLog('PRODUCER', `Initiating Task: ${step.description}`, 'info');

    // Execute via Room (Using Tagging to force Director execution)
    // SAFEGUARD: Check if roomAppend exists before calling
    if (roomAppend) {
      const prompt = `[PRODUCER_MODE] @director Execute: ${step.action} with params: ${JSON.stringify(step.params)}`;
      try {
          await roomAppend({ role: 'user', content: prompt });
      } catch (e: any) {
        addLog('PRODUCER', `Execution Failed: ${e.message}`, 'error');
        setIsProducerBusy(false);
        producerQueueRef.current = false;
      }
    } else {
      addLog('SYSTEM', 'Connection lost. Retrying step...', 'error');
      setIsProducerBusy(false);
      producerQueueRef.current = false;
    }
  };

  // Listen for Tool Results
  useEffect(() => {
    if (!producerQueueRef.current || !manifest) return;

    const lastMsg = roomMessages[roomMessages.length - 1];
    if (!lastMsg || isRoomLoading) return;

    const runningIdx = manifest.steps.findIndex(s => s.status === 'running');
    if (runningIdx !== -1) {
        const hasToolResult = lastMsg.parts?.some(p => p.type === 'tool-invocation');
        
        if (hasToolResult || lastMsg.content) { 
            const newSteps = [...manifest.steps];
            newSteps[runningIdx].status = 'completed';
            setManifest({ ...manifest, steps: newSteps });
            
            addLog('PRODUCER', `Task Complete: ${manifest.steps[runningIdx].action}`, 'success');
            setIsProducerBusy(false);
            producerQueueRef.current = false;
        }
    }
  }, [roomMessages, isRoomLoading]);

  // --- 4. PREVIEW SYNC ---
  useEffect(() => {
    const reversedMessages = [...roomMessages].reverse();
    for (const m of reversedMessages) {
      if (m.parts) {
        for (const part of m.parts) {
          if (part.type === 'tool-result' && (part as any).toolName === 'renderVideo') {
            const result = (part as any).result;
            if (result?.success && result.url !== latestVideo) {
              setLatestVideo(result.url);
              setCurrentSpec(result.spec);
              setVideoKey(p => p + 1);
              addLog('SYSTEM', 'New render detected. Updating preview.', 'success');
              break;
            }
          }
        }
      }
    }
  }, [roomMessages, latestVideo]);

  // --- UTILS ---
  const handleRoomMessage = async (text: string) => {
    addLog('USER', text, 'info');
    
    // DEFENSIVE CHECK: Ensure hook is ready
    if (!roomAppend) {
        addLog('SYSTEM', 'System initializing... please wait.', 'error');
        return;
    }

    // The Backend Router (`/api/room`) now decides who answers based on state
    await roomAppend({ role: 'user', content: text });
  };

  const clearHistory = () => {
    fetch('/api/chat/history', { method: 'DELETE' });
    // We can't clear useChat messages directly without reloading in this SDK version usually, 
    // but we can reset local state.
    setRoomLogs([]);
    setManifest(null);
    setLatestVideo(null);
    setCurrentSpec(null);
    setActiveExpert('DIRECTOR');
    window.location.reload(); // Simplest way to reset useChat hook state
  };

  return (
    <div className="flex h-screen bg-black text-zinc-200 font-sans overflow-hidden">
      
      <ProducerPanel 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        manifest={manifest}
        isProducerBusy={isProducerBusy}
        viewMode={viewMode}
        setViewMode={setViewMode}
        clearHistory={clearHistory}
        messages={roomMessages}
        retryStep={() => {}}
      />

      <div className="flex-1 flex flex-col min-w-0 relative">
        <div className="flex-1 flex min-h-0">
            <div className="flex-1 flex flex-col bg-zinc-900/50 border-r border-zinc-800 min-w-0">
                <SpecEditor 
                  spec={currentSpec} 
                  onUpdate={setCurrentSpec} 
                  onRender={() => {}}
                />
            </div>
            <PreviewPanel 
                latestVideo={latestVideo}
                videoKey={videoKey}
                isProducerBusy={isProducerBusy}
            />
        </div>

        <TheRoom 
            logs={roomLogs}
            activeExpert={activeExpert}
            onSendMessage={handleRoomMessage}
            isTyping={isRoomLoading}
        />
      </div>
    </div>
  );
}