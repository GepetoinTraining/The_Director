import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, convertToModelMessages, UIMessage } from 'ai';
import { getOrCreateProject, logEvent } from '../../../lib/storage';
import { DIRECTOR_SYSTEM_PROMPT, DIRECTOR_TOOLS } from '../../../lib/director';
import { EXPERT_PROMPTS } from '../../../lib/expert';
import { projects } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { db } from '../../../db';

export const maxDuration = 300;

// --- ROUTING CONFIGURATION ---
type AgentRole = 'DIRECTOR' | 'AUDIO_ENGINEER' | 'VISUAL_RESEARCHER' | 'EXPERT';

interface AgentConfig {
  id: AgentRole;
  prompt: string;
  tools?: any; 
}

const AGENTS: Record<AgentRole, AgentConfig> = {
  DIRECTOR: {
    id: 'DIRECTOR',
    prompt: DIRECTOR_SYSTEM_PROMPT,
    tools: DIRECTOR_TOOLS
  },
  AUDIO_ENGINEER: {
    id: 'AUDIO_ENGINEER',
    prompt: EXPERT_PROMPTS.AUDIO,
    tools: undefined 
  },
  VISUAL_RESEARCHER: {
    id: 'VISUAL_RESEARCHER',
    prompt: EXPERT_PROMPTS.VISUAL,
    tools: undefined
  },
  EXPERT: {
    id: 'EXPERT',
    prompt: EXPERT_PROMPTS.GENERAL,
    tools: undefined
  }
};

// Helper to safely get text from UIMessage (v5 structure)
function getLastUserMessageText(messages: Array<UIMessage>): string {
  if (!messages || messages.length === 0) return '';
  
  const lastMsg = messages[messages.length - 1];
  
  // Cast to any to inspect properties safely
  const msg = lastMsg as any;
  
  if (typeof msg.content === 'string') {
    return msg.content;
  }

  // Handle multimodal 'parts'
  if (Array.isArray(msg.parts)) {
    return msg.parts
      .filter((p: any) => p.type === 'text')
      .map((p: any) => p.text)
      .join('');
  }
  
  return '';
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // FIX 1: Ensure messages is an array. If undefined, default to empty array.
    const messages: UIMessage[] = Array.isArray(body.messages) ? body.messages : [];
    
    // Optional: Fail fast if no messages
    if (messages.length === 0) {
      // This prevents convertToModelMessages from choking on empty data if it were strict,
      // but mainly it prevents logic errors downstream.
      console.warn("⚠️ No messages received in request body.");
    }

    const projectId = 'default';
    await getOrCreateProject(projectId);

    const userContent = getLastUserMessageText(messages);
    const lastMessage = messages[messages.length - 1];

    // 1. Log User Input
    if (lastMessage?.role === 'user' && !userContent.startsWith('[PRODUCER_MODE]')) {
      await logEvent(projectId, {
        source: 'USER',
        type: 'chat',
        content: userContent
      });
    }

    // 2. Determine Active Agent (Routing Logic)
    const project = await db.select().from(projects).where(eq(projects.id, projectId)).get();
    const currentManifest = project?.currentManifest ? JSON.parse(project.currentManifest) : null;
    
    let activeAgent = AGENTS.DIRECTOR;

    if (userContent.includes('@audio')) {
      activeAgent = AGENTS.AUDIO_ENGINEER;
    } else if (userContent.includes('@visual')) {
      activeAgent = AGENTS.VISUAL_RESEARCHER;
    } else if (userContent.includes('@expert')) {
      activeAgent = AGENTS.EXPERT;
    } else if (userContent.includes('@director')) {
      activeAgent = AGENTS.DIRECTOR;
    } else if (currentManifest && !userContent.includes('[PRODUCER_MODE]')) {
      activeAgent = AGENTS.EXPERT;
    }

    console.log(`🔀 Routing Request to: [${activeAgent.id}]`);

    const google = createGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    });

    // 3. Execute Stream
    const result = streamText({
      model: google('gemini-2.5-flash'),
      
      // FIX 2: convertToModelMessages is safe now that 'messages' is guaranteed to be an array
      messages: convertToModelMessages(messages),
      
      system: activeAgent.prompt,
      tools: activeAgent.tools || {}, 
      
      onFinish: async ({ response }) => {
        // FIX 3: Defensive check for response.messages
        const msgs = response.messages || [];
        
        const responseText = msgs.map(m => {
          if (typeof m.content === 'string') return m.content;
          if (Array.isArray(m.content)) {
            return m.content
              .filter((c: any) => c.type === 'text')
              .map((c: any) => c.text)
              .join('');
          }
          return '';
        }).join('\n');

        const toolCalls = msgs.flatMap(m => {
             if (Array.isArray(m.content)) {
               return m.content.filter((c: any) => c.type === 'tool-call');
             }
             return [];
          });

        await logEvent(projectId, {
          source: activeAgent.id as any,
          type: 'chat',
          content: responseText || (toolCalls.length ? '[Tool Executing...]' : ''),
          metadata: toolCalls.length > 0 ? { toolCalls } : null
        });
      }
    });

    // Use toUIMessageStreamResponse (Standard for useChat in v5)
    return result.toUIMessageStreamResponse({
      onError: ({ error }) => {
        console.error("Stream Error:", error);
        return "An internal error occurred.";
      }
    });

  } catch (error: any) {
    console.error("Router Error:", error);
    // Return JSON error so the frontend can display it nicely in the log
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}