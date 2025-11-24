// src/app/api/chat/route.ts
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, convertToCoreMessages } from 'ai';
import { logEvent, getOrCreateProject } from '../../../lib/storage';
import { DIRECTOR_SYSTEM_PROMPT, DIRECTOR_TOOLS } from '../../../lib/director';

export const maxDuration = 300;

export async function POST(req: Request) {
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
  const coreMessages = convertToCoreMessages(messages);

  // 1. Ensure Project Exists & Log User Message
  const projectId = 'default';
  await getOrCreateProject(projectId);

  // We only log the *latest* user message to avoid duplicates, 
  // as 'messages' contains the full history.
  const lastMessage = messages[messages.length - 1];
  if (lastMessage && lastMessage.role === 'user') {
    await logEvent(projectId, {
      source: 'USER',
      type: 'chat',
      content: lastMessage.content
    });
  }

  const google = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  });

  const result = await streamText({
    model: google('gemini-2.5-flash'),
    messages: coreMessages,
    system: DIRECTOR_SYSTEM_PROMPT,
    tools: DIRECTOR_TOOLS,
    maxSteps: 10,
    onFinish: async ({ response }) => {
      // 2. Log Director's Response (Text + Tool Calls)
      // response.messages contains the newly generated turns (assistant text or tool calls)
      for (const msg of response.messages) {
        // Determine content based on message type
        let content = '';
        let metadata = null;

        if (msg.content && typeof msg.content === 'string') {
            content = msg.content;
        } else if (Array.isArray(msg.content)) {
            // Handle multi-part content (text + tool calls)
            content = msg.content
                .filter(c => c.type === 'text')
                .map(c => c.text)
                .join('\n');
            
            // We can store tool calls in metadata or logging specific tool events
            const toolCalls = msg.content.filter(c => c.type === 'tool-call');
            if (toolCalls.length > 0) {
                metadata = { toolCalls };
                // Optionally append tool usage notice to content if empty
                if (!content) content = `[Executing: ${toolCalls.map(t => t.toolName).join(', ')}]`;
            }
        }

        await logEvent(projectId, {
          source: 'DIRECTOR',
          type: 'chat',
          content: content || '[Tool Execution]', // Fallback if purely tool call
          metadata: metadata
        });
      }
    }
  } as any);

  // @ts-ignore
  return result.toUIMessageStreamResponse();
}