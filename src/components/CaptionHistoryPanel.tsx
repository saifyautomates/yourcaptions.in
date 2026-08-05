import { memo, useEffect, useState } from "react";
import { History, X, Undo2 } from "lucide-react";
import { formatHistoryTime } from "@/lib/capStyleDiff";

// A single history step, agnostic of which stack it lives in.
export type HistoryPanelEntry = {
  label: string;
  at: number;
  // Where in the stacks this entry sits — the panel needs this to call the
  // correct jump handler. "current" is the entry that matches the live
  // capStyle (highlighted, not clickable).
  kind: "past" | "current" | "future";
  // Index within its own stack (past[] / future[]). Ignored for "current".
  index: number;
};

interface Props {
  open: boolean;
  onClose: () => void;
  entries: HistoryPanelEntry[];
  onJumpPast: (index: number) => void;
  onJumpFuture: (index: number) => void;
}

// Floating panel pinned to the bottom-right of the viewport. Lists history
// steps oldest-first with the "current" row highlighted. Clicking any row
// jumps the editor to that state (a normal undo/redo can still walk one step
// at a time from there).
export const CaptionHistoryPanel = memo(function CaptionHistoryPanel({
  open, onClose, entries, onJumpPast, onJumpFuture,
}: Props) {
  // Re-render every 15s so "just now" / "2m ago" labels stay fresh while the
  // panel is open. Cheap — one setState, small list.
  const [, setNow] = useState(0);
  useEffect(() => {
    if (!open) return;
    const t = window.setInterval(() => setNow((n) => n + 1), 15_000);
    return () => window.clearInterval(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="Caption change history"
      className="fixed bottom-4 right-4 z-50 flex w-[320px] max-h-[60vh] flex-col overflow-hidden rounded-xl border border-border/70 bg-background/95 shadow-2xl backdrop-blur"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground">
          <History className="h-3.5 w-3.5 text-primary" />
          History
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close history"
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="px-3 py-6 text-center text-xs text-muted-foreground">
          No changes yet. Move the caption or tweak a style — every edit lands here.
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto py-1 text-xs">
          {entries.map((e, i) => {
            const isCurrent = e.kind === "current";
            const clickable = !isCurrent;
            return (
              <li key={`${e.kind}-${e.index}-${i}`}>
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() => {
                    if (e.kind === "past") onJumpPast(e.index);
                    else if (e.kind === "future") onJumpFuture(e.index);
                  }}
                  className={`group flex w-full items-center gap-2 px-3 py-1.5 text-left transition ${
                    isCurrent
                      ? "cursor-default bg-primary/10 text-primary"
                      : "text-foreground hover:bg-muted/40"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                      isCurrent ? "bg-primary" : e.kind === "future" ? "bg-muted-foreground/40" : "bg-muted-foreground/70"
                    }`}
                  />
                  <span className="flex-1 truncate">
                    {e.label}
                    {isCurrent ? <span className="ml-2 text-[10px] uppercase tracking-wide text-primary/80">current</span> : null}
                  </span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{formatHistoryTime(e.at)}</span>
                  {clickable ? (
                    <Undo2 className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="border-t border-border/60 px-3 py-1.5 text-[10px] text-muted-foreground">
        Click any step to jump. Up to 50 steps kept per language.
      </div>
    </div>
  );
});
