// WebCodecs-based export orchestrator. Runs all encoding + drawing off the
// main thread in a Web Worker.
//
// Fast path: demux the source MP4 with mp4box.js and feed encoded samples
// straight into a `VideoDecoder`. Decoded frames flow into the worker at
// hardware speed — no <video> playback involved, so export finishes in a
// small multiple of the decode+encode rate rather than tracking realtime.
//
// Fallback path: hidden <video> element played back at 1x while
// `requestVideoFrameCallback` copies each presented frame. Used when the
// source can't be demuxed (non-MP4, unusual codec) or the decoder rejects
// the stream.
//
// Final fallback: legacy MediaRecorder pipeline when WebCodecs isn't
// available at all.

import type { CapStyle } from "./captionStyle";
import {
  exportVideoWithCaptions, triggerDownload,
  ExportResolution, RESOLUTION_DIMS, Segment,
} from "./exportVideo";
import { demuxDecodeMp4, isDemuxDecodeSupported } from "./demuxDecode";

export { triggerDownload, RESOLUTION_DIMS };
export type { ExportResolution, Segment };

export const isFastExportSupported = () =>
  typeof (globalThis as any).VideoEncoder === "function" &&
  typeof (globalThis as any).VideoFrame === "function" &&
  typeof (globalThis as any).AudioEncoder === "function" &&
  typeof (globalThis as any).OffscreenCanvas === "function";

const bitrateFor = (w: number, h: number) => {
  const px = w * h;
  if (px >= 3840 * 2160) return 40_000_000;
  if (px >= 2560 * 1440) return 20_000_000;
  if (px >= 1920 * 1080) return 12_000_000;
  return 6_000_000;
};

export interface FastExportOptions {
  mediaUrl: string;
  segs: Segment[];
  capStyle: CapStyle;
  resolution: ExportResolution;
  filename?: string;
  fps?: number;
  /** Preferred codec string (e.g. "avc1.640028"). Worker falls back if unsupported. */
  preferredCodec?: string;
  /** User-chosen bitrate override in bits/second. */
  bitrate?: number;
  onProgress?: (pct: number) => void;
  signal?: AbortSignal;
  /** Reported once the exporter commits to demux-decode or realtime-playback. */
  onPath?: (path: "demux-decode" | "realtime-playback") => void;
  /** Fired for every frame handed to the encoder (drives effective-fps stats). */
  onFrameEncoded?: () => void;
}

async function decodeAudio(mediaUrl: string): Promise<AudioBuffer | null> {
  try {
    const res = await fetch(mediaUrl);
    const buf = await res.arrayBuffer();
    const AC: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
    const ac = new AC();
    const ab = await ac.decodeAudioData(buf.slice(0));
    try { await ac.close(); } catch {}
    return ab;
  } catch {
    return null;
  }
}

