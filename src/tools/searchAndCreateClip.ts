import { tool } from 'ai';
import { z } from 'zod';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import { ensureDir, addSecondsToTime } from './utils';

const execAsync = util.promisify(exec);

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