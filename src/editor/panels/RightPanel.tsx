import { useEditorStore } from '../store/editorStore';
import { useTimelineStore } from '../store/timelineStore';
import { VideoInspector } from '../inspector/VideoInspector';

export function RightPanel() {
  const { selectedClipIds } = useEditorStore();
  const { clips } = useTimelineStore();
  
  const selectedClips = clips.filter(c => selectedClipIds.includes(c.id));
  const activeClip = selectedClips[0];

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a]">
      <div className="p-3 border-b border-zinc-800 bg-[#111]">
        <h2 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
          {activeClip ? `\${activeClip.type} Inspector` : 'Inspector'}
        </h2>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {!activeClip ? (
          <div className="flex h-full items-center justify-center p-6 text-center">
            <span className="text-zinc-500 text-sm">Select a clip to edit its properties</span>
          </div>
        ) : (
          <div className="p-0">
            {activeClip.type === 'video' && <VideoInspector clip={activeClip} />}
            {activeClip.type !== 'video' && (
              <div className="p-4 text-zinc-400 text-sm text-center">
                Properties for {activeClip.type} clips
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
