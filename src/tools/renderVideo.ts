import { tool } from 'ai';
import { z } from 'zod';
import path from 'path';
import { ensureDir } from './utils';

// Local Schemas
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
      // FIX: Dynamic Import with explicit type handling
      // We use a dynamic import to prevent server crash on startup.
      // We cast to 'any' to ignore TypeScript errors about the module structure.
      const editlyModule = await import('editly');
      // @ts-ignore
      const editly = editlyModule.default || editlyModule;

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