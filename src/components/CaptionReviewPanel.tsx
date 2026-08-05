import { useMemo, useState } from "react";
import { AlertTriangle, ClipboardList, Search, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

interface WordTiming { text: string; start: number; end: number }
export interface ReviewSegment { start: number; end: number; text: string; confidence?: number; words?: WordTiming[] }

const fmt = (s: number) => {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60), ms = Math.floor((s % 1) * 100);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(ms).padStart(2, "0")}`;
};

type Flag = { kind: "empty" | "short" | "long" | "fast" | "slow" | "lowconf" | "dup" | "artifact"; label: string };
const flagsFor = (s: ReviewSegment, prev?: ReviewSegment): Flag[] => {
  const out: Flag[] = [];
  const text = (s.text ?? "").trim();
  const dur = Math.max(0, s.end - s.start);
  const wc = text ? text.split(/\s+/).length : 0;
  if (!text) out.push({ kind: "empty", label: "Empty" });
  if (dur > 0 && dur < 0.35) out.push({ kind: "short", label: "Very short" });
  if (dur > 8) out.push({ kind: "long", label: "Very long" });
  if (wc > 0 && dur > 0) {
    const wps = wc / dur;
    if (wps > 6) out.push({ kind: "fast", label: "Fast speech" });
    if (wps < 0.6 && wc > 2) out.push({ kind: "slow", label: "Slow / gap" });
  }
  if (typeof s.confidence === "number" && s.confidence < 0.6) out.push({ kind: "lowconf", label: `Low conf ${(s.confidence * 100).toFixed(0)}%` });
  if (prev && text && prev.text.trim() === text) out.push({ kind: "dup", label: "Duplicate of prev" });
  if (/[�]|(.)\1{4,}/.test(text)) out.push({ kind: "artifact", label: "Artifact" });
  return out;
};

interface Props {
  segs: ReviewSegment[];
  activeIdx: number;
  onSeek: (t: number) => void;
  onEditText: (i: number, text: string) => void;
}

export function CaptionReviewPanel({ segs, activeIdx, onSeek, onEditText }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [onlyIssues, setOnlyIssues] = useState(false);

  const rows = useMemo(() => segs.map((s, i) => ({ s, i, flags: flagsFor(s, segs[i - 1]) })), [segs]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter(({ s, flags }) => {
      if (onlyIssues && flags.length === 0) return false;
      if (needle && !s.text.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [rows, q, onlyIssues]);
  const issueCount = rows.reduce((a, r) => a + (r.flags.length ? 1 : 0), 0);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          title="Review captions"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs font-semibold text-foreground hover:border-primary/50 hover:text-primary"
        >
          <ClipboardList className="h-3.5 w-3.5" />
          Review
          {issueCount > 0 && (
            <span className="ml-1 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-300">
              {issueCount}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border/60 p-4">
          <SheetTitle className="flex items-center gap-2 text-sm">
            <ClipboardList className="h-4 w-4 text-primary" />
            Caption review
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              {segs.length} segments · {issueCount} flagged
            </span>
          </SheetTitle>
          <div className="mt-3 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search text…"
                className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-2 text-xs outline-none focus:border-primary"
              />
              {q && (
                <button onClick={() => setQ("")} className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5 text-xs">
              <input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} className="h-3 w-3 accent-primary" />
              Issues only
            </label>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">No segments match.</div>
          ) : (
            <ul className="flex flex-col gap-2">
              {filtered.map(({ s, i, flags }) => (
                <li
                  key={i}
                  className={`rounded-lg border p-2.5 transition ${
                    i === activeIdx ? "border-primary/60 bg-primary/5" : "border-border/60 bg-card/40 hover:border-border"
                  }`}
                >
                  <div className="flex items-center gap-2 text-[11px] font-mono tabular-nums text-muted-foreground">
                    <button
                      onClick={() => { onSeek(s.start); setOpen(false); }}
                      className="rounded bg-background px-1.5 py-0.5 font-semibold text-foreground hover:text-primary"
                      title="Jump to segment"
                    >
                      #{i + 1} · {fmt(s.start)} → {fmt(s.end)}
                    </button>
                    <span>· {(s.end - s.start).toFixed(2)}s</span>
                    {flags.length > 0 && (
                      <span className="ml-auto inline-flex items-center gap-1 text-amber-600 dark:text-amber-300">
                        <AlertTriangle className="h-3 w-3" />
                        {flags.map((f) => f.label).join(" · ")}
                      </span>
                    )}
                  </div>
                  <textarea
                    value={s.text}
                    onChange={(e) => onEditText(i, e.target.value)}
                    rows={Math.min(3, Math.max(1, Math.ceil((s.text.length || 1) / 60)))}
                    className="mt-2 w-full resize-none rounded-md border border-border/60 bg-background p-2 text-sm outline-none focus:border-primary"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default CaptionReviewPanel;
