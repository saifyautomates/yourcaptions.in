// Export performance telemetry.
//
// Captures per-export metrics — encode time, effective fps, realtime multiplier,
// browser/codec/path/resolution/bitrate, and success/failure — and forwards
// them to two sinks:
//   1. PostHog / Sentry via the existing observability shim (real users)
//   2. A `record-export-metric` edge function that writes to `export_metrics`
//      so we can run regression queries in the admin dashboard.
//
// Timers are cheap; errors from the sinks are swallowed so telemetry can
// never break an export.

import { supabase } from "@/integrations/supabase/client";
import { captureEvent } from "@/lib/observability";
import type { ExportResolution } from "@/lib/exportVideo";

export type ExportPath = "demux-decode" | "realtime-playback" | "mediarecorder-fallback";
export type ExportOutcome = "success" | "failure" | "canceled";

export interface ExportTelemetryInit {
  resolution: ExportResolution;
  codec: string;
  profile: string;
  level: string;
  bitrate: number;
  fps: number;
  path?: ExportPath;
  sourceDurationSec?: number;
  sourceWidth?: number;
  sourceHeight?: number;
}

export interface ExportTelemetryFinishResult {
  outcome: ExportOutcome;
  framesEncoded?: number;
  outputBytes?: number;
  errorMessage?: string;
  errorCategory?: "codec" | "decode" | "quota" | "network" | "abort" | "unknown";
}

const uaBrief = () => {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  // Compact identifier — full UA lives on the server if we ever want it.
  if (/Firefox\//.test(ua)) return "firefox";
  if (/Edg\//.test(ua)) return "edge";
  if (/Chrome\//.test(ua)) return "chrome";
  if (/Safari\//.test(ua)) return "safari";
  return "other";
};

export class ExportTelemetry {
  private startedAt = performance.now();
  private lastFrameAt = this.startedAt;
  private framesSeen = 0;
  private path: ExportPath | undefined;
  private init: ExportTelemetryInit;

  constructor(init: ExportTelemetryInit) {
    this.init = init;
    this.path = init.path;
  }

  /** Called by exporters when the frame pipeline actually starts. */
  markPath(path: ExportPath) {
    this.path = path;
  }

  /** Called once per encoded frame if the caller wants effective-fps stats. */
  markFrame() {
    this.framesSeen++;
    this.lastFrameAt = performance.now();
  }

  private buildRow(finish: ExportTelemetryFinishResult) {
    const totalMs = Math.max(1, performance.now() - this.startedAt);
    const framesEncoded = finish.framesEncoded ?? this.framesSeen;
    const effectiveFps = framesEncoded > 0 ? framesEncoded / (totalMs / 1000) : null;
    const realtimeMultiplier =
      this.init.sourceDurationSec && this.init.sourceDurationSec > 0
        ? (this.init.sourceDurationSec * 1000) / totalMs
        : null;

    return {
      outcome: finish.outcome,
      path: this.path ?? null,
      browser: uaBrief(),
      resolution: this.init.resolution,
      codec: this.init.codec,
      profile: this.init.profile,
      level: this.init.level,
      bitrate: this.init.bitrate,
      fps_target: this.init.fps,
      encode_time_ms: Math.round(totalMs),
      frames_encoded: framesEncoded || null,
      effective_fps: effectiveFps ? Number(effectiveFps.toFixed(2)) : null,
      realtime_multiplier: realtimeMultiplier ? Number(realtimeMultiplier.toFixed(3)) : null,
      source_duration_sec: this.init.sourceDurationSec ?? null,
      source_width: this.init.sourceWidth ?? null,
      source_height: this.init.sourceHeight ?? null,
      output_bytes: finish.outputBytes ?? null,
      error_category: finish.errorCategory ?? null,
      error_message: finish.errorMessage?.slice(0, 500) ?? null,
    };
  }

  /**
   * Terminal event. Sends to PostHog + persists to `export_metrics`.
   * Fire-and-forget: never throws.
   */
  async finish(finish: ExportTelemetryFinishResult): Promise<void> {
    const row = this.buildRow(finish);
    try { captureEvent("export_finished", row); } catch {}
    try {
      await supabase.functions.invoke("record-export-metric", { body: row });
    } catch {
      // Swallow — offline / rate-limited telemetry must not break exports.
    }
  }
}

/** Best-effort categorization of an error thrown during export. */
export function categorizeError(err: unknown, aborted: boolean): ExportTelemetryFinishResult["errorCategory"] {
  if (aborted) return "abort";
  const msg = String((err as any)?.message ?? err ?? "").toLowerCase();
  // Order matters: decode/demux signals often mention "codec" too, so check them first.
  if (msg.includes("videodecoder") || msg.includes("avcc") || msg.includes("hvcc") || msg.includes("demux") || msg.includes("mp4box")) return "decode";
  if (msg.includes("no supported h.264") || msg.includes("encoder") || msg.includes("codec")) return "codec";
  if (msg.includes("quota") || msg.includes("402")) return "quota";
  if (msg.includes("fetch") || msg.includes("network") || msg.includes("failed to load")) return "network";
  return "unknown";
}
