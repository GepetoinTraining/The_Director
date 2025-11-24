import { NextResponse } from 'next/server';
import { getChatHistory, clearChatHistory } from '../../../../lib/storage';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const view = searchParams.get('view') || 'full'; // 'full' | 'clean' | 'media'

  const rawHistory = getChatHistory();

  if (view === 'clean') {
    // FILTER STRATEGY: 
    // Remove intermediate "thinking" (tool calls without visual output).
    // Keep User messages and Assistant TEXT messages.
    // Filter out tool-call parts unless they are critical errors.
    const cleanHistory = rawHistory.map((msg: any) => {
      if (msg.role !== 'assistant') return msg;

      // Filter assistant parts
      const cleanParts = msg.parts.filter((p: any) => 
        p.type === 'text' || 
        (p.type === 'tool-result' && p.toolName === 'renderVideo') // Only show the final render result
      );

      // If message becomes empty after filtering, mark for removal (or handle in UI)
      return { ...msg, parts: cleanParts };
    }).filter((msg: any) => msg.parts.length > 0);

    return NextResponse.json(cleanHistory);
  }

  // Default: Return everything (for Debugging/Director Console)
  return NextResponse.json(rawHistory);
}

export async function DELETE() {
  clearChatHistory();
  return NextResponse.json({ success: true });
}