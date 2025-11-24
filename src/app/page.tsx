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
  const [activeExpert, setActiveExpert] = useState<string | null>(null); 
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

  // --- 1. DIRECTOR AGENT (The Vision) ---
  // DESTRUCTURED for safety
  const { 
    append: directorAppend, 
    messages: directorMessages, 
    setMessages: setDirectorMessages,
    isLoading: isDirectorLoading 
  } = useChat({
    api: '/api/chat',
    onError: (e) => addLog('SYSTEM', `Director Error: ${e.message}`, 'error'),
    onFinish: (msg) => {
      // Detect Manifest
      if (msg.role === 'assistant' && !manifest) {
        const text = msg.content;
        const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          try {
            const data = JSON.parse(jsonMatch[1]);
            if (data.type === 'manifest') {
              addLog('DIRECTOR', 'Manifest generated. Transferring control to Producer.', 'success');
              setManifest({ ...data, steps: data.steps.map((s:any) => ({ ...s, status: 'pending' })) });
            }
          } catch (e) { console.error(e); }
        }
      }
    }
  });

  // --- 2. EXPERT AGENT (The Room Lifeline) ---
  const {
    append: expertAppend,
    isLoading: isExpertLoading
  } = useChat({
    api: '/api/expert',
    id: 'expert-channel',
    body: { 
        // Pass current context to the expert
        context: manifest?.steps.find(s => s.status === 'running') || { status: 'IDLE' }
    },
    onFinish: (msg) => {
      addLog('EXPERT', msg.content, 'info');
    }
  });

  // --- 3. PRODUCER ENGINE (The Executor) ---
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

    // Open The Room Channel
    const expertRole = getExpertRole(step.action);
    setActiveExpert(expertRole);
    addLog('PRODUCER', `Initiating Task: ${step.description}`, 'info');
    addLog('PRODUCER', `Channel Open: ${expertRole}`, 'command');

    // Execute (Silent request to Director API)
    const prompt = `[PRODUCER_MODE] Execute: ${step.action} with params: ${JSON.stringify(step.params)}`;
    try {
      await directorAppend({ role: 'user', content: prompt });
    } catch (e) {
      addLog('PRODUCER', 'Execution Failed', 'error');
      setIsProducerBusy(false);
      producerQueueRef.current = false;
    }
  };

  // Listen for Tool Results to update Producer
  useEffect(() => {
    if (!producerQueueRef.current || !manifest) return;

    const lastMsg = directorMessages[directorMessages.length - 1];
    if (!lastMsg || isDirectorLoading) return;

    // Look for tool calls
    const runningIdx = manifest.steps.findIndex(s => s.status === 'running');
    if (runningIdx !== -1) {
        const newSteps = [...manifest.steps];
        newSteps[runningIdx].status = 'completed';
        setManifest({ ...manifest, steps: newSteps });
        
        addLog('PRODUCER', `Task Complete: ${manifest.steps[runningIdx].action}`, 'success');
        setIsProducerBusy(false);
        producerQueueRef.current = false;
        setActiveExpert(null); // Close Channel
    }
  }, [directorMessages, isDirectorLoading]);

  // --- 4. PREVIEW SYNC ---
  useEffect(() => {
    const reversedMessages = [...directorMessages].reverse();
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
  }, [directorMessages, latestVideo]);

  // --- UTILS & HANDLERS ---
  const getExpertRole = (action: string) => {
    if (action.includes('Voice')) return 'AUDIO ENGINEER';
    if (action.includes('Image')) return 'VISUAL RESEARCHER';
    if (action.includes('render')) return 'EDITOR';
    return 'ASSISTANT';
  };

  const handleRoomMessage = async (text: string) => {
    addLog('USER', text, 'info');
    if (activeExpert) {
        // Route to Expert Agent
        await expertAppend({ role: 'user', content: text });
    }
  };

  const handleDirectorMessage = async (text: string) => {
    // Director chat is only for Phase 1 (Planning)
    if (!manifest) {
        await directorAppend({ role: 'user', content: text });
    }
  };

  const clearHistory = () => {
    fetch('/api/chat/history', { method: 'DELETE' });
    setDirectorMessages([]);
    setRoomLogs([]);
    setManifest(null);
    setLatestVideo(null);
    setCurrentSpec(null);
  };

  return (
    <div className="flex h-screen bg-black text-zinc-200 font-sans overflow-hidden">
      
      {/* COL 1: DIRECTOR / PRODUCER */}
      <ProducerPanel 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        manifest={manifest}
        isProducerBusy={isProducerBusy}
        viewMode={viewMode}
        setViewMode={setViewMode}
        clearHistory={clearHistory}
        messages={directorMessages}
        retryStep={(i) => { /* retry logic */ }}
        sendMessage={handleDirectorMessage}
      />

      {/* COL 2 & 3 CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        
        {/* TOP: EDITOR & PREVIEW */}
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

        {/* BOTTOM: THE ROOM (CONSOLE) */}
        <TheRoom 
            logs={roomLogs}
            activeExpert={activeExpert}
            onSendMessage={handleRoomMessage}
            isTyping={isExpertLoading}
        />

      </div>
    </div>
  );
}