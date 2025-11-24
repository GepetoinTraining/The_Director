import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, convertToCoreMessages } from 'ai';
import { getOrCreateProject, logEvent } from '../../../lib/storage';
import { DIRECTOR_SYSTEM_PROMPT, DIRECTOR_TOOLS } from '../../../lib/director';
import { EXPERT_PROMPTS } from '../../../lib/expert'; // Matches the new export
import { projects } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { db } from '../../../db';

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const projectId = 'default';
    await getOrCreateProject(projectId);

    const lastMessage = messages[messages.length - 1];
    const userContent = lastMessage.content as string;

    // 1. Log User Input
    if (lastMessage.role === 'user' && !userContent.startsWith('[PRODUCER_MODE]')) {
      await logEvent(projectId, {
        source: 'USER',
        type: 'chat',
        content: userContent
      });
    }

    // 2. Determine Active Agent (Routing)
    const project = await db.select().from(projects).where(eq(projects.id, projectId)).get();
    const currentManifest = project?.currentManifest ? JSON.parse(project.currentManifest) : null;
    
    let activeAgent = 'DIRECTOR';
    let systemPrompt = DIRECTOR_SYSTEM_PROMPT;
    let tools: any = DIRECTOR_TOOLS;

    // Priority: Tags > Phase > Default
    if (userContent.includes('@audio')) {
      activeAgent = 'AUDIO_ENGINEER';
      systemPrompt = EXPERT_PROMPTS.AUDIO;
      tools = undefined;
    } else if (userContent.includes('@visual')) {
      activeAgent = 'VISUAL_RESEARCHER';
      systemPrompt = EXPERT_PROMPTS.VISUAL;
      tools = undefined;
    } else if (userContent.includes('@expert')) {
      activeAgent = 'EXPERT';
      systemPrompt = EXPERT_PROMPTS.GENERAL;
      tools = undefined;
    } else if (userContent.includes('@director')) {
      activeAgent = 'DIRECTOR';
    } else if (currentManifest && !userContent.includes('[PRODUCER_MODE]')) {
      activeAgent = 'EXPERT';
      systemPrompt = EXPERT_PROMPTS.GENERAL;
      tools = undefined;
    }

    // 3. Execute Stream
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

    return result.toUIMessageStreamResponse();

  } catch (error: any) {
    console.error("Room API Error:", error);
    // Return JSON error instead of HTML so the frontend handles it gracefully
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}