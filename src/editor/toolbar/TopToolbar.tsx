import { Play, Pause, FastForward, Rewind, Download, Settings, MousePointer2, Scissors, Hand } from 'lucide-react';
import { toast } from 'sonner';
import { useEditorStore } from '../store/editorStore';
import { useTimelineStore } from '../store/timelineStore';

export function TopToolbar() {
  const { activeTool, setActiveTool, isPlaying, setIsPlaying, activeWorkspace, setActiveWorkspace } = useEditorStore();
  const { undo, redo } = useTimelineStore((state: any) => ({ undo: () => {}, redo: () => {} })); // mock

  const tools = [
    { id: 'select', icon: MousePointer2, label: 'Select (V)' },
    { id: 'razor', icon: Scissors, label: 'Razor (C)' },
    { id: 'hand', icon: Hand, label: 'Hand (H)' },
  ] as const;

  const workspaces = [
    { id: 'edit', label: 'Edit' },
    { id: 'color', label: 'Color' },
    { id: 'audio', label: 'Audio' },
    { id: 'captions', label: 'Captions' },
  ] as const;

  const handleExport = () => {
    toast.success('Export started!');
  };

  return (
    <div className="h-12 border-b border-zinc-800 bg-[#0a0a0a] flex items-center justify-between px-4 flex-shrink-0">
      <div className="flex items-center space-x-4">
        <div className="flex bg-zinc-900 rounded-md p-1 border border-zinc-800">
          {workspaces.map(ws => (
            <button
              key={ws.id}
              onClick={() => setActiveWorkspace(ws.id)}
              className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${activeWorkspace === ws.id ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
            >
              {ws.label}
            </button>
          ))}
        </div>
        
        <div className="h-4 w-px bg-zinc-800 mx-2" />
        
        <div className="flex space-x-1">
          {tools.map(tool => (
            <button
              key={tool.id}
              onClick={() => setActiveTool(tool.id)}
              className={`p-1.5 rounded-md transition-colors ${activeTool === tool.id ? 'bg-[#E60000] text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
              title={tool.label}
            >
              <tool.icon className="w-4 h-4" />
            </button>
          ))}
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
        <button className="p-1.5 text-zinc-400 hover:text-white rounded-md hover:bg-zinc-800 transition-colors">
          <Settings className="w-4 h-4" />
        </button>
        <button onClick={handleExport} className="bg-[#E60000] hover:bg-[#CC0000] text-white px-4 py-1.5 rounded-md text-sm font-medium flex items-center space-x-2 transition-colors">
          <Download className="w-4 h-4" />
          <span>Export</span>
        </button>
      </div>
    </div>
  );
}
