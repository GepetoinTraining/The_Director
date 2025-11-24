import { tool } from 'ai';
import { z } from 'zod';
import path from 'path';
import pV  from 'fs';
import { ensureDir } from './utils';
import fs from 'fs';

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