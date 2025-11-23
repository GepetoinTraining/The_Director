import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const getDirectoryStructure = (dir: string) => {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  return items.map((item) => {
    const fullPath = path.join(dir, item.name);
    return {
      name: item.name,
      type: item.isDirectory() ? 'folder' : 'file',
      path: fullPath,
      children: item.isDirectory() ? getDirectoryStructure(fullPath) : undefined,
    };
  });
};

export async function GET() {
  try {
    const downloads = getDirectoryStructure(path.join(process.cwd(), 'downloads'));
    const renders = getDirectoryStructure(path.join(process.cwd(), 'public/renders'));
    
    return NextResponse.json({ downloads, renders });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to scan files' }, { status: 500 });
  }
}