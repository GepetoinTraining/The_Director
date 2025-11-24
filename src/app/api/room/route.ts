import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, convertToCoreMessages } from 'ai';
import { getOrCreateProject, logEvent } from '../../../lib/storage';
import { DIRECTOR_SYSTEM_PROMPT, DIRECTOR_TOOLS } from '../../../lib/director';
import { EXPERT_SYSTEM_PROMPT } from '../../../lib/expert';
import { projects } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { db } from '../../../db';

export const maxDuration = 300;

export async function POST(req: Request) {
  // 1. Parse & Log
  const { messages } = await req.json();
  const projectId = 'default';
  await getOrCreateProject(projectId);

  const lastMessage = messages[messages.length - 1];
  
  // Only log if it's a real user message (not an internal re-prompt)
  if (lastMessage.role === 'user' && !lastMessage.content.startsWith('[PRODUCER_MODE]')) {
    await logEvent(projectId, {
      source: 'USER',
      type: 'chat',
      content: lastMessage.content
    });
  }

  // 2. Routing Logic
  const project = await db.select().from(projects).where(eq(projects.id, projectId)).get();
  const currentManifest = project?.currentManifest ? JSON.parse(project.currentManifest) : null;
  
  let activeAgent = 'DIRECTOR';
  let systemPrompt = DIRECTOR_SYSTEM_PROMPT;
  let tools: any = DIRECTOR_TOOLS;

  // Priority: Tags > Phase > Default
  if (lastMessage.content.includes('@expert')) {
    activeAgent = 'EXPERT';
    systemPrompt = EXPERT_SYSTEM_PROMPT;
    tools = undefined; 
  } else if (lastMessage.content.includes('@director')) {
    activeAgent = 'DIRECTOR';
  } else if (currentManifest && !lastMessage.content.includes('[PRODUCER_MODE]')) {
    // Production Phase default
    activeAgent = 'EXPERT';
    systemPrompt = EXPERT_SYSTEM_PROMPT;
    tools = undefined;
  }

  // 3. Execute
  const google = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  });

  const result = await streamText({
    model: google('gemini-2.5-flash'),
    messages: convertToCoreMessages(messages),
    system: systemPrompt,
    tools: tools,
    maxSteps: 10,
    onFinish: async ({ response }) => {
      const responseText = response.messages.map(m => 
        m.content.map(c => c.type === 'text' ? c.text : '').join('')
      ).join('\n');

      const toolCalls = response.messages
        .flatMap(m => m.content)
        .filter(c => c.type === 'tool-call');

      await logEvent(projectId, {
        source: activeAgent as any,
        type: 'chat',
        content: responseText || (toolCalls.length ? '[Tool Executing...]' : ''),
        metadata: toolCalls.length > 0 ? { toolCalls } : null
      });
    }
  } as any);

  // @ts-ignore
  return result.toUIMessageStreamResponse();
}