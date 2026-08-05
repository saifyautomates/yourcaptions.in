import { useTimelineStore } from '../store/timelineStore';
import { useEditorStore } from '../store/editorStore';

export function CanvasOverlay() {
  const { currentTime } = useEditorStore();
  const { clips } = useTimelineStore();
  
  const overlayClips = clips.filter(c => 
    (c.type === 'text' || c.type === 'shape' || c.type === 'caption') &&
    c.startTime <= currentTime && c.startTime + c.duration > currentTime
  );

  if (overlayClips.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {overlayClips.map(clip => (
        <div 
          key={clip.id} 
          className="absolute text-white font-bold"
          style={{
            left: `${clip.transform.x * 100}%`,
            top: `${clip.transform.y * 100}%`,
            transform: `translate(-50%, -50%) scale(${clip.transform.scaleX})`,
            opacity: clip.opacity
          }}
        >
          {clip.type === 'text' ? clip.textSettings?.content : 'O'}
        </div>
      ))}
    </div>
  );
}
