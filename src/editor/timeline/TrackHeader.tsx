import { Track } from '../types/editor.types';
import { useTimelineStore } from '../store/timelineStore';
import { useEditorStore } from '../store/editorStore';
import { Volume2, VolumeX, Eye, EyeOff, Lock, Unlock } from 'lucide-react';

interface Props {
  track: Track;
}

export function TrackHeader({ track }: Props) {
  const { toggleMute, toggleSolo, toggleLock, toggleVisibility } = useTimelineStore();
  const { selectedTrackId, selectTrack } = useEditorStore();
  
  const isSelected = selectedTrackId === track.id;

  return (
    <div 
      className={`w-48 border-r border-zinc-800 p-2 flex flex-col justify-center flex-shrink-0 cursor-pointer transition-colors ${isSelected ? 'bg-zinc-800' : 'bg-[#161616] hover:bg-zinc-800/50'}`}
      onClick={() => selectTrack(track.id)}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-zinc-300 truncate" title={track.name}>{track.name}</span>
        <div className="flex items-center space-x-1">
          {track.type === 'video' || track.type === 'overlay' || track.type === 'caption' ? (
            <button onClick={(e) => { e.stopPropagation(); toggleVisibility(track.id) }} className="text-zinc-500 hover:text-zinc-300">
              {track.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3 text-[#E60000]" />}
            </button>
          ) : (
            <button onClick={(e) => { e.stopPropagation(); toggleMute(track.id) }} className="text-zinc-500 hover:text-zinc-300">
              {track.muted ? <VolumeX className="w-3 h-3 text-[#E60000]" /> : <Volume2 className="w-3 h-3" />}
            </button>
          )}
          <button onClick={(e) => { e.stopPropagation(); toggleLock(track.id) }} className="text-zinc-500 hover:text-zinc-300">
            {track.locked ? <Lock className="w-3 h-3 text-[#E60000]" /> : <Unlock className="w-3 h-3" />}
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-zinc-500 uppercase tracking-widest">{track.type}</span>
        {track.type !== 'video' && track.type !== 'overlay' && track.type !== 'caption' && (
          <button 
            onClick={(e) => { e.stopPropagation(); toggleSolo(track.id) }} 
            className={`text-[9px] px-1 rounded ${track.solo ? 'bg-[#E60000] text-white' : 'bg-zinc-800 text-zinc-400'}`}
          >
            S
          </button>
        )}
      </div>
    </div>
  );
}
