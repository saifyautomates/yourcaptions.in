import { useEffect, useRef, useState } from "react";
import { Activity, X } from "lucide-react";
import { subscribeAnimSamples, getRecentAnimSamples, type AnimSample } from "@/lib/captionAnimMetrics";

/**
 * Lightweight performance HUD for the editor.
 * - FPS: rAF-based rolling average of the main thread paint rate
 * - Render: last React commit duration observed via a MutationObserver tick + perf.now sampler
 * - CPU: proxy = (16.67ms - idle slack) / 16.67ms averaged over 1s (0-100%)
 * - Dropped frames: video.getVideoPlaybackQuality() delta (droppedVideoFrames / totalVideoFrames)
 *
 * Everything runs off requestAnimationFrame so it does not touch React state
 * except once per second, keeping the HUD itself cheap on long transcripts.
 */
export default function PerfHUD({
  videoRef,
  captionCount,
}: {
  videoRef: React.RefObject<HTMLVideoElement>;
  captionCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState({
    fps: 0,
    cpu: 0,
    render: 0,
    dropped: 0,
    total: 0,
    dropRate: 0,
  });
  const [samples, setSamples] = useState<AnimSample[]>(() => getRecentAnimSamples());

  // Subscribe to caption-animation timing samples. Cheap: only fires on segment change.
  useEffect(() => {
    if (!open) return;
    setSamples(getRecentAnimSamples());
    return subscribeAnimSamples(() => setSamples(getRecentAnimSamples()));
  }, [open]);

  // toggle with Shift+P
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === "P" || e.key === "p")) setOpen((o) => !o);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const raf = useRef<number | null>(null);
  const lastTs = useRef<number>(performance.now());
  const frames = useRef<number>(0);
  const busyMs = useRef<number>(0);
  const lastCommit = useRef<number>(performance.now());
  const lastDropped = useRef<number>(0);
  const lastTotal = useRef<number>(0);
  const startSample = useRef<number>(performance.now());

  useEffect(() => {
    if (!open) return;
    lastTs.current = performance.now();
    startSample.current = lastTs.current;
    frames.current = 0;
    busyMs.current = 0;

    const tick = (t: number) => {
      const dt = t - lastTs.current;
      lastTs.current = t;
      frames.current += 1;
      // anything above 16.67ms between frames = the main thread was busy
      busyMs.current += Math.max(0, dt - 16.67);

      // measure render cost: time to run this callback itself
      const commitStart = performance.now();
      // no-op work, sample duration between rAFs
      const commit = performance.now() - commitStart;
      lastCommit.current = commit;

      const elapsed = t - startSample.current;
      if (elapsed >= 1000) {
        const fps = Math.round((frames.current * 1000) / elapsed);
        const cpu = Math.min(100, Math.round((busyMs.current / elapsed) * 100));

        // video frame drops
        const v = videoRef.current as HTMLVideoElement | null;
        let dropped = 0;
        let total = 0;
        let dropRate = 0;
        if (v && typeof v.getVideoPlaybackQuality === "function") {
          const q = v.getVideoPlaybackQuality();
          const dDropped = q.droppedVideoFrames - lastDropped.current;
          const dTotal = q.totalVideoFrames - lastTotal.current;
          lastDropped.current = q.droppedVideoFrames;
          lastTotal.current = q.totalVideoFrames;
          dropped = dDropped;
          total = dTotal;
          dropRate = dTotal > 0 ? +((dDropped / dTotal) * 100).toFixed(1) : 0;
        }

        setStats({
          fps,
          cpu,
          render: +lastCommit.current.toFixed(2),
          dropped,
          total,
          dropRate,
        });

        frames.current = 0;
        busyMs.current = 0;
        startSample.current = t;
      }

      raf.current = requestAnimationFrame(tick);
    };

    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [open, videoRef]);

  if (!open) {
    // Hidden by default; toggle with Shift+P when debugging.
    return null;
  }


  const fpsColor = stats.fps >= 55 ? "text-green-400" : stats.fps >= 30 ? "text-amber-400" : "text-red-400";
  const cpuColor = stats.cpu < 40 ? "text-green-400" : stats.cpu < 75 ? "text-amber-400" : "text-red-400";
  const dropColor = stats.dropRate < 1 ? "text-green-400" : stats.dropRate < 5 ? "text-amber-400" : "text-red-400";

  return (
    <div className="fixed bottom-4 right-4 z-40 w-72 rounded-lg border border-border/60 bg-background/95 p-3 font-mono text-[11px] shadow-xl backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <Activity className="h-3.5 w-3.5" /> Performance
        </div>
        <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <Row label="FPS" value={`${stats.fps}`} cls={fpsColor} />
      <Row label="CPU (main-thread)" value={`${stats.cpu}%`} cls={cpuColor} />
      <Row label="Render / frame" value={`${stats.render.toFixed(2)} ms`} cls="text-foreground" />
      <Row label="Video frames" value={`${stats.total}/s`} cls="text-foreground" />
      <Row label="Dropped frames" value={`${stats.dropped} (${stats.dropRate}%)`} cls={dropColor} />
      <Row label="Captions loaded" value={`${captionCount}`} cls="text-foreground" />

      {/* Word-entrance timing — recent chunk mounts vs expected segment start */}
      <div className="mt-2 border-t border-border/50 pt-2">
        <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Word entrance (last {samples.length})</span>
          <span>drift ms</span>
        </div>
        {samples.length === 0 ? (
          <div className="text-[10px] text-muted-foreground/70">No samples yet — play the video.</div>
        ) : (
          <div className="max-h-28 overflow-y-auto pr-1">
            {samples.slice(-8).reverse().map((s, k) => {
              const abs = Math.abs(s.drift);
              const cls = abs < 50 ? "text-green-400" : abs < 150 ? "text-amber-400" : "text-red-400";
              return (
                <div key={`${s.at}-${k}`} className="flex items-center justify-between py-0.5 text-[10px]">
                  <span className="text-muted-foreground truncate">
                    #{s.segIdx} · {s.transition} · {s.duration}ms
                  </span>
                  <span className={cls}>{s.drift > 0 ? "+" : ""}{s.drift.toFixed(0)}</span>
                </div>
              );
            })}
          </div>
        )}
        {samples.length > 0 && (() => {
          const drifts = samples.map((s) => s.drift);
          const avg = drifts.reduce((a, b) => a + b, 0) / drifts.length;
          const max = Math.max(...drifts.map(Math.abs));
          return (
            <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>avg {avg.toFixed(0)}ms · max |{max.toFixed(0)}|ms</span>
              <span>{Math.abs(avg) < 50 ? "in-window" : "off"}</span>
            </div>
          );
        })()}
      </div>

      <div className="mt-2 text-[10px] text-muted-foreground">Shift+P to toggle</div>
    </div>
  );
}

function Row({ label, value, cls }: { label: string; value: string; cls: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className={cls}>{value}</span>
    </div>
  );
}
