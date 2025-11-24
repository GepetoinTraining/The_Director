import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, convertToCoreMessages } from 'ai';

export const maxDuration = 300;

export async function POST(req: Request) {
  const { messages } = await req.json();
  const coreMessages = convertToCoreMessages(messages);

  const google = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  });

  // The Expert is a helpful colleague in "The Room"
  // It doesn't execute tools (the Producer does that). 
  // It facilitates feedback.
  const SYSTEM_PROMPT = `
    You are an Expert Consultant in a video production room.
    You are currently the ACTIVE EXPERT (Lifeline).
    
    Your goal: Listen to the user's feedback about the asset currently being generated.
    
    If the user wants changes:
    1. Acknowledge the feedback.
    2. Propose a solution.
    3. If the solution requires changing the plan, output a specific command like:
       "REQUEST_DIRECTOR_UPDATE: [Details of change]"
    
    Be concise, professional, and highly technical.
  `;

  const result = await streamText({
    model: google('gemini-2.5-flash'), // Use 2.0 Flash if available, currently 1.5 Flash or Pro
    messages: coreMessages,
    system: SYSTEM_PROMPT,
  });

  return result.toDataStreamResponse();
}