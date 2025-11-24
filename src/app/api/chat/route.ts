import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, convertToCoreMessages } from 'ai';
import { saveChatHistory } from '../../../lib/storage';
import { DIRECTOR_SYSTEM_PROMPT, DIRECTOR_TOOLS } from '../../../lib/director';

export const maxDuration = 300;

export async function POST(req: Request) {
  // 1. DEFENSIVE PARSING
  let body;
  try {
    const text = await req.text();
    if (!text) return new Response('Missing request body', { status: 400 });
    body = JSON.parse(text);
  } catch (error) {
    console.error("❌ JSON Parse Error:", error);
    return new Response('Invalid JSON body', { status: 400 });
  }

  const { messages } = body;
  
  // 2. DATA SANITIZATION (THE FIX)
  // The frontend sends UIMessages (complex). Gemini needs CoreMessages (simple).
  // We must convert them before sending to the model.
  const coreMessages = convertToCoreMessages(messages);

  const google = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  });

  // 3. EXECUTION (THE BRAIN)
  const result = await streamText({
    model: google('gemini-2.0-flash-001'), 
    messages: coreMessages, // <--- USE SANITIZED MESSAGES HERE
    system: DIRECTOR_SYSTEM_PROMPT,
    tools: DIRECTOR_TOOLS,
    maxSteps: 10, 
    onFinish: async ({ response }) => {
      // 4. PERSISTENCE (RAW DATA)
      // We persist the *original* UI messages + the new response messages
      // so the frontend can reload the full state (ids, tool invocations, etc.)
      // Note: response.messages are already in a format compatible with storage/UI reconstruction
      // but we need to be careful about mixing types. 
      // Ideally, we let the frontend manage state via the stream, 
      // but since we are saving to file, we append the new response messages.
      const newHistory = [...messages, ...response.messages];
      saveChatHistory(newHistory);
    }
  } as any); 

  // 5. STREAMING (THE PIPE)
  // @ts-ignore
  return result.toUIMessageStreamResponse();
}