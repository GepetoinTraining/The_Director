import { NextResponse } from 'next/server';
import { getChatHistory, clearChatHistory } from '../../../../lib/storage';

export async function GET() {
  const history = getChatHistory();
  return NextResponse.json(history);
}

export async function DELETE() {
  clearChatHistory();
  return NextResponse.json({ success: true });
}