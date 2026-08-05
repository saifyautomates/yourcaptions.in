// Client-side error logging + user-facing toasts for editor/video control
// failures (play/pause, mute, fullscreen, replace, download, three-dot menu,
// etc.). Every call ships a structured entry to the `log-error` pipeline and
// surfaces a Sonner toast so the user sees exactly what broke and can retry.

import { toast } from "sonner";
import { reportError } from "./errorMonitor";

export type EditorControl =
  | "play_pause"
  | "mute"
  | "fullscreen"
  | "replace_media"
  | "download"
  | "three_dot_menu"
  | "seek"
  | "resize_caption"
  | "toggle_word_select"
  | "resync_captions"
  | "unknown";

interface LogOpts {
  control: EditorControl;
  action?: string;           // e.g. "requestFullscreen"
  context?: Record<string, unknown>;
  userMessage?: string;      // toast title override
  silent?: boolean;          // skip toast (still logs)
}

const FRIENDLY: Record<EditorControl, string> = {
  play_pause: "Couldn't toggle playback",
  mute: "Couldn't change audio",
  fullscreen: "Fullscreen unavailable",
  replace_media: "Couldn't replace media",
  download: "Download failed",
  three_dot_menu: "Menu action failed",
  seek: "Couldn't seek video",
  resize_caption: "Couldn't resize captions",
  toggle_word_select: "Word selection failed",
  resync_captions: "Re-sync failed",
  unknown: "Something went wrong",
};

/** In-memory ring buffer of the most recent editor control failures. */
export interface EditorControlErrorEntry {
  id: string;
  at: number;                // epoch ms
  control: EditorControl;
  action?: string;
  title: string;             // friendly toast title
  message: string;           // raw error message
  context?: Record<string, unknown>;
  stack?: string;
}

const MAX_ENTRIES = 10;
const recent: EditorControlErrorEntry[] = [];
const listeners = new Set<(rows: EditorControlErrorEntry[]) => void>();

function emit() {
  const snap = recent.slice();
  listeners.forEach((l) => { try { l(snap); } catch { /* noop */ } });
}

export function getRecentEditorErrors(): EditorControlErrorEntry[] {
  return recent.slice();
}

export function subscribeEditorErrors(cb: (rows: EditorControlErrorEntry[]) => void): () => void {
  listeners.add(cb);
  cb(recent.slice());
  return () => { listeners.delete(cb); };
}

export function clearEditorErrors(): void {
  recent.length = 0;
  emit();
}

/** Report an editor control failure + show a toast. Never throws. */
export function logEditorControlError(err: unknown, opts: LogOpts): void {
  const { control, action, context, userMessage, silent } = opts;
  const e = err instanceof Error ? err : new Error(typeof err === "string" ? err : String(err));
  const title = userMessage ?? FRIENDLY[control];

  // Log — fire and forget.
  void reportError(e, {
    severity: "error",
    source: "frontend",
    functionName: `editor.${control}${action ? `.${action}` : ""}`,
    context: { area: "editor_control", control, action, ...context },
  });

  // Push into recent ring buffer for the in-editor inspector.
  const entry: EditorControlErrorEntry = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    control,
    action,
    title,
    message: e.message || String(e),
    context,
    stack: e.stack,
  };
  recent.unshift(entry);
  if (recent.length > MAX_ENTRIES) recent.length = MAX_ENTRIES;
  emit();

  if (!silent) {
    toast.error(title, {
      description: e.message?.slice(0, 240) || "Please try again. If it keeps failing, open the error log.",
    });
  }
}


/** Wrap a sync or async control handler so any throw is captured + toasted. */
export function guardControl<T extends (...args: any[]) => any>(
  fn: T,
  opts: Omit<LogOpts, "context"> & { contextBuilder?: (...args: Parameters<T>) => Record<string, unknown> },
): (...args: Parameters<T>) => ReturnType<T> | undefined {
  return (...args: Parameters<T>) => {
    try {
      const out = fn(...args);
      if (out && typeof (out as Promise<unknown>).then === "function") {
        return (out as Promise<unknown>).catch((err) => {
          logEditorControlError(err, { ...opts, context: opts.contextBuilder?.(...args) });
          return undefined;
        }) as ReturnType<T>;
      }
      return out;
    } catch (err) {
      logEditorControlError(err, { ...opts, context: opts.contextBuilder?.(...args) });
      return undefined;
    }
  };
}
