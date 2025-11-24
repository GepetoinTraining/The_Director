import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import { batchDownloadClips, renderVideo, generateVoiceover, downloadImage } from '../../../tools/videoTools';
import { saveChatHistory } from '../../../lib/storage';

export const maxDuration = 300;

export async function POST(req: Request) {
  const body = await req.json();
  console.log('📥 Received request body:', JSON.stringify(body, null, 2));
  
  const { messages } = body;
  const google = createGoogleGenerativeAI();

  const result = await streamText({
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
    maxSteps: 20,
    onFinish: async ({ response, usage }) => {
      console.log("\n=== 🎬 DIRECTOR LOG: TURN COMPLETE ===");
      console.log("📊 Token Usage:", usage);

      const newMessages = response.messages;

      for (const m of newMessages) {
        if (m.role === 'assistant') {
          console.log("🤖 ASSISTANT:");
          
          if (typeof m.content === 'string') {
            console.log("   Text:", m.content);
          } else if (Array.isArray(m.content)) {
            m.content.forEach((part: any) => {
              if (part.type === 'text') {
                console.log("   📝 Text:", part.text);
              } else if (part.type === 'tool-call') {
                console.log("   🛠️ TOOL CALL:", part.toolName);
                console.log("      Args:", JSON.stringify(part.args, null, 2));
              }
            });
          }
        }
      }
      console.log("========================================\n");

      const newHistory = [...messages, ...response.messages];
      saveChatHistory(newHistory);
    }
  });

  return result.toDataStreamResponse();
}