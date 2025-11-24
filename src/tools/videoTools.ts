import { tool } from 'ai';
import { z } from 'zod';
import editly from 'editly';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = util.promisify(exec);

const ensureDir = (dir: string) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const addSecondsToTime = (timeStr: string, secondsToAdd: number) => {
  const [h, m, s] = timeStr.split(':').map(Number);
  const totalSeconds = h * 3600 + m * 60 + s + secondsToAdd;
  const newH = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
  const newM = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
  const newS = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
  return `${newH}:${newM}:${newS}`;
};

// FIX: Changed from 'batchDownloadClips' (Array) to 'searchAndCreateClip' (Single Object)
// This satisfies Gemini's strict schema requirements and prevents timeouts.
export const searchAndCreateClip = tool({
  description: 'Searches YouTube and downloads a SINGLE specific video segment.',
  parameters: z.object({
    query: z.string().describe('YouTube search query'),
    startTime: z.string().describe('Start time (HH:MM:SS)'),
    duration: z.number().describe('Duration in seconds'),
    fileName: z.string().describe('Output filename (.mp4)'),
  }),
  execute: async ({ query, startTime, duration, fileName }) => {
    const downloadsDir = path.join(process.cwd(), 'downloads');
    ensureDir(downloadsDir);
    const outputPath = path.join(downloadsDir, fileName);
    
    console.log(`🚀 [Clip Hunter] Searching: "${query}"`);

    try {
      // 1. Get ID
      const searchCmd = `yt-dlp "ytsearch1:${query}" --print id`;
      const { stdout: videoId } = await execAsync(searchCmd);
      const cleanId = videoId.trim();
      if (!cleanId) throw new Error("No video found for query");

      const url = `https://www.youtube.com/watch?v=${cleanId}`;
      const endTime = addSecondsToTime(startTime, duration);
      
      console.log(`⬇️ [${fileName}] Downloading segment (${startTime} - ${endTime})...`);
      
      // 2. Download Segment
      const command = `yt-dlp -f "bestvideo+bestaudio/best" --merge-output-format mp4 --download-sections "*${startTime}-${endTime}" --force-keyframes-at-cuts -o "${outputPath}" "${url}" --force-overwrites`;
      await execAsync(command);

      console.log(`✅ [${fileName}] Saved.`);
      return { success: true, file: fileName, path: outputPath };
    } catch (e: any) {
      console.error(`❌ Failed ${fileName}:`, e.message);
      return { success: false, error: e.message };
    }
  },
});

export const generateVoiceover = tool({
  description: 'Generates a voiceover audio file using Gemini 2.5 Flash TTS.',
  parameters: z.object({
    script: z.string().describe('The text to speak'),
    voiceName: z.enum(['Kore', 'Fenrir', 'Puck', 'Zephyr', 'Aoede']).default('Kore'),
    filename: z.string().describe('Output filename (e.g., narration.wav)')
  }),
  execute: async ({ script, voiceName, filename }) => {
    const audioDir = path.join(process.cwd(), 'downloads');
    ensureDir(audioDir);
    const outputPath = path.join(audioDir, filename);
    
    console.log(`🎙️ Generating Voiceover (${voiceName})...`);

    try {
      const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: script }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: { 
                prebuiltVoiceConfig: { 
                  voiceName: voiceName 
                } 
              }
            }
          }
        })
      });

      if (!response.ok) throw new Error(`TTS API Error: ${response.statusText}`);
      
      const data = await response.json();
      const audioBase64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      
      if (!audioBase64) throw new Error('No audio data received from API');

      fs.writeFileSync(outputPath, Buffer.from(audioBase64, 'base64'));
      return { success: true, path: outputPath };
    } catch (e: any) {
      console.error("TTS Failed:", e);
      return { success: false, error: e.message };
    }
  }
});

export const downloadImage = tool({
  description: 'Downloads an image from a public URL.',
  parameters: z.object({
    url: z.string().describe('The HTTP URL of the image'),
    filename: z.string().describe('Output filename (e.g. chart.png)')
  }),
  execute: async ({ url, filename }) => {
    const dir = path.join(process.cwd(), 'downloads');
    ensureDir(dir);
    const outputPath = path.join(dir, filename);
    
    console.log(`🖼️ Downloading Image: ${url}`);
    
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const buffer = await res.arrayBuffer();
      fs.writeFileSync(outputPath, Buffer.from(buffer));
      return { success: true, path: outputPath };
    } catch (e: any) {
      console.error("Image Download Failed:", e.message);
      return { success: false, error: e.message };
    }
  }
});

// Simplified Layer Schema
const LayerSchema = z.object({
  type: z.string(),
  path: z.string().optional(),
  text: z.string().optional(),
  color: z.string().optional(),
  position: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  start: z.number().optional(),
  stop: z.number().optional(),
  fontPath: z.string().optional(),
  textColor: z.string().optional(),
  fontSize: z.number().optional(),
}).passthrough();

const ClipSchema = z.object({
  duration: z.number().optional(),
  layers: z.array(LayerSchema),
  transition: z.object({ 
    name: z.string(), 
    duration: z.number().optional() 
  }).optional()
}).passthrough();

const AudioTrackSchema = z.object({
  path: z.string(),
  mixVolume: z.number().optional(),
  start: z.number().optional(),
  cutFrom: z.number().optional(),
  cutTo: z.number().optional()
}).passthrough();

export const renderVideo = tool({
  description: 'Renders the final video using the Editly engine.',
  parameters: z.object({
    spec: z.object({
      width: z.number().default(1080),
      height: z.number().default(1920),
      fps: z.number().default(30),
      clips: z.array(ClipSchema),
      audioTracks: z.array(AudioTrackSchema).optional(),
      defaults: z.object({
        transition: z.object({
          name: z.string(),
          duration: z.number().optional()
        }).optional(),
        layer: z.object({
          fontPath: z.string().optional()
        }).optional()
      }).optional()
    }).passthrough()
  }),
  execute: async ({ spec }) => {
    const publicDir = path.join(process.cwd(), 'public', 'renders');
    ensureDir(publicDir);
    const outputFilename = `render_${Date.now()}.mp4`;
    const outPath = path.join(publicDir, outputFilename);

    console.log("🎬 Rendering started...");

    try {
      const sanitizedClips = spec.clips.map((clip: any) => {
        if (clip.layers) {
          clip.layers = clip.layers.map((layer: any) => {
            if ((layer.type === 'video' || layer.type === 'image' || layer.type === 'audio') && layer.path && !path.isAbsolute(layer.path)) {
              return { ...layer, path: path.resolve(process.cwd(), layer.path) };
            }
            return layer;
          });
        }
        return clip;
      });

      const sanitizedAudioTracks = spec.audioTracks?.map((track: any) => ({
        ...track,
        path: track.path && !path.isAbsolute(track.path) ? path.resolve(process.cwd(), track.path) : track.path
      }));

      await editly({
        ...spec,
        clips: sanitizedClips,
        audioTracks: sanitizedAudioTracks,
        outPath,
        allowRemoteRequests: true,
        keepSourceAudio: true,
        enableAudio: true
      });

      console.log("✅ Render complete!");
      return { success: true, url: `/renders/${outputFilename}`, spec: spec };
    } catch (e: any) {
      console.error("Render error:", e);
      return { success: false, error: e.message };
    }
  },
});