export async function exportVideoFast(opts: FastExportOptions): Promise<{ blob: Blob; url: string; filename: string }> {
  if (!isFastExportSupported()) {
    // Fall back to legacy MediaRecorder pipeline
    const out = await exportVideoWithCaptions(opts);
    return out;
  }

  const { mediaUrl, segs, capStyle, resolution, onProgress, signal } = opts;
  const fps = opts.fps ?? 30;
  const { w: W, h: H } = RESOLUTION_DIMS[resolution];
  const bitrate = opts.bitrate ?? bitrateFor(W, H);

  // Hidden video element — needed on main thread to source frames
  const video = document.createElement("video");
  video.src = mediaUrl;
  video.crossOrigin = "anonymous";
  video.muted = true; // audio comes through decodeAudioData
  video.playsInline = true;
  video.preload = "auto";

  await new Promise<void>((resolve, reject) => {
    video.addEventListener("loadedmetadata", () => resolve(), { once: true });
    video.addEventListener("error", () => reject(new Error("Failed to load source video")), { once: true });
  });
  const duration = video.duration;
  const sourceW = video.videoWidth || W;
  const sourceH = video.videoHeight || H;

  // Decode audio up front (small enough for typical caption workflows)
  const audio = await decodeAudio(mediaUrl);

  const worker = new Worker(new URL("../workers/exportWorker.ts", import.meta.url), { type: "module" });

  const done = new Promise<Blob>((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<any>) => {
      if (e.data?.type === "done") resolve(e.data.blob as Blob);
      else if (e.data?.type === "error") reject(new Error(e.data.message || "Encoder error"));
    };
    worker.onerror = (e) => reject(new Error(e.message || "Worker error"));
  });

  // Init worker
  worker.postMessage({
    type: "init",
    width: W, height: H, fps,
    bitrate,
    preferredCodec: opts.preferredCodec,
    capStyle, segs,
    sourceW, sourceH,
    audio: audio ? { sampleRate: audio.sampleRate, numberOfChannels: audio.numberOfChannels } : null,
  });

  // Ship audio in ~1024-sample interleaved-planar chunks
  if (audio) {
    const channels = audio.numberOfChannels;
    const total = audio.length;
    const frameSize = 1024;
    // Extract all channel data once
    const chans: Float32Array[] = [];
    for (let c = 0; c < channels; c++) chans.push(audio.getChannelData(c));
    for (let start = 0; start < total; start += frameSize) {
      if (signal?.aborted) break;
      const frames = Math.min(frameSize, total - start);
      // Planar layout: [ch0..., ch1..., ...]
      const buf = new Float32Array(frames * channels);
      for (let c = 0; c < channels; c++) {
        buf.set(chans[c].subarray(start, start + frames), c * frames);
      }
      const timestampUs = Math.round((start / audio.sampleRate) * 1_000_000);
      worker.postMessage({ type: "audio", pcm: buf, timestampUs, frames }, [buf.buffer]);
    }
  }

  if (signal?.aborted) { worker.terminate(); throw new Error("aborted"); }

  // Fast path: demux + decode via WebCodecs. Frames flow at hardware speed
  // rather than realtime. Falls back to the <video>.play() loop below if the
  // source can't be demuxed (non-MP4, unusual codec, corrupt moov, etc).
  let usedDemux = false;
  if (isDemuxDecodeSupported()) {
    try {
      let announced = false;
      await demuxDecodeMp4({
        mediaUrl,
        signal,
        onProgress,
        onFrame: (frame, timeSec) => {
          if (!announced) { announced = true; opts.onPath?.("demux-decode"); }
          opts.onFrameEncoded?.();
          worker.postMessage({ type: "frame", frame, timeSec }, [frame as unknown as Transferable]);
        },
      });
      usedDemux = true;
    } catch (e) {
      if (signal?.aborted) { worker.terminate(); throw e; }
       
      console.warn("[export] demux path failed, falling back to realtime playback:", e);
    }
  }

  if (!usedDemux) {
    opts.onPath?.("realtime-playback");
    // Realtime fallback — hidden <video> played at 1x, frames captured via
    // requestVideoFrameCallback.
    const anyVideo = video as HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: (now: number, meta: { mediaTime: number }) => void) => number;
    };

    const frameLoopDone = new Promise<void>((resolve, reject) => {
      let cancelled = false;
      const onAbort = () => { cancelled = true; try { video.pause(); } catch {} reject(new Error("aborted")); };
      signal?.addEventListener("abort", onAbort, { once: true });

      const finish = () => { if (!cancelled) resolve(); };
      video.addEventListener("ended", finish, { once: true });

      if (typeof anyVideo.requestVideoFrameCallback === "function") {
        const tick = (_now: number, meta: { mediaTime: number }) => {
          if (cancelled) return;
          try {
            const vf = new (window as any).VideoFrame(video, {
              timestamp: Math.round(meta.mediaTime * 1_000_000),
            }) as VideoFrame;
            worker.postMessage({ type: "frame", frame: vf, timeSec: meta.mediaTime }, [vf]);
            opts.onFrameEncoded?.();
            if (onProgress && duration > 0) onProgress(Math.min(1, meta.mediaTime / duration));
          } catch {}
          if (video.ended || video.paused) return;
          anyVideo.requestVideoFrameCallback!(tick);
        };
        anyVideo.requestVideoFrameCallback(tick);
      } else {
        const tick = () => {
          if (cancelled) return;
          try {
            const vf = new (window as any).VideoFrame(video, {
              timestamp: Math.round(video.currentTime * 1_000_000),
            }) as VideoFrame;
            worker.postMessage({ type: "frame", frame: vf, timeSec: video.currentTime }, [vf]);
            opts.onFrameEncoded?.();
            if (onProgress && duration > 0) onProgress(Math.min(1, video.currentTime / duration));
          } catch {}
          if (video.ended || video.paused) return;
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    });

    await video.play();
    try {
      await frameLoopDone;
    } catch (e) {
      worker.terminate();
      throw e;
    }
  }

  worker.postMessage({ type: "finish" });
  const blob = await done;
  worker.terminate();

  const url = URL.createObjectURL(blob);
  const filename = (opts.filename ?? "captioned-video") + ".mp4";
  return { blob, url, filename };
}
