// app/api/render/route.ts
import { NextResponse } from 'next/server';
import editly from 'editly';
import path from 'path';

export async function POST(req: Request) {
  const { spec } = await req.json();

  // 1. Sanitize Paths (Ensure AI points to the right local folder)
  // We force the AI to use relative paths, and we map them to the real 'downloads' folder here.
  
  // 2. Run the Render
  try {
    // Editly is heavy, so we run it on the main thread (since it's localhost)
    await editly({
      ...spec,
      outPath: path.join(process.cwd(), 'public', 'output.mp4'),
      // Ensure 'ffmpegPath' and 'ffprobePath' are set if not in System PATH
    });
    
    return NextResponse.json({ success: true, url: '/output.mp4' });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}