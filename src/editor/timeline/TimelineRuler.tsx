import { useTimelineStore } from '../store/timelineStore';

export function TimelineRuler() {
  const { zoom, scrollX, getTotalDuration } = useTimelineStore();
  const duration = Math.max(60, getTotalDuration() + 10);
  
  const tickInterval = zoom < 20 ? 10 : zoom < 50 ? 5 : 1;
  const numTicks = Math.ceil(duration / tickInterval);
  
  return (
    <div className="absolute top-0 left-48 right-0 h-8 border-b border-zinc-800 bg-[#161616] overflow-hidden">
      <div className="relative h-full" style={{ width: `${duration * zoom}px`, transform: `translateX(-${scrollX}px)` }}>
        {Array.from({ length: numTicks }).map((_, i) => {
          const time = i * tickInterval;
          const formatTime = (s: number) => {
            const m = Math.floor(s / 60);
            const r = s % 60;
            return m > 0 ? `${m}:${r.toString().padStart(2, '0')}` : `${r}s`;
          };
          return (
            <div key={i} className="absolute top-0 bottom-0 border-l border-zinc-700" style={{ left: `${time * zoom}px` }}>
              <span className="absolute left-1 text-[9px] text-zinc-500 font-mono mt-0.5">{formatTime(time)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
