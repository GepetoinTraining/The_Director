import React, { useState } from 'react';
import { Layers, Clock, Type, Image as ImageIcon, Film, Save, Music, Box, AlignCenter, Move } from 'lucide-react';

export default function SpecEditor({ spec, onUpdate, onRender }: { spec: any, onUpdate: (s: any) => void, onRender: () => void }) {
  const [activeClipIndex, setActiveClipIndex] = useState<number | null>(null);

  if (!spec) return (
    <div className="flex flex-col items-center justify-center h-full text-zinc-600 bg-zinc-950">
      <div className="w-16 h-16 mb-4 border-2 border-dashed border-zinc-800 rounded-lg flex items-center justify-center opacity-20">
        <Film className="w-8 h-8" />
      </div>
      <p className="font-mono text-xs">WAITING FOR TIMELINE DATA</p>
    </div>
  );

  // Auto-select first clip if none selected
  if (activeClipIndex === null && spec.clips.length > 0) {
    setActiveClipIndex(0);
  }

  const updateClip = (index: number, field: string, value: any) => {
    const newClips = [...spec.clips];
    newClips[index] = { ...newClips[index], [field]: value };
    onUpdate({ ...spec, clips: newClips });
  };

  const updateLayer = (clipIndex: number, layerIndex: number, field: string, value: any) => {
    const newClips = [...spec.clips];
    const newLayers = [...newClips[clipIndex].layers];
    newLayers[layerIndex] = { ...newLayers[layerIndex], [field]: value };
    newClips[clipIndex] = { ...newClips[clipIndex], layers: newLayers };
    onUpdate({ ...spec, clips: newClips });
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950 border-r border-zinc-800">
      {/* Toolbar */}
      <div className="h-12 border-b border-zinc-800 flex justify-between items-center px-4 bg-zinc-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-zinc-100 font-mono text-xs tracking-widest">
          <Layers className="w-4 h-4 text-red-500" />
          <span>SEQUENCE EDITOR</span>
        </div>
        <button 
          onClick={onRender}
          className="flex items-center gap-2 bg-zinc-100 hover:bg-white text-black px-3 py-1.5 rounded text-[10px] font-bold tracking-wide transition-all"
        >
          <Save className="w-3 h-3" />
          COMMIT CHANGES
        </button>
      </div>

      {/* Timeline Visualizer (Horizontal Strip) */}
      <div className="h-24 border-b border-zinc-800 bg-zinc-900/20 flex items-center px-4 gap-1 overflow-x-auto scrollbar-hide">
        {spec.clips.map((clip: any, i: number) => (
          <button
            key={i}
            onClick={() => setActiveClipIndex(i)}
            className={`h-16 min-w-[100px] rounded border transition-all relative group flex flex-col justify-end p-2 ${
              activeClipIndex === i ? 'border-red-500 bg-red-500/10' : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
            }`}
            style={{ width: `${Math.max(100, clip.duration * 20)}px` }} // Visual width based on duration
          >
            <div className="absolute top-2 left-2 text-[10px] font-mono text-zinc-500 group-hover:text-zinc-300">
              CLIP {i + 1}
            </div>
            <div className="text-xs font-bold text-zinc-300 truncate w-full text-left">
              {clip.duration}s
            </div>
          </button>
        ))}
      </div>

      {/* Clip Inspector */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-zinc-800">
        {activeClipIndex !== null && spec.clips[activeClipIndex] ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-200">
            
            {/* Clip Header */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <Film className="w-4 h-4 text-zinc-500" />
                CLIP {activeClipIndex + 1} SETTINGS
              </h2>
              <div className="flex items-center gap-2 bg-zinc-900 p-1 rounded border border-zinc-800">
                <Clock className="w-3 h-3 text-zinc-500" />
                <input 
                  type="number" 
                  value={spec.clips[activeClipIndex].duration} 
                  onChange={(e) => updateClip(activeClipIndex, 'duration', parseFloat(e.target.value))}
                  className="w-12 bg-transparent text-right text-xs focus:outline-none font-mono text-white"
                />
                <span className="text-[10px] text-zinc-600 pr-2">SEC</span>
              </div>
            </div>

            {/* TRACK 1: VIDEO */}
            <div className="space-y-2">
              <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider flex items-center gap-2">
                <Film className="w-3 h-3" /> Video Track
              </div>
              {spec.clips[activeClipIndex].layers
                .map((layer: any, idx: number) => ({ ...layer, originalIdx: idx }))
                .filter((l: any) => l.type === 'video' || (l.type === 'image' && !l.text)) // Heuristic for BG
                .map((layer: any) => (
                  <div key={layer.originalIdx} className="bg-zinc-900 border border-zinc-800 p-3 rounded-lg flex gap-3">
                    <div className="w-1 h-full bg-blue-600 rounded-full"></div>
                    <div className="flex-1 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-blue-400 font-mono font-bold">{layer.type.toUpperCase()}</span>
                      </div>
                      <div className="text-xs text-zinc-500 break-all font-mono bg-zinc-950 p-2 rounded border border-zinc-800/50">
                        {layer.path ? layer.path.split('/').pop() : 'No Source'}
                      </div>
                    </div>
                  </div>
              ))}
            </div>

            {/* TRACK 2: AUDIO */}
            <div className="space-y-2">
              <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider flex items-center gap-2">
                <Music className="w-3 h-3" /> Audio Track
              </div>
              <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-lg">
                 <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span>Source Audio Active</span>
                 </div>
              </div>
            </div>

            {/* TRACK 3: OBJECTS & TEXT */}
            <div className="space-y-2">
              <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider flex items-center gap-2">
                <Box className="w-3 h-3" /> Objects & Overlays
              </div>
              {spec.clips[activeClipIndex].layers
                .map((layer: any, idx: number) => ({ ...layer, originalIdx: idx }))
                .filter((l: any) => !['video'].includes(l.type) && !(l.type === 'image' && !l.text)) 
                .map((layer: any) => (
                  <div key={layer.originalIdx} className="bg-zinc-900 border border-zinc-800 p-3 rounded-lg group hover:border-zinc-700 transition-colors">
                    <div className="flex gap-3">
                      <div className="w-1 h-full bg-yellow-500 rounded-full"></div>
                      <div className="flex-1 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-yellow-500 font-mono uppercase font-bold">{layer.type}</span>
                        </div>
                        
                        {/* Text Content Editor */}
                        {layer.text !== undefined && (
                          <textarea 
                            value={layer.text}
                            onChange={(e) => updateLayer(activeClipIndex, layer.originalIdx, 'text', e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm text-zinc-200 focus:border-yellow-600 outline-none resize-none font-sans"
                            rows={2}
                          />
                        )}
                        
                        {/* Timeline Controls for this Object */}
                        <div className="flex gap-2 pt-1 border-t border-zinc-800/50">
                           <div className="flex-1 flex items-center gap-2 bg-zinc-950/50 px-2 py-1 rounded">
                              <span className="text-[10px] text-zinc-600 uppercase">Start</span>
                              <input 
                                type="number"
                                className="w-full bg-transparent text-xs outline-none text-right font-mono text-zinc-300"
                                value={layer.start || 0}
                                onChange={(e) => updateLayer(activeClipIndex, layer.originalIdx, 'start', parseFloat(e.target.value))}
                              />
                           </div>
                           <div className="flex-1 flex items-center gap-2 bg-zinc-950/50 px-2 py-1 rounded">
                              <span className="text-[10px] text-zinc-600 uppercase">Stop</span>
                              <input 
                                type="number"
                                className="w-full bg-transparent text-xs outline-none text-right font-mono text-zinc-300"
                                value={layer.stop || spec.clips[activeClipIndex].duration}
                                onChange={(e) => updateLayer(activeClipIndex, layer.originalIdx, 'stop', parseFloat(e.target.value))}
                              />
                           </div>
                        </div>
                      </div>
                    </div>
                  </div>
              ))}
              
              {/* Placeholder for adding new layers manually (future feature) */}
              <button className="w-full py-3 border border-dashed border-zinc-800 rounded text-[10px] font-bold text-zinc-600 hover:text-zinc-400 hover:border-zinc-600 transition-all uppercase tracking-wider">
                + Add New Overlay
              </button>
            </div>

          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-zinc-700 space-y-2">
            <Move className="w-8 h-8 opacity-50" />
            <p className="text-xs font-mono">SELECT A CLIP FROM TIMELINE TO EDIT</p>
          </div>
        )}
      </div>
    </div>
  );
}