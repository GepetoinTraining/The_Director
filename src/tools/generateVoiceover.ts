import { tool } from 'ai';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import { ensureDir } from './utils';

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