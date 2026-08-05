import { useMemo, useState } from "react";
import { GitCompare, Loader2, Play, CheckCircle2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { invokeWithRetry } from "@/lib/invokeWithRetry";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

interface WordTiming { text: string; start: number; end: number; confidence?: number }
export interface CmpSegment { start: number; end: number; text: string; confidence?: number; words?: WordTiming[] }
export interface CmpCaption { id: string; provider: string | null; segments: CmpSegment[] }

const fmt = (s: number) => {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

const PROVIDERS: { id: "deepgram" | "assemblyai"; label: string; model: string }[] = [
  { id: "deepgram", label: "Model A", model: "nova-2" },
  { id: "assemblyai", label: "AssemblyAI", model: "best" },
];

// Pair segments by nearest start time.
function pair(a: CmpSegment[], b: CmpSegment[]) {
  const rows: { a?: CmpSegment; b?: CmpSegment; t: number }[] = [];
  const bUsed = new Set<number>();
  for (const s of a) {
    let best = -1, bestD = Infinity;
    for (let j = 0; j < b.length; j++) {
      if (bUsed.has(j)) continue;
      const d = Math.abs(b[j].start - s.start);
      if (d < bestD) { bestD = d; best = j; }
    }
    if (best >= 0 && bestD <= 1.5) {
      bUsed.add(best);
      rows.push({ a: s, b: b[best], t: s.start });
    } else {
      rows.push({ a: s, t: s.start });
    }
  }
  for (let j = 0; j < b.length; j++) if (!bUsed.has(j)) rows.push({ b: b[j], t: b[j].start });
  return rows.sort((x, y) => x.t - y.t);
}

function diffText(a: string, b: string): string[] {
  const tokA = a.split(/\s+/), tokB = b.split(/\s+/);
  const set = new Set(tokB.map((w) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")));
  return tokA.map((w) => (set.has(w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")) ? w : `~${w}`));
}

interface Props {
  projectId: string;
  sourceLanguage: string;
  compareMode: boolean;
  chosenProvider: string | null;
  captions: CmpCaption[]; // captions for the source language
  onSeek: (t: number) => void;
  onRefresh: () => void;
  onFlagLowConfidence?: (times: number[]) => void;
}

export function TranscribeCompare({ projectId, sourceLanguage, compareMode, chosenProvider, captions, onSeek, onRefresh, onFlagLowConfidence }: Props) {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState<string | null>(null);

  const byProvider = useMemo(() => {
    const m = new Map<string, CmpCaption>();
    for (const c of captions) if (c.provider) m.set(c.provider, c);
    return m;
  }, [captions]);

  const dg = byProvider.get("deepgram");
  const aa = byProvider.get("assemblyai");
  const rows = useMemo(() => pair(dg?.segments ?? [], aa?.segments ?? []), [dg, aa]);

  const runProvider = async (id: "deepgram" | "assemblyai") => {
    if (running) return;
    setRunning(id);
    try {
      if (!compareMode) {
        const { error } = await supabase.from("projects").update({ compare_mode: true }).eq("id", projectId);
        if (error) throw error;
      }
      // Drop any existing row for this provider+language to avoid duplicates on re-run.
      await supabase.from("captions").delete()
        .eq("project_id", projectId).eq("language", sourceLanguage).eq("provider", id);
      const { error } = await invokeWithRetry("transcribe", { body: { project_id: projectId, provider: id } });
      if (error) throw error;
      toast.success(`${id} transcription queued`);
      setTimeout(onRefresh, 1500);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to run provider");
    } finally {
      setRunning(null);
    }
  };

  const choose = async (id: "deepgram" | "assemblyai") => {
    const { error } = await supabase.from("projects").update({ chosen_provider: id }).eq("id", projectId);
    if (error) { toast.error(error.message); return; }
    toast.success(`Using ${id} captions`);
    onRefresh();
  };

  // Low-confidence rows: text mismatch, missing pair, low provider confidence, or >120ms
  // word-drift on any matched token. These are the segments worth reviewing manually.
  const normTok = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const lowConfidenceRows = useMemo(() => rows.filter((r) => {
    if (!r.a || !r.b) return true;
    if (r.a.text.trim().toLowerCase() !== r.b.text.trim().toLowerCase()) return true;
    if ((r.a.confidence ?? 1) < 0.75 || (r.b.confidence ?? 1) < 0.75) return true;
    const wa = r.a.words ?? [], wb = r.b.words ?? [];
    if (wa.length && wb.length) {
      for (const w of wa) {
        const m = wb.find((o) => normTok(o.text) === normTok(w.text));
        if (!m || Math.abs((m.start - w.start) * 1000) > 120) return true;
      }
    }
    return false;
  }), [rows]);
  const totalIssues = lowConfidenceRows.length;

  const flagLowConfidence = () => {
    if (!onFlagLowConfidence) return;
    const times = lowConfidenceRows.map((r) => r.t);
    onFlagLowConfidence(times);
    toast.success(`Flagged ${times.length} segment${times.length === 1 ? "" : "s"} for review`);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          title="Compare transcription providers"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs font-semibold text-foreground hover:border-primary/50 hover:text-primary"
        >
          <GitCompare className="h-3.5 w-3.5" />
          Compare providers
          {totalIssues > 0 && (
            <span className="ml-1 rounded-full bg-warning/20 px-1.5 py-0.5 text-[10px] font-bold text-warning-600 dark:text-warning">
              {totalIssues}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-3xl">
        <SheetHeader className="border-b border-border/60 p-4">
          <SheetTitle className="flex items-center gap-2 text-sm">
            <GitCompare className="h-4 w-4 text-primary" />
            Transcription providers
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              {totalIssues} low-confidence segments
            </span>
          </SheetTitle>
          {onFlagLowConfidence && totalIssues > 0 && (
            <div className="mt-2 flex items-center justify-between rounded-md border border-warning/40 bg-warning/10 px-3 py-2">
              <div className="text-[11px] text-warning dark:text-warning">
                {totalIssues} segment{totalIssues === 1 ? "" : "s"} need review (mismatch, low confidence, or &gt;120ms drift).
              </div>
              <button
                onClick={flagLowConfidence}
                className="inline-flex items-center gap-1 rounded-md bg-warning px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-warning/90"
              >
                Flag &amp; open in editor
              </button>
            </div>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            {PROVIDERS.map((p) => {
              const has = byProvider.has(p.id);
              const isChosen = chosenProvider === p.id;
              return (
                <div key={p.id} className={`rounded-lg border p-3 ${isChosen ? "border-primary/60 bg-primary/5" : "border-border/60 bg-card/40"}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{p.label}</span>
                    <span className="rounded bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">{p.model}</span>
                    {isChosen && <CheckCircle2 className="ml-auto h-4 w-4 text-primary" />}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {has ? `${byProvider.get(p.id)!.segments.length} segments` : "Not run yet"}
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    <button
                      onClick={() => runProvider(p.id)}
                      disabled={!!running}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-semibold hover:border-primary/50 disabled:opacity-60"
                    >
                      {running === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : has ? <RefreshCw className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                      {has ? "Re-run" : "Run"}
                    </button>
                    {has && !isChosen && (
                      <button
                        onClick={() => choose(p.id)}
                        className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90"
                      >
                        Use this
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {!dg || !aa ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              Run both providers above to see a segment-by-segment comparison.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-background/95 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-16 py-2 text-left font-medium">Time</th>
                  <th className="py-2 text-left font-medium" colSpan={2}>
                    <div className="flex flex-wrap items-center gap-3">
                      <span>Word-level timing · amber outline = drift &gt;120ms or unmatched</span>
                      <span className="flex items-center gap-1 normal-case tracking-normal">
                        <span>confidence:</span>
                        <span className="inline-block h-2 w-4 rounded-sm" style={{ background: "rgb(34 197 94 / 0.9)" }} />≥90%
                        <span className="ml-1 inline-block h-2 w-4 rounded-sm" style={{ background: "rgb(217 119 6 / 0.9)" }} />75–90%
                        <span className="ml-1 inline-block h-2 w-4 rounded-sm" style={{ background: "rgb(239 68 68 / 0.9)" }} />&lt;75%
                        <span className="ml-1 inline-block h-2 w-4 rounded-sm" style={{ background: "rgb(148 163 184 / 0.7)" }} />n/a
                      </span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const mismatch = !!(r.a && r.b) && r.a.text.trim().toLowerCase() !== r.b.text.trim().toLowerCase();
                  const missing = !r.a || !r.b;
                  const aDiff = r.a && r.b ? diffText(r.a.text, r.b.text) : null;
                  const bDiff = r.a && r.b ? diffText(r.b.text, r.a.text) : null;

                  // Shared timeline range for word-level overlay.
                  const wordsA = r.a?.words ?? [];
                  const wordsB = r.b?.words ?? [];
                  const allW = [...wordsA, ...wordsB];
                  const t0 = allW.length ? Math.min(...allW.map((w) => w.start), r.a?.start ?? Infinity, r.b?.start ?? Infinity) : r.t;
                  const t1 = allW.length ? Math.max(...allW.map((w) => w.end), r.a?.end ?? -Infinity, r.b?.end ?? -Infinity) : r.t + 1;
                  const span = Math.max(0.001, t1 - t0);
                  const pct = (t: number) => `${((t - t0) / span) * 100}%`;

                  // Detect per-word misalignment: same token, but start-time drift > 120ms.
                  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
                  const driftMs = (wa: WordTiming) => {
                    const match = wordsB.find((wb) => norm(wb.text) === norm(wa.text));
                    return match ? Math.abs((match.start - wa.start) * 1000) : null;
                  };

                  const confColor = (c: number | undefined) => {
                    if (c == null) return "rgb(148 163 184 / 0.7)"; // slate — unknown
                    if (c >= 0.9) return "rgb(34 197 94 / 0.9)";    // green
                    if (c >= 0.75) return "rgb(217 119 6 / 0.9)";   // amber
                    return "rgb(239 68 68 / 0.9)";                   // red
                  };

                  const renderTrack = (words: WordTiming[], other: WordTiming[], color: string) => (
                    <div className="relative h-7 w-full rounded bg-muted/30">
                      {words.map((w, k) => {
                        const match = other.find((o) => norm(o.text) === norm(w.text));
                        const drift = match ? Math.abs((match.start - w.start) * 1000) : null;
                        const bad = drift == null || drift > 120;
                        const conf = w.confidence;
                        const confPct = conf != null ? Math.max(6, Math.min(100, conf * 100)) : 0;
                        // Higher-confidence peer wins on this word; show a tiny arrow if this side is worse.
                        const worse = match && conf != null && match.confidence != null && match.confidence - conf > 0.08;
                        return (
                          <button
                            key={k}
                            onClick={() => { onSeek(w.start); setOpen(false); }}
                            title={`${w.text} · ${w.start.toFixed(2)}s${drift != null ? ` · Δ${Math.round(drift)}ms` : " · no match"}${conf != null ? ` · conf ${(conf * 100).toFixed(0)}%` : ""}${worse ? " · peer more confident" : ""}`}
                            className={`absolute top-0.5 flex flex-col overflow-hidden rounded-sm text-[9px] leading-3 text-foreground/95 hover:ring-1 hover:ring-primary ${bad ? "ring-1 ring-warning/70" : ""}`}
                            style={{
                              left: pct(w.start),
                              height: "24px",
                              width: `max(8px, calc(${((w.end - w.start) / span) * 100}% ))`,
                              background: bad ? "rgb(217 119 6 / 0.85)" : color,
                            }}
                          >
                            <span className="flex-1 truncate px-1 pt-0.5 align-top">
                              {worse ? <span className="mr-0.5 text-warning-200">↓</span> : null}{w.text}
                            </span>
                            {/* Per-word confidence bar */}
                            <span
                              aria-hidden
                              className="block h-[3px] w-full rounded-b-sm"
                              style={{
                                background: `linear-gradient(to right, ${confColor(conf)} ${confPct}%, rgba(255,255,255,0.15) ${confPct}%)`,
                              }}
                            />
                          </button>
                        );
                      })}
                    </div>
                  );

                  return (
                    <tr
                      key={i}
                      className={`border-b border-border/40 align-top ${mismatch ? "bg-warning/5" : missing ? "bg-destructive/5" : ""}`}
                    >
                      <td className="py-2 pr-2">
                        <button
                          onClick={() => { onSeek(r.t); setOpen(false); }}
                          className="rounded bg-background px-1.5 py-0.5 font-mono tabular-nums text-[11px] hover:text-primary"
                        >
                          {fmt(r.t)}
                        </button>
                      </td>
                      <td className="py-2 pr-3" colSpan={2}>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="w-16 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Model A</span>
                            <div className="min-w-0 flex-1">
                              {r.a ? (
                                wordsA.length ? renderTrack(wordsA, wordsB, "hsl(var(--primary) / 0.85)") : (
                                  <div className="text-[11px]">
                                    {aDiff ? aDiff.map((w, k) => (
                                      <span key={k} className={w.startsWith("~") ? "rounded bg-warning/20 px-0.5 text-warning dark:text-warning" : ""}>
                                        {w.replace(/^~/, "")}{" "}
                                      </span>
                                    )) : r.a.text}
                                  </div>
                                )
                              ) : <span className="italic text-[11px] text-muted-foreground">— missing —</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-16 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">AssemblyAI</span>
                            <div className="min-w-0 flex-1">
                              {r.b ? (
                                wordsB.length ? renderTrack(wordsB, wordsA, "rgb(59 130 246 / 0.85)") : (
                                  <div className="text-[11px]">
                                    {bDiff ? bDiff.map((w, k) => (
                                      <span key={k} className={w.startsWith("~") ? "rounded bg-warning/20 px-0.5 text-warning dark:text-warning" : ""}>
                                        {w.replace(/^~/, "")}{" "}
                                      </span>
                                    )) : r.b.text}
                                  </div>
                                )
                              ) : <span className="italic text-[11px] text-muted-foreground">— missing —</span>}
                            </div>
                          </div>
                          {wordsA.length > 0 && wordsB.length > 0 && (() => {
                            const drifts = wordsA.map(driftMs).filter((d): d is number => d != null);
                            const avg = drifts.length ? Math.round(drifts.reduce((a, b) => a + b, 0) / drifts.length) : 0;
                            const worst = drifts.length ? Math.round(Math.max(...drifts)) : 0;
                            return (
                              <div className="ml-[68px] flex gap-3 text-[10px] text-muted-foreground">
                                <span>avg drift <b className={avg > 120 ? "text-warning" : "text-foreground"}>{avg}ms</b></span>
                                <span>max <b className={worst > 250 ? "text-warning" : "text-foreground"}>{worst}ms</b></span>
                                <span>{drifts.length}/{wordsA.length} matched</span>
                              </div>
                            );
                          })()}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default TranscribeCompare;
