import { useTimelineStore } from '../store/timelineStore';
import { TimelineRuler } from './TimelineRuler';
import { TrackHeader } from './TrackHeader';
import { TrackClips } from './TrackClips';
import { useEffect, useRef } from 'react';

export function Timeline() {
  const { tracks, addTrack, setScrollX } = useTimelineStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tracks.length === 0) {
      addTrack('video', 'V1');
      addTrack('video', 'V2');
      addTrack('audio', 'A1');
      addTrack('audio', 'A2');
    }
  }, [tracks, addTrack]);

  const handleScroll = () => {
    if (scrollRef.current) {
      setScrollX(scrollRef.current.scrollLeft);
    }
  };

  return (
    <div className="h-full flex flex-col relative bg-[#111] select-none">
      <TimelineRuler />
      <div 
        ref={scrollRef}
        className="flex-1 overflow-auto mt-8 relative"
        onScroll={handleScroll}
      >
        <div className="min-h-full flex flex-col space-y-px pb-8">
          {tracks.map(track => (
            <div key={track.id} className="w-full bg-zinc-900 flex group" style={{ height: track.height }}>
              <TrackHeader track={track} />
              <div className="flex-1 relative bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVQIW2NkYGD4z8DAwMgAI0AMCKcCBXY/jB0AAAAASUVORK5CYII=')] bg-repeat">
                <TrackClips trackId={track.id} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
