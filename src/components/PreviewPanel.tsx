import React from 'react';
import { Play } from 'lucide-react';

interface PreviewPanelProps {
  latestVideo: string | null;
  videoKey: number;
  isProducerBusy: boolean;
}

export default function PreviewPanel({ latestVideo, videoKey, isProducerBusy }: PreviewPanelProps) {
  return (
    <div className="w-[30%] min-w-[400px] bg-black flex flex-col relative">
      <div className="absolute top-4 left-4 z-10 flex items-center gap-3">
        <div className="bg-zinc-950/80 backdrop-blur border border-zinc-800 px-3 py-1.5 rounded-full flex items-center gap-2 shadow-lg">
          <div className={`w-2 h-2 rounded-full ${isProducerBusy ? 'bg-yellow-500 animate-ping' : 'bg-green-500'}`}></div>
          <span className="text-[10px] font-mono font-bold text-zinc-300 tracking-widest">
            {isProducerBusy ? 'PRODUCER WORKING' : 'LIVE FEED'}
          </span>
        </div>
      </div>
      
      <div className="flex-1 flex items-center justify-center p-8 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-900 to-black">
        {latestVideo ? (
          <div className="relative w-full h-full flex items-center justify-center group">
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
  );
}