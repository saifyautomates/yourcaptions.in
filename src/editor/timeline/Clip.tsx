import { Clip } from '../types/editor.types';
import { useTimelineStore } from '../store/timelineStore';
import { useEditorStore } from '../store/editorStore';

interface Props {
  clip: Clip;
}

export function ClipComponent({ clip }: Props) {
  const { zoom, scrollX } = useTimelineStore();
  const { selectedClipIds, selectClip } = useEditorStore();
  
  const isSelected = selectedClipIds.includes(clip.id);
  
  const left = clip.startTime * zoom - scrollX;
  const width = clip.duration * zoom;

  const getClipColor = () => {
    switch (clip.type) {
      case 'video': return 'bg-blue-600';
      case 'audio': return 'bg-green-600';
      case 'text': return 'bg-purple-600';
      case 'caption': return 'bg-pink-600';
      default: return 'bg-zinc-600';
    }
  };

  return (
    <div 
      className={`absolute top-0.5 bottom-0.5 rounded shadow-sm border overflow-hidden cursor-pointer ${getClipColor()} ${isSelected ? 'border-white z-10 opacity-100 ring-2 ring-white/50' : 'border-black/50 opacity-90 hover:opacity-100'}`}
      style={{ left: `${left}px`, width: `${width}px` }}
      onClick={(e) => {
        e.stopPropagation();
        selectClip(clip.id, e.shiftKey || e.metaKey || e.ctrlKey);
      }}
    >
      <div className="px-2 py-1 text-[10px] font-medium text-white truncate drop-shadow-md">
        {clip.type} clip
      </div>
      
      {/* Handles for trimming */}
      <div className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/30" />
      <div className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/30" />
    </div>
  );
}
