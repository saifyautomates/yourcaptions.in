// Floating in-app diagnostics panel for Supabase Realtime channels.
// Toggle with Shift+D. Shows every registered channel, its subscription
// status, cumulative event count, and last-received timestamp.

import { useEffect, useState } from "react";
import { subscribeDiagnostics, type ChannelDiag } from "@/lib/realtimeDiagnostics";
import { Radio, X } from "lucide-react";

function timeAgo(ts: number | null) {
  if (!ts) return "—";
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

const statusColor: Record<ChannelDiag["status"], string> = {
  subscribing: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  subscribed: "bg-green-500/20 text-green-300 border-green-500/40",
  closed: "bg-muted text-muted-foreground border-border",
  error: "bg-destructive/20 text-destructive border-destructive/40",
};

export function RealtimeDiagnosticsPanel() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ChannelDiag[]>([]);
  const [, setTick] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const editable = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (editable) return;
      if (e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => subscribeDiagnostics(setRows), []);

  // Re-render every second so "Xs ago" stays fresh while open.
  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [open]);

  if (!open) return null;

  const total = rows.reduce((a, r) => a + r.eventCount, 0);
  const active = rows.filter((r) => r.status === "subscribed").length;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] w-[420px] max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-background/95 backdrop-blur shadow-2xl">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Radio className="h-4 w-4 text-green-400" />
          Realtime diagnostics
          <span className="text-xs text-muted-foreground">
            {active}/{rows.length} active · {total} events
          </span>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close diagnostics"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="max-h-[50vh] overflow-y-auto p-2">
        {rows.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">
            No active channels. Open a page that subscribes to Realtime to see it here.
          </div>
        ) : (
          <ul className="space-y-1.5">
            {rows.map((r) => (
              <li key={r.id} className="rounded border border-border/60 p-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-[11px]">{r.topic}</span>
                  <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${statusColor[r.status]}`}>
                    {r.status}
                  </span>
                </div>
                <div className="mt-1 grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
                  <span>table: <span className="text-foreground">{r.table ?? "—"}</span></span>
                  <span>events: <span className="text-foreground">{r.eventCount}</span></span>
                  <span>last: <span className="text-foreground">{timeAgo(r.lastEventAt)}</span></span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground">
        Toggle with <kbd className="rounded border border-border px-1">Shift</kbd>+<kbd className="rounded border border-border px-1">D</kbd>
      </div>
    </div>
  );
}
