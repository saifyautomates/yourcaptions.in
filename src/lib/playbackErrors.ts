// Structured logging + friendly toasts for HTMLMediaElement failures.
// Decodes MediaError codes and network state into a category + human message
// so playback bugs are diagnosable from the error log without digging into
// browser-specific error text.

import { toast } from "sonner";
import { reportError } from "./errorMonitor";

export type PlaybackSurface = "hero_video" | "hero_bg_video" | "project_preview" | "audio_dub" | "unknown";

export type PlaybackCategory =
  | "aborted"          // user/system aborted load
  | "network"          // fetch/CDN failure
  | "decode"           // corrupt or unsupported codec bitstream
  | "src_not_supported"// MIME/codec not supported OR 403/404 on src
  | "autoplay_blocked" // browser blocked autoplay
  | "not_ready"        // play() called before readyState
  | "unknown";

const FRIENDLY: Record<PlaybackCategory, string> = {
  aborted: "Playback was interrupted",
  network: "Video couldn't load — network issue",
  decode: "Video file is corrupt or unsupported",
  src_not_supported: "This video source can't be played (link may be expired)",
  autoplay_blocked: "Browser blocked autoplay — tap to play",
  not_ready: "Video isn't ready yet",
  unknown: "Playback failed",
};

const LABELS: Record<PlaybackCategory, string> = {
  aborted: "ABORTED",
  network: "NETWORK",
  decode: "DECODE",
  src_not_supported: "SRC_UNSUPPORTED",
  autoplay_blocked: "AUTOPLAY_BLOCKED",
  not_ready: "NOT_READY",
  unknown: "UNKNOWN",
};

export interface PlaybackSnapshot {
  mediaErrorCode: number | null;
  mediaErrorMessage: string | null;
  networkState: number | null;
  readyState: number | null;
  currentSrc: string | null;
  currentTime: number | null;
  duration: number | null;
  muted: boolean | null;
  paused: boolean | null;
}

export function snapshotMedia(el: HTMLMediaElement | null | undefined): PlaybackSnapshot {
  if (!el) {
    return {
      mediaErrorCode: null, mediaErrorMessage: null, networkState: null, readyState: null,
      currentSrc: null, currentTime: null, duration: null, muted: null, paused: null,
    };
  }
  return {
    mediaErrorCode: el.error?.code ?? null,
    mediaErrorMessage: el.error?.message ?? null,
    networkState: el.networkState,
    readyState: el.readyState,
    currentSrc: el.currentSrc || null,
    currentTime: Number.isFinite(el.currentTime) ? el.currentTime : null,
    duration: Number.isFinite(el.duration) ? el.duration : null,
    muted: el.muted,
    paused: el.paused,
  };
}

export function categorizePlayback(snap: PlaybackSnapshot, thrown?: unknown): PlaybackCategory {
  const code = snap.mediaErrorCode;
  // MediaError constants: 1=ABORTED, 2=NETWORK, 3=DECODE, 4=SRC_NOT_SUPPORTED
  if (code === 1) return "aborted";
  if (code === 2) return "network";
  if (code === 3) return "decode";
  if (code === 4) return "src_not_supported";

  const name = thrown instanceof Error ? thrown.name : "";
  const msg = (thrown instanceof Error ? thrown.message : String(thrown ?? "")).toLowerCase();
  if (name === "NotAllowedError" || /autoplay|user (didn'?t|did not) interact|gesture/.test(msg)) return "autoplay_blocked";
  if (name === "AbortError" || /interrupted|load request/.test(msg)) return "aborted";
  if (snap.readyState !== null && snap.readyState < 2 && /play\(\)/.test(msg)) return "not_ready";
  if (/network|fetch|failed to load|403|404/.test(msg)) return "network";
  return "unknown";
}

interface LogOpts {
  surface: PlaybackSurface;
  element?: HTMLMediaElement | null;
  thrown?: unknown;
  extra?: Record<string, unknown>;
  /** Suppress toast (e.g. for benign aborts). */
  silent?: boolean;
  /** Override toast title. */
  userMessage?: string;
}

let lastToastAt = 0;
const TOAST_COOLDOWN_MS = 4000;

/**
 * Report a playback failure with a structured payload + friendly toast.
 * Benign categories (aborted, not_ready) are logged but not toasted.
 */
export function logPlaybackError(opts: LogOpts): { category: PlaybackCategory; snapshot: PlaybackSnapshot } {
  const snapshot = snapshotMedia(opts.element ?? null);
  const category = categorizePlayback(snapshot, opts.thrown);
  const label = LABELS[category];
  const friendly = opts.userMessage ?? FRIENDLY[category];

  const thrownMsg = opts.thrown instanceof Error ? opts.thrown.message : opts.thrown ? String(opts.thrown) : undefined;
  const message = `[playback:${opts.surface}] ${label} — ${friendly}${thrownMsg ? ` (${thrownMsg})` : ""}`;

   
  console.warn(message, { surface: opts.surface, category, snapshot, extra: opts.extra });

  void reportError(message, {
    severity: category === "aborted" || category === "not_ready" ? "warning" : "error",
    source: "frontend",
    functionName: `playback.${opts.surface}`,
    context: {
      area: "playback",
      surface: opts.surface,
      category,
      ...snapshot,
      ...opts.extra,
    },
  });

  const isBenign = category === "aborted" || category === "not_ready";
  if (!opts.silent && !isBenign) {
    const now = Date.now();
    if (now - lastToastAt > TOAST_COOLDOWN_MS) {
      lastToastAt = now;
      toast.error(friendly, {
        description:
          category === "src_not_supported"
            ? "The video link may have expired. Try re-uploading."
            : category === "autoplay_blocked"
              ? "Click the video to start playback."
              : category === "network"
                ? "Check your connection and retry."
                : thrownMsg?.slice(0, 200) || "See error log for details.",
      });
    }
  }

  return { category, snapshot };
}
