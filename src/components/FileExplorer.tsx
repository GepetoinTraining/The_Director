import React, { useEffect, useState } from 'react';
import { Folder, FileVideo, RefreshCw } from 'lucide-react';

export default function FileExplorer() {
  const [tree, setTree] = useState<any>(null);
  
  const fetchFiles = async () => {
    const res = await fetch('/api/files');
    const data = await res.json();
    setTree(data);
  };

  useEffect(() => { fetchFiles(); }, []);

  const FileNode = ({ node }: { node: any }) => (
    <div className="pl-3">
      <div className="flex items-center gap-2 py-1 text-sm text-zinc-400 hover:text-zinc-100 cursor-pointer">
        {node.type === 'folder' ? <Folder className="w-3 h-3 text-blue-500" /> : <FileVideo className="w-3 h-3 text-purple-500" />}
        <span className="truncate">{node.name}</span>
      </div>
      {node.children && (
        <div className="border-l border-zinc-800 ml-1.5">
          {node.children.map((child: any, i: number) => <FileNode key={i} node={child} />)}
        </div>
      )}
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      <div className="p-2 border-b border-zinc-800 flex justify-between items-center">
        <span className="text-xs font-bold text-zinc-500">PROJECT ASSETS</span>
        <button onClick={fetchFiles}><RefreshCw className="w-3 h-3 text-zinc-600 hover:text-white" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {tree?.downloads && (
          <div className="mb-4">
            <div className="text-xs text-zinc-500 mb-2 font-mono">/DOWNLOADS</div>
            {tree.downloads.map((node: any, i: number) => <FileNode key={i} node={node} />)}
          </div>
        )}
        {tree?.renders && (
          <div>
            <div className="text-xs text-zinc-500 mb-2 font-mono">/RENDERS</div>
            {tree.renders.map((node: any, i: number) => <FileNode key={i} node={node} />)}
          </div>
        )}
      </div>
    </div>
  );
}