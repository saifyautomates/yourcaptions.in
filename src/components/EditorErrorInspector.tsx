// Floating in-editor inspector for the most recent editor control failures
// (play/pause, mute, fullscreen, replace, download, three-dot, etc.).
// Lets the user diagnose issues without leaving ProjectView.

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, X, ChevronDown, ChevronUp, Copy, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  subscribeEditorErrors,
  clearEditorErrors,
  type EditorControlErrorEntry,
} from "@/lib/editorControlErrors";

function fmtTime(ts: number) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export function EditorErrorInspector() {
  const [rows, setRows] = useState<EditorControlErrorEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => subscribeEditorErrors(setRows), []);

  // Auto-open when a fresh error lands so the user notices.
  useEffect(() => {
    if (rows.length > 0) {
      setDismissed(false);
      setExpandedId((prev) => prev ?? rows[0].id);
    }
  }, [rows]);

  // Re-render "Xs ago" labels.
  useEffect(() => {
    if (!open || rows.length === 0) return;
    const t = window.setInterval(() => tick((n) => (n + 1) % 1_000_000), 5_000);
    return () => window.clearInterval(t);
  }, [open, rows.length]);

  const latest = rows[0];
  const count = rows.length;

  const copyEntry = async (e: EditorControlErrorEntry) => {
    const payload = {
      at: new Date(e.at).toISOString(),
      control: e.control,
      action: e.action,
      title: e.title,
      message: e.message,
      context: e.context,
      stack: e.stack,
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      toast.success("Copied error details");
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  };

  const badge = useMemo(() => {
    if (!latest) return null;
    return (
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-200 shadow-lg backdrop-blur transition hover:bg-red-500/20"
        aria-label={`Show ${count} recent editor control error${count === 1 ? "" : "s"}`}
        aria-expanded={open}
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        <span>
          {count} control {count === 1 ? "error" : "errors"}
        </span>
        <span className="max-w-[180px] truncate opacity-80">· {latest.title}</span>
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
      </button>
    );
  }, [latest, count, open]);

  if (dismissed || rows.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Editor control errors"
      className="pointer-events-none fixed bottom-4 right-4 z-[70] flex max-w-[380px] flex-col items-end gap-2"
    >
      <div className="pointer-events-auto">{badge}</div>

      {open && (
        <div
          className="pointer-events-auto w-[380px] max-h-[60vh] overflow-hidden rounded-xl border border-red-500/30 bg-neutral-950/95 shadow-2xl backdrop-blur"
        >
          <div className="flex items-center justify-between border-b border-red-500/20 bg-red-500/10 px-3 py-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-red-200">
              <AlertTriangle className="h-3.5 w-3.5" />
              Recent editor control failures
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => { clearEditorErrors(); toast.success("Cleared"); }}
                className="rounded p-1 text-red-200/70 hover:bg-red-500/20 hover:text-red-100"
                title="Clear all"
                aria-label="Clear all editor control errors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="rounded p-1 text-red-200/70 hover:bg-red-500/20 hover:text-red-100"
                title="Hide"
                aria-label="Hide inspector"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <ul className="max-h-[52vh] overflow-y-auto divide-y divide-white/5">
            {rows.map((e) => {
              const isOpen = expandedId === e.id;
              return (
                <li key={e.id} className="px-3 py-2 text-xs text-neutral-200">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isOpen ? null : e.id)}
                    className="flex w-full items-start justify-between gap-2 text-left"
                    aria-expanded={isOpen}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-200">
                          {e.control}
                        </span>
                        {e.action && (
                          <span className="text-[10px] text-neutral-400">{e.action}</span>
                        )}
                        <span className="ml-auto text-[10px] text-neutral-500">{fmtTime(e.at)}</span>
                      </div>
                      <div className="mt-1 font-medium text-neutral-100 truncate">{e.title}</div>
                      <div className="mt-0.5 text-neutral-400 line-clamp-2 break-words">{e.message}</div>
                    </div>
                    {isOpen ? (
                      <ChevronUp className="mt-1 h-3.5 w-3.5 shrink-0 text-neutral-500" />
                    ) : (
                      <ChevronDown className="mt-1 h-3.5 w-3.5 shrink-0 text-neutral-500" />
                    )}
                  </button>

                  {isOpen && (
                    <div className="mt-2 rounded-lg border border-white/5 bg-black/40 p-2">
                      {e.context && Object.keys(e.context).length > 0 && (
                        <pre className="mb-2 max-h-32 overflow-auto whitespace-pre-wrap break-words text-[10px] leading-snug text-neutral-300">
{JSON.stringify(e.context, null, 2)}
                        </pre>
                      )}
                      {e.stack && (
                        <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words text-[10px] leading-snug text-neutral-500">
{e.stack.split("\n").slice(0, 6).join("\n")}
                        </pre>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => copyEntry(e)}
                          className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-neutral-200 hover:bg-white/10"
                        >
                          <Copy className="h-3 w-3" /> Copy
                        </button>
                        <Link
                          to="/dashboard/errors"
                          className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-neutral-200 hover:bg-white/10"
                        >
                          <ExternalLink className="h-3 w-3" /> Open error log
                        </Link>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export default EditorErrorInspector;
