import { memo, useMemo } from "react";
import { Eye, EyeOff, Target } from "lucide-react";
import type { Segment } from "@/lib/captionOps";

const fmt = (s: number) => {
  if (!isFinite(s)) return "0.00";
  return s.toFixed(2);
};

interface Props {
  open: boolean;
  onToggle: () => void;
  segs: Segment[];
  activeIdx: number;
  currentTime: number;
  onSeek: (t: number) => void;
}

/**
 * Word-timed caption preview strip.
 * Sits above the bottom timeline and shows the active segment's words
 * colour-coded by whether the playhead is before / inside / after each
 * word's timing window. Clicking a word scrubs the video to its start.
 */
export const WordTimingPreview = memo(({ open, onToggle, segs, activeIdx, currentTime, onSeek }: Props) => {
  const seg = activeIdx >= 0 ? segs[activeIdx] : null;

  const words = useMemo(() => {
    if (!seg) return [] as { text: string; start: number; end: number }[];
    if (seg.words && seg.words.length) return seg.words;
    // Fallback: proportional split when no per-word timings exist.
    const toks = seg.text.split(/\s+/).filter(Boolean);
    if (!toks.length) return [];
    const dur = Math.max(0.01, seg.end - seg.start);
    const step = dur / toks.length;
    return toks.map((t, i) => ({
      text: t,
      start: seg.start + i * step,
      end: seg.start + (i + 1) * step,
    }));
  }, [seg]);

  const activeWordIdx = useMemo(() => {
    if (!words.length) return -1;
    for (let i = 0; i < words.length; i++) {
      if (currentTime >= words[i].start && currentTime < words[i].end) return i;
    }
    return currentTime >= (words[words.length - 1]?.end ?? 0) ? words.length - 1 : -1;
  }, [words, currentTime]);

  const drift = activeWordIdx >= 0 ? (currentTime - words[activeWordIdx].start) * 1000 : 0;

  return (
    <div className="shrink-0 border-t border-border/60 bg-background/70">
      <div className="flex items-center gap-2 px-3 py-1.5">
        <button
          onClick={onToggle}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
            open ? "border-primary/60 bg-primary/15 text-primary" : "border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-primary"
          }`}
          title="Toggle word-timed preview"
        >
          {open ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          Word preview
        </button>
        {open && seg && (
          <>
            <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
              #{activeIdx + 1} · {fmt(seg.start)}s → {fmt(seg.end)}s
            </span>
            <span className="ml-auto inline-flex items-center gap-1 font-mono text-[10px] tabular-nums text-muted-foreground">
              <Target className="h-3 w-3 text-primary" />
              t={fmt(currentTime)}s
              {activeWordIdx >= 0 && (
                <span className={`ml-2 rounded px-1.5 py-0.5 ${Math.abs(drift) > 120 ? "bg-amber-500/20 text-amber-500" : "bg-green-500/15 text-green-500"}`}>
                  drift {drift >= 0 ? "+" : ""}{drift.toFixed(0)}ms
                </span>
              )}
            </span>
          </>
        )}
        {open && !seg && <span className="text-[11px] text-muted-foreground">No caption at playhead — scrub to a segment.</span>}
      </div>
      {open && seg && words.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 px-3 pb-2">
          {words.map((w, i) => {
            const past = currentTime >= w.end;
            const active = i === activeWordIdx;
            return (
              <button
                key={i}
                onClick={() => onSeek(w.start)}
                title={`${fmt(w.start)}s → ${fmt(w.end)}s`}
                className={`rounded-md border px-2 py-1 text-xs font-semibold transition ${
                  active
                    ? "border-primary bg-primary text-primary-foreground shadow-[0_0_0_2px_hsl(var(--primary)/0.25)]"
                    : past
                    ? "border-border/40 bg-muted/30 text-muted-foreground"
                    : "border-border/60 bg-card/60 text-foreground hover:border-primary/50 hover:text-primary"
                }`}
              >
                <span>{w.text}</span>
                <span className="ml-1.5 font-mono text-[9px] tabular-nums opacity-70">{fmt(w.start)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});
WordTimingPreview.displayName = "WordTimingPreview";

export default WordTimingPreview;
