import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Loader2, X, FileVideo, FileText, Clock, Timer, StopCircle, AlertTriangle, Info, Settings2, ChevronDown, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { FuturisticLoader } from "@/components/FuturisticLoader";
import { toast } from "sonner";
import { usePlanInfo } from "@/hooks/usePlanInfo";
import { getPlanCapabilities } from "@/lib/plans";
import {
  ExportResolution, RESOLUTION_DIMS, triggerDownload,
} from "@/lib/exportVideo";
import { exportVideoFast, isFastExportSupported } from "@/lib/exportVideoFast";
import {
  PRESETS, PresetKey, EncodeSettings, LEVELS, PROFILES,
  applyPreset, buildAvc1Codec, settingsWarnings,
  estimateFileSize, bitrateRangeMbps, fmtBitrate, fmtFileSize,
  recommendedLevel,
} from "@/lib/exportSettings";
import { ExportTelemetry, categorizeError } from "@/lib/exportTelemetry";
import { supabase } from "@/integrations/supabase/client";
import { detectRateLimit } from "@/lib/rateLimit";
import type { CapStyle } from "@/lib/captionStyle";

interface Seg { start: number; end: number; text: string }

interface Props {
  open: boolean;
  onClose: () => void;
  mediaUrl: string | null;
  segs: Seg[];
  capStyle: CapStyle;
  title: string;
  onDownloadCaptions: (fmt: "srt" | "vtt") => void;
  /** Source duration in seconds, used for file-size estimates. */
  videoDurationSec?: number;
}

const RES_ORDER: ExportResolution[] = ["720p", "1080p", "1440p", "4k"];

type Stage = "idle" | "metering" | "encoding" | "finalizing" | "done" | "canceling";

const fmtDuration = (ms: number) => {
  if (!isFinite(ms) || ms < 0) return "--:--";
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}:${String(m % 60).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }
  return `${m}:${String(r).padStart(2, "0")}`;
};

