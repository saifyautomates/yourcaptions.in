// One-click captioned-video export.
//
// Reuses the same WebCodecs pipeline as ExportModal but skips the modal UI —
// it meters the quota, encodes, and triggers the browser download in a single
// call. Progress is surfaced through a Sonner toast that updates in place.

import { toast } from "sonner";
import { exportVideoFast } from "./exportVideoFast";
import { triggerDownload, ExportResolution, RESOLUTION_DIMS } from "./exportVideo";
import { applyPreset, buildAvc1Codec } from "./exportSettings";
import { supabase } from "@/integrations/supabase/client";
import { detectRateLimit } from "./rateLimit";
import { createRunLog, failWithLog } from "./runLog";
import { startPerfMeasure } from "./perfBudget";
import type { CapStyle } from "./captionStyle";

/**
 * Probe a rendered video blob and return its actual pixel dimensions by
 * loading it into a hidden <video> element. Resolves to null if the browser
 * can't decode the metadata within a short timeout.
 */
async function probeVideoDimensions(url: string): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.playsInline = true;
    let done = false;
    const finish = (val: { w: number; h: number } | null) => {
      if (done) return; done = true;
      v.removeAttribute("src"); try { v.load(); } catch { /* noop */ }
      resolve(val);
    };
    const timer = window.setTimeout(() => finish(null), 4000);
    v.onloadedmetadata = () => {
      window.clearTimeout(timer);
      const w = v.videoWidth, h = v.videoHeight;
      finish(w > 0 && h > 0 ? { w, h } : null);
    };
    v.onerror = () => { window.clearTimeout(timer); finish(null); };
    v.src = url;
  });
}

/**
 * Verify the encoded blob's dimensions match the resolution the user picked.
 * Handles portrait sources by matching the (min, max) pair rather than the
 * exact width/height — a portrait 1080p export renders 1080×1920, which is
 * still "1080p" from the user's point of view.
 */
function matchesResolution(actual: { w: number; h: number }, target: ExportResolution): boolean {
  const t = RESOLUTION_DIMS[target];
  const aLong = Math.max(actual.w, actual.h), aShort = Math.min(actual.w, actual.h);
  const tLong = Math.max(t.w, t.h), tShort = Math.min(t.w, t.h);
  // Allow ±2px slop for chroma-subsampling / codec rounding.
  return Math.abs(aLong - tLong) <= 2 && Math.abs(aShort - tShort) <= 2;
}


interface Seg { start: number; end: number; text: string }

export interface QuickExportOpts {
  mediaUrl: string | null;
  segs: Seg[];
  capStyle: CapStyle;
  title: string;
  resolution: ExportResolution;
  signal?: AbortSignal;
}

/**
 * Kick off a captioned video export at the requested resolution and download
 * the result. Returns true when the download starts, false when a
 * precondition fails or the request is canceled.
 */
export async function runQuickExport({
  mediaUrl, segs, capStyle, title, resolution, signal,
}: QuickExportOpts): Promise<boolean> {
  if (!mediaUrl) { toast.error("Video not loaded yet"); return false; }
  if (!segs.length) { toast.error("No captions to burn in"); return false; }

  const settings = applyPreset("balanced", resolution, 30);
  const codec = buildAvc1Codec(settings.profile, settings.level);
  const label = resolution === "4k" ? "4K" : resolution.toUpperCase();
  const toastId = toast.loading(`Preparing ${label} export…`);

  const log = createRunLog("export", { resolution, title, segCount: segs.length, codec });
  // Budgeted measurement — click → download triggered.
  const perf = startPerfMeasure("export_response", { resolution, seg_count: segs.length });

  try {
    log.step("meter-export: request");
    try {
      const { data: meter, error: mErr } = await supabase.functions.invoke("meter-export");
      if (mErr) {
        const ctx = (mErr as any)?.context;
        const detail = ctx?.text ? await ctx.text() : null;
        let msg = mErr.message || "Export blocked";
        try { if (detail) msg = JSON.parse(detail).error ?? msg; } catch { /* noop */ }
        if (msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("limit") || msg.toLowerCase().includes("exhausted")) {
          log.error("meter-export: failed", { status: ctx?.status, detail: msg });
          throw new Error(msg);
        }
        log.warn("meter-export: non-blocking failure, proceeding", { status: ctx?.status, detail: msg });
      } else {
        log.step("meter-export: ok", { remaining: meter?.remaining });
        if (meter && typeof meter.remaining === "number" && meter.remaining <= 2) {
          toast.message(`${meter.remaining} export${meter.remaining === 1 ? "" : "s"} left this month`);
        }
      }
    } catch (meterErr: any) {
      if (meterErr.message?.toLowerCase().includes("quota") || meterErr.message?.toLowerCase().includes("limit") || meterErr.message?.toLowerCase().includes("exhausted")) {
        throw meterErr;
      }
      log.warn("meter-export: bypassed for client render", { error: meterErr.message });
    }
    if (signal?.aborted) throw new Error("aborted");

    const filename = (title || "captioned-video").replace(/[^\w\-]+/g, "_") + "-" + resolution;
    log.step("encode: start", { fps: settings.fps, bitrate: settings.bitrate });
    const out = await exportVideoFast({
      mediaUrl, segs, capStyle, resolution,
      fps: settings.fps,
      bitrate: settings.bitrate,
      preferredCodec: codec,
      filename,
      signal,
      onProgress: (p) => {
        toast.loading(`Rendering ${label}… ${Math.round(p * 100)}%`, { id: toastId });
      },
    });
    log.step("encode: done", { bytes: out.blob.size, filename: out.filename });

    triggerDownload(out.url, out.filename);
    log.step("download: triggered");
    perf.end({ bytes: out.blob.size, filename: out.filename });

    const actual = await probeVideoDimensions(out.url);
    const target = RESOLUTION_DIMS[resolution];
    const mb = (out.blob.size / (1024 * 1024)).toFixed(1);
    if (actual && matchesResolution(actual, resolution)) {
      log.step("verify: ok", { actual, target });
      toast.success(
        `${target.label} download started — verified ${actual.w}×${actual.h} · ${mb} MB`,
        { id: toastId, duration: 6000, description: out.filename },
      );
    } else if (actual) {
      log.warn("verify: mismatch", { actual, target });
      toast.warning(
        `Download started at ${actual.w}×${actual.h} (expected ${target.w}×${target.h})`,
        { id: toastId, duration: 8000, description: `${out.filename} · ${mb} MB` },
      );
    } else {
      log.warn("verify: probe unavailable");
      toast.success(
        `${target.label} download started · ${mb} MB`,
        { id: toastId, duration: 6000, description: out.filename },
      );
    }
    return true;
  } catch (e: any) {
    perf.cancel(); // don't blame slow exports when the run failed

    if (signal?.aborted) {
      log.warn("aborted by user");
      toast.message("Export canceled", { id: toastId });
    } else if (detectRateLimit(e, "meter-export")) {
      log.warn("rate limited", { message: e?.message });
      toast.dismiss(toastId);
    } else if (typeof e?.message === "string" && e.message.startsWith("quota_exceeded")) {
      log.warn("quota exceeded", { message: e.message });
      toast.dismiss(toastId);
      toast.error("You're out of export credits this month", {
        description: "Upgrade your plan to keep exporting videos.",
        duration: 10000,
        action: {
          label: "Upgrade",
          onClick: () => { window.location.href = "/pricing"; },
        },
      });
    } else {
      toast.dismiss(toastId);
      failWithLog(log, e, { title: "Export failed" });
    }
    return false;
  }
}
