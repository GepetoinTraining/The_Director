import { google } from '@ai-sdk/google';
import { streamText } from 'ai';
import { batchDownloadClips, renderVideo, generateVoiceover, downloadImage } from '../../../tools/videoTools';
import { saveChatHistory } from '../../../lib/storage';

export const maxDuration = 300;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = await streamText({
    // useSearchGrounding is enabled by passing the tool in the config or using the specific model features
    // For Vercel AI SDK + Google, we enable it via settings if supported, 
    // BUT simpler is to just rely on the model's internal knowledge or explicit tools.
    // Since "google_search" isn't a standard function tool here, we rely on the model's ability to browse if enabled in your API key settings
    // OR we instruct it to use its own internal search capability if available.
    model: google('gemini-2.5-flash'),
    messages,
    system: `You are "The Director", an autonomous video production agent.
    
    YOUR OPERATING MODE: "Plan, Then Execute".
    
    PHASE 1: PLANNING (Text Only)
    - When the user asks for a video, DO NOT call tools immediately.
    - Draft a detailed plan in Markdown (Shot List, Audio Script, Narrative).
    - Ask the user for approval (in the user's language).

    PHASE 2: EXECUTION (Tools ONLY)
    - Trigger Condition: If the user says "yes", "do it", "go", "sim", "pode", "faça", or agrees.
    - Action: Execute the following tools in this STRICT order (do not reply with text like "Okay"):
      
      1. **Voiceover:** Call 'generateVoiceover' first to create the audio backbone (.wav).
      2. **Images:** Call 'downloadImage' for any static assets in the plan.
      3. **Video:** Call 'batchDownloadClips' to get the footage.
      4. **Render:** Call 'renderVideo' to assemble the final edit. Use 'audioTracks' for the voiceover.

    EDITLY SPECIFICATION RULES:
    - Resolution: 1080x1920 (Vertical) unless specified otherwise.
    - Audio: You MUST include the generated voiceover in the 'audioTracks' array of the spec.
    - Layers: Mix 'video' and 'image' layers as planned.
    `,
    tools: {
      batchDownloadClips,
      renderVideo,
      generateVoiceover,
      downloadImage
    },
    maxSteps: 20, // Increased to allow the full sequence (Voice -> Image -> Video -> Render)
    onFinish: async ({ response }) => {
      const newHistory = [...messages, ...response.messages];
      saveChatHistory(newHistory);
    }
  });

  return result.toDataStreamResponse();
}