export default function ExportModal({ open, onClose, mediaUrl, segs, capStyle, title, onDownloadCaptions, videoDurationSec }: Props) {
  const { planId } = usePlanInfo();
  const caps = getPlanCapabilities(planId);
  const maxRes = caps.maxExportResolution;
  
  // Down-grade to max allowed if the initial state exceeds limits
  const initialRes = (maxRes === "720p") ? "720p" : "1080p";

  const [res, setRes] = useState<ExportResolution>(initialRes);
  const [preset, setPreset] = useState<PresetKey>("balanced");
  const [settings, setSettings] = useState<EncodeSettings>(() => applyPreset("balanced", "1080p"));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<Stage>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [done, setDone] = useState<{ url: string; filename: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef(0);
  const lastProgressRef = useRef({ p: 0, t: 0 });
  const tickerRef = useRef<number | null>(null);

  // Applying a preset or changing resolution overwrites the settings unless
  // the user is in "custom" mode.
  const choosePreset = (key: PresetKey) => {
    setPreset(key);
    if (key !== "custom") setSettings(applyPreset(key, res, settings.fps));
    if (key === "custom") setShowAdvanced(true);
  };
  const chooseResolution = (r: ExportResolution) => {
    setRes(r);
    if (preset !== "custom") setSettings(applyPreset(preset, r, settings.fps));
    else setSettings((s) => ({ ...s, resolution: r, level: recommendedLevel(r, s.fps) }));
  };

  const warnings = useMemo(() => settingsWarnings(settings), [settings]);
  const bitrateRange = bitrateRangeMbps(res);
  const estimatedBytes = videoDurationSec ? estimateFileSize(settings, videoDurationSec) : null;


  // Tick elapsed time while an export is running
  useEffect(() => {
    if (!busy) {
      if (tickerRef.current) { window.clearInterval(tickerRef.current); tickerRef.current = null; }
      return;
    }
    tickerRef.current = window.setInterval(() => {
      setElapsedMs(performance.now() - startedAtRef.current);
    }, 200);
    return () => {
      if (tickerRef.current) { window.clearInterval(tickerRef.current); tickerRef.current = null; }
    };
  }, [busy]);

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      abortRef.current = null;
      setBusy(false); setProgress(0); setDone(null);
      setStage("idle"); setElapsedMs(0);
    }
  }, [open]);

  if (!open) return null;

  const start = async () => {
    if (!mediaUrl) { toast.error("Video not loaded yet"); return; }
    if (!segs.length) { toast.error("No captions to burn in"); return; }
    setBusy(true); setProgress(0); setDone(null);
    setStage("metering");
    startedAtRef.current = performance.now();
    lastProgressRef.current = { p: 0, t: startedAtRef.current };
    setElapsedMs(0);
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const codec = buildAvc1Codec(settings.profile, settings.level);
    const telemetry = new ExportTelemetry({
      resolution: res, codec,
      profile: settings.profile, level: settings.level,
      bitrate: settings.bitrate, fps: settings.fps,
      sourceDurationSec: videoDurationSec,
    });

    try {
      // Meter one export against the user's monthly plan quota BEFORE
      // starting any encoding work.
      const { data: meter, error: mErr } = await supabase.functions.invoke("meter-export");
      if (mErr) {
        const ctx = (mErr as any)?.context;
        const detail = ctx?.text ? await ctx.text() : null;
        let msg = mErr.message || "Export blocked";
        try { if (detail) msg = JSON.parse(detail).error ?? msg; } catch {}
        throw new Error(msg);
      }
      if (meter && typeof meter.remaining === "number" && meter.remaining <= 2) {
        toast.message(`${meter.remaining} export${meter.remaining === 1 ? "" : "s"} left this month`);
      }
      if (ctrl.signal.aborted) throw new Error("aborted");
      setStage("encoding");

      const out = await exportVideoFast({
        mediaUrl,
        segs,
        capStyle: {
          ...capStyle,
          ...(caps.watermarkRequired ? { watermark: true } : {}),
        },
        resolution: res,
        fps: settings.fps,
        bitrate: settings.bitrate,
        preferredCodec: codec,
        filename: (title || "captioned-video").replace(/[^\w\-]+/g, "_") + "-" + res,
        signal: ctrl.signal,
        onPath: (p) => telemetry.markPath(p),
        onFrameEncoded: () => telemetry.markFrame(),
        onProgress: (p) => {
          setProgress(p);
          lastProgressRef.current = { p, t: performance.now() };
          if (p >= 0.995) setStage("finalizing");
        },
      });
      setProgress(1);
      setStage("done");
      setDone({ url: out.url, filename: out.filename });
      triggerDownload(out.url, out.filename);
      toast.success("Export complete — download started");
      void telemetry.finish({ outcome: "success", outputBytes: out.blob.size });
    } catch (e: any) {
      const aborted = ctrl.signal.aborted;
      if (aborted) toast.message("Export canceled");
      else if (detectRateLimit(e, "meter-export")) { /* banner shown */ }
      else toast.error(e?.message ?? "Export failed");
      void telemetry.finish({
        outcome: aborted ? "canceled" : "failure",
        errorCategory: categorizeError(e, aborted),
        errorMessage: e?.message,
      });
    } finally {
      setBusy(false);
      if (ctrl.signal.aborted) setStage("idle");
    }
  };


  const cancel = () => {
    if (!abortRef.current || stage === "canceling") return;
    setStage("canceling");
    abortRef.current.abort();
  };

  // Compute ETA from cumulative progress rate.
  const now = performance.now();
  const eta = (() => {
    const { p } = lastProgressRef.current;
    if (!busy || p <= 0.02 || p >= 1) return null;
    const totalElapsed = now - startedAtRef.current;
    const rate = p / Math.max(1, totalElapsed);
    if (rate <= 0) return null;
    return (1 - p) / rate;
  })();

  const stageLabel: Record<Stage, string> = {
    idle: "",
    metering: "Reserving quota…",
    encoding: "Encoding video",
    finalizing: "Finalizing MP4…",
    done: "Complete",
    canceling: "Stopping…",
  };

  const dims = RESOLUTION_DIMS[res];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <FileVideo className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Export video</h3>
          </div>
          <button onClick={() => !busy && onClose()} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40" disabled={busy}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[80vh] space-y-4 overflow-y-auto p-5">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Resolution</p>
            <div className="grid grid-cols-4 gap-2">
              {RES_ORDER.map((r) => {
                const d = RESOLUTION_DIMS[r];
                const active = r === res;
                // Strict check: if maxRes is 720p, lock out everything higher. If 1080p, lock 4K/1440p.
                let locked = false;
                if (maxRes === "720p" && r !== "720p") locked = true;
                if (maxRes === "1080p" && (r === "4k" || r === "1440p")) locked = true;

                return (
                  <button key={r} onClick={() => locked ? null : chooseResolution(r)} disabled={busy}
                    className={`relative flex flex-col items-center gap-0.5 rounded-lg border px-2 py-2.5 text-xs transition ${
                      locked ? "opacity-50 cursor-not-allowed border-border bg-card" : 
                      active ? "border-primary bg-primary/10 text-foreground" : "border-border bg-input/30 text-muted-foreground hover:border-primary/50"
                    }`}>
                    <span className="font-bold flex items-center gap-1">{r.toUpperCase()} {locked && <Lock className="h-2.5 w-2.5" />}</span>
                    <span className="text-[10px] opacity-70">{d.w}×{d.h}</span>
                    {locked && (
                       <span className="absolute -top-2 text-[8px] bg-primary/20 text-primary px-1 rounded-sm uppercase tracking-wider font-bold">Pro</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Quality preset</p>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((p) => {
                const active = p.key === preset;
                return (
                  <button
                    key={p.key}
                    onClick={() => choosePreset(p.key)}
                    disabled={busy}
                    className={`text-left rounded-lg border px-3 py-2 text-xs transition ${
                      active ? "border-primary bg-primary/10 text-foreground" : "border-border bg-input/30 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="font-semibold text-[12px]">{p.label}</div>
                    <div className="mt-0.5 text-[10.5px] opacity-70 leading-tight">{p.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              disabled={busy}
              className="flex w-full items-center justify-between rounded-md border border-border/60 bg-input/20 px-3 py-2 text-xs font-semibold text-foreground hover:bg-input/40"
            >
              <span className="inline-flex items-center gap-1.5">
                <Settings2 className="h-3.5 w-3.5" /> Advanced encoder settings
              </span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-3 rounded-lg border border-border/60 bg-input/10 p-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">H.264 profile</label>
                    <select
                      value={settings.profile}
                      disabled={busy}
                      onChange={(e) => {
                        setPreset("custom");
                        setSettings((s) => ({ ...s, profile: e.target.value as EncodeSettings["profile"] }));
                      }}
                      className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs capitalize"
                    >
                      {PROFILES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Level</label>
                    <select
                      value={settings.level}
                      disabled={busy}
                      onChange={(e) => {
                        setPreset("custom");
                        setSettings((s) => ({ ...s, level: e.target.value as EncodeSettings["level"] }));
                      }}
                      className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                    >
                      {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-baseline justify-between">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Bitrate</label>
                    <span className="font-mono tabular-nums text-xs text-foreground">{fmtBitrate(settings.bitrate)}</span>
                  </div>
                  <input
                    type="range"
                    min={bitrateRange.min}
                    max={bitrateRange.max}
                    step={0.5}
                    value={settings.bitrate / 1_000_000}
                    disabled={busy}
                    onChange={(e) => {
                      setPreset("custom");
                      setSettings((s) => ({ ...s, bitrate: Math.round(Number(e.target.value) * 1_000_000) }));
                    }}
                    className="mt-1 w-full accent-primary"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{bitrateRange.min} Mbps</span>
                    <span>{bitrateRange.max} Mbps</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-baseline justify-between">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Frame rate</label>
                    <span className="font-mono tabular-nums text-xs text-foreground">{settings.fps} fps</span>
                  </div>
                  <div className="mt-1 grid grid-cols-4 gap-1.5">
                    {[24, 30, 50, 60].map((f) => (
                      <button
                        key={f}
                        disabled={busy}
                        onClick={() => {
                          setPreset("custom");
                          setSettings((s) => ({ ...s, fps: f, level: recommendedLevel(s.resolution, f) }));
                        }}
                        className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${
                          settings.fps === f ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-input/60"
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-md border border-border/60 bg-background/40 px-2.5 py-2 text-[10.5px] text-muted-foreground">
                  Codec string: <span className="font-mono text-foreground">{buildAvc1Codec(settings.profile, settings.level)}</span>
                  {estimatedBytes != null && (
                    <div className="mt-0.5">Estimated file size: <span className="font-semibold text-foreground">{fmtFileSize(estimatedBytes)}</span></div>
                  )}
                </div>
              </div>
            )}
          </div>

          {warnings.length > 0 && (
            <div className="space-y-1.5">
              {warnings.map((w, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-[11px] ${
                    w.level === "warn"
                      ? "border-warning/40 bg-warning/10 text-warning-200"
                      : "border-border bg-input/30 text-muted-foreground"
                  }`}
                >
                  {w.level === "warn" ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none" /> : <Info className="mt-0.5 h-3.5 w-3.5 flex-none" />}
                  <span>{w.message}</span>
                </div>
              ))}
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">
            Rendering <span className="font-semibold text-foreground">{dims.label}</span> ({dims.w}×{dims.h}) in-browser using WebCodecs — typically several times faster than realtime.
          </p>

          {busy && (
            <div className="rounded-lg border border-border/60 bg-input/30 p-3.5">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                  <FuturisticLoader size="sm" inline />
                  {stageLabel[stage]} {stage === "encoding" ? res.toUpperCase() : ""}
                </span>
                <span className="font-mono tabular-nums text-foreground">{Math.round(progress * 100)}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-border">
                <div
                  className={`h-full transition-[width] duration-150 ${stage === "canceling" ? "bg-destructive" : "bg-primary"}`}
                  style={{ width: `${Math.max(2, Math.round(progress * 100))}%` }}
                />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-md border border-border/60 bg-background/50 px-2.5 py-1.5">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3" /> Elapsed
                  </div>
                  <div className="mt-0.5 font-mono tabular-nums text-sm font-semibold text-foreground">
                    {fmtDuration(elapsedMs)}
                  </div>
                </div>
                <div className="rounded-md border border-border/60 bg-background/50 px-2.5 py-1.5">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Timer className="h-3 w-3" /> Remaining
                  </div>
                  <div className="mt-0.5 font-mono tabular-nums text-sm font-semibold text-foreground">
                    {eta == null ? (stage === "finalizing" ? "almost done" : "estimating…") : fmtDuration(eta)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {done && !busy && (
            <div className="flex items-center justify-between rounded-lg border border-primary/40 bg-primary/10 p-3 text-xs">
              <div className="flex flex-col">
                <span>Saved <span className="font-semibold">{done.filename}</span></span>
                <span className="text-[10px] text-primary/70">Rendered in {fmtDuration(elapsedMs)}</span>
              </div>
              <button onClick={() => triggerDownload(done.url, done.filename)} className="inline-flex items-center gap-1.5 rounded-md bg-primary/20 px-2.5 py-1 font-semibold text-primary hover:bg-primary/30">
                <Download className="h-3.5 w-3.5" /> Download again
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            {!busy ? (
              <button onClick={start} disabled={!mediaUrl}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-50">
                <Download className="h-4 w-4" /> Export & Download
              </button>
            ) : (
              <button
                onClick={cancel}
                disabled={stage === "canceling"}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/20 disabled:opacity-60"
              >
                <StopCircle className="h-4 w-4" />
                {stage === "canceling" ? "Stopping…" : "Cancel export"}
              </button>
            )}
          </div>

          <div className="border-t border-border/60 pt-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Also download captions</p>
            <div className="flex gap-2">
              <button onClick={() => onDownloadCaptions("srt")} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-input/30 px-3 py-1.5 text-xs font-semibold hover:bg-input/60">
                <FileText className="h-3.5 w-3.5" /> .SRT
              </button>
              <button onClick={() => onDownloadCaptions("vtt")} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-input/30 px-3 py-1.5 text-xs font-semibold hover:bg-input/60">
                <FileText className="h-3.5 w-3.5" /> .VTT
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
