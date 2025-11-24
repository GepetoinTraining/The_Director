// src/app/api/chat/history/route.ts
import { NextResponse } from 'next/server';
import { getProjectHistory, clearProjectHistory } from '../../../../lib/storage';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const view = searchParams.get('view') || 'full';

  // Retrieve from DB
  const rawHistory = await getProjectHistory('default');

  if (view === 'clean') {
    // Same filter logic as before, applied to DB results
    const cleanHistory = rawHistory.map((msg: any) => {
      if (msg.role !== 'assistant') return msg;

      // If the DB stored tool calls in metadata, we reconstruct the 'parts' 
      // or simpler: just return the content if it's text.
      // However, the UI expects Vercel AI SDK format.
      
      // If our DB content is simple text, we just return it.
      // If we need to filter internal thoughts stored in metadata, we do it here.
      
      // Basic filter: if it's a tool call (marked in metadata) but has no text content, skip unless renderVideo
      if (msg.metadata?.toolCalls) {
         const isRender = msg.metadata.toolCalls.some((tc: any) => tc.toolName === 'renderVideo');
         if (!isRender && !msg.content) return null; // Skip intermediate tools
      }
      return msg;
    }).filter(Boolean);

    return NextResponse.json(cleanHistory);
  }

  return NextResponse.json(rawHistory);
}

export async function DELETE() {
  await clearProjectHistory('default');
  return NextResponse.json({ success: true });
}