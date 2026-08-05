// Off-main-thread video export worker.
// Receives raw VideoFrames + PCM chunks from the main thread, burns styled
// captions onto each frame on an OffscreenCanvas, encodes with WebCodecs
// (H.264 + AAC), and muxes into an MP4 with mp4-muxer.
//
// Zero main-thread work during encode — the tab stays fully interactive even
// at 4K.

/// <reference lib="webworker" />

import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import type { CapStyle } from "@/lib/captionStyle";
import { applyTextCase, hexToRgbTuple, getVisibleWords, normalizeCapStyle, type WordTiming } from "@/lib/captionStyle";

interface Segment { start: number; end: number; text: string; words?: WordTiming[] }

type InitMsg = {
  type: "init";
  width: number;
  height: number;
  fps: number;
  bitrate: number;
  preferredCodec?: string;
  capStyle: CapStyle;
  segs: Segment[];
  sourceW: number;
  sourceH: number;
  audio: { sampleRate: number; numberOfChannels: number } | null;
};
type FrameMsg = { type: "frame"; frame: VideoFrame; timeSec: number };
type AudioMsg = { type: "audio"; pcm: Float32Array; timestampUs: number; frames: number };
type FinishMsg = { type: "finish" };

// Reused state
let cfg: InitMsg | null = null;
let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let muxer: Muxer<ArrayBufferTarget> | null = null;
let videoEncoder: VideoEncoder | null = null;
let audioEncoder: AudioEncoder | null = null;
let frameCount = 0;
let keyframeInterval = 60;
let drawParams = { dx: 0, dy: 0, dw: 0, dh: 0, capScale: 1 };

const drawRoundedRect = (c: OffscreenCanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  const rr = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rr, y);
  c.lineTo(x + w - rr, y);
  c.quadraticCurveTo(x + w, y, x + w, y + rr);
  c.lineTo(x + w, y + h - rr);
  c.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  c.lineTo(x + rr, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - rr);
  c.lineTo(x, y + rr);
  c.quadraticCurveTo(x, y, x + rr, y);
  c.closePath();
};

const findActiveSeg = (segs: Segment[], t: number) => {
  for (let i = 0; i < segs.length; i++) if (t >= segs[i].start && t <= segs[i].end) return i;
  return -1;
};

const drawCaption = (c: OffscreenCanvasRenderingContext2D, W: number, H: number, scale: number, words: string[], activeIndex: number, rawStyle: CapStyle) => {
  if (!words.length) return;
  const s = normalizeCapStyle(rawStyle);
  const weight = s.italic ? `italic ${s.fontWeight}` : `${s.fontWeight}`;
  const safeWidth = W * 0.86;
  const safeHeight = H * 0.72;
  let size = s.fontSize * scale;
  size = Math.max(12 * scale, Math.min(size, W * 0.095, H * 0.105));
  c.font = `${weight} ${size}px ${s.fontFamily}`;
  c.textBaseline = "middle";
  (c as any).letterSpacing = `${s.letterSpacing * scale}px`;
  c.textAlign = s.align as CanvasTextAlign;

  type Token = { text: string; idx: number };
  const tokens = words.map((text, idx) => ({ text: applyTextCase(text, s.textCase), idx }));
  const lines: Token[][] = [];
  let cur: Token[] = [];
  for (const tok of tokens) {
    const trial = [...cur, tok].map((x) => x.text).join(" ");
    if (cur.length && c.measureText(trial).width > safeWidth) { lines.push(cur); cur = [tok]; }
    else cur.push(tok);
  }
  if (cur.length) lines.push(cur);
  const minScale = 0.55;
  while (lines.length * size * s.lineHeight > safeHeight && size > s.fontSize * scale * minScale) {
    size *= 0.92;
    c.font = `${weight} ${size}px ${s.fontFamily}`;
  }
  const lineH = size * s.lineHeight;
  const blockH = lineH * lines.length;
  const padSafeX = W * 0.07;
  const padSafeTop = H * 0.06;
  const padSafeBottom = H * 0.12;
  const cx = Math.max(padSafeX, Math.min(W - padSafeX, (s.posX / 100) * W));
  const cy = Math.max(padSafeTop + blockH / 2, Math.min(H - padSafeBottom - blockH / 2, (s.posY / 100) * H));
  const top = cy - blockH / 2 + lineH / 2;

  if (s.bgOn) {
    const padX = s.bgPadX * scale, padY = s.bgPadY * scale;
    c.save();
    c.fillStyle = `rgba(${hexToRgbTuple(s.bgColor)},${s.bgOpacity / 100})`;
    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i].map((x) => x.text).join(" ");
      const w = c.measureText(lineText).width;
      const y = top + i * lineH;
      let x = cx;
      if (s.align === "left") x = cx;
      else if (s.align === "right") x = cx - w;
      else x = cx - w / 2;
      drawRoundedRect(c, x - padX, y - lineH / 2 - padY / 2, w + padX * 2, lineH + padY, s.bgRadius * scale);
      c.fill();
    }
    c.restore();
  }

  const paintText = (text: string, x: number, y: number, active: boolean) => {
    const color = active && s.activeWordOn ? s.activeWordColor : s.color;
    const bgColor = active && s.activeWordOn && s.activeWordBgOn ? s.activeWordBgColor : null;
    if (bgColor) {
      const w = c.measureText(text).width;
      c.save();
      c.fillStyle = bgColor;
      drawRoundedRect(c, x - 4 * scale, y - lineH / 2, w + 8 * scale, lineH, 6 * scale);
      c.fill();
      c.restore();
    }
    if (s.glowOn) {
      c.save();
      c.shadowColor = `rgba(${hexToRgbTuple(s.glowColor)},${s.glowIntensity / 100})`;
      c.shadowBlur = s.glowBlur * scale;
      c.fillStyle = c.shadowColor;
      for (let i = 0; i < 3; i++) c.fillText(text, x, y);
      c.restore();
    }
    if (s.shadowOn) {
      c.save();
      c.shadowColor = `rgba(${hexToRgbTuple(s.shadowColor)},${s.shadowOpacity / 100})`;
      c.shadowOffsetX = s.shadowX * scale;
      c.shadowOffsetY = s.shadowY * scale;
      c.shadowBlur = s.shadowBlur * scale;
      c.fillStyle = s.colorMode === "solid" ? color : "#ffffff";
      c.fillText(text, x, y);
      c.restore();
    }
    if (s.strokeOn) {
      c.save();
      c.lineWidth = s.strokeWidth * scale * 2;
      c.strokeStyle = s.strokeColor;
      c.lineJoin = "round";
      c.miterLimit = 2;
      c.strokeText(text, x, y);
      c.restore();
    }
    c.save();
    if (s.colorMode === "gradient") {
      const w = c.measureText(text).width;
      const rad = (s.gradAngle * Math.PI) / 180;
      const dx = Math.cos(rad) * w / 2, dy = Math.sin(rad) * lineH / 2;
      const g = c.createLinearGradient(x - dx, y - dy, x + dx, y + dy);
      g.addColorStop(0, s.gradFrom);
      g.addColorStop(1, s.gradTo);
      c.fillStyle = active && s.activeWordOn && !s.activeWordBgOn ? color : g;
    } else {
      c.fillStyle = color;
    }
    c.fillText(text, x, y);
    if (s.underline) {
      const w = c.measureText(text).width;
      c.fillRect(x, y + size * 0.42, w, Math.max(1, size * 0.06));
    }
    c.restore();
  };
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const lineText = line.map((x) => x.text).join(" ");
    const lineW = c.measureText(lineText).width;
    let x = s.align === "left" ? cx : s.align === "right" ? cx - lineW : cx - lineW / 2;
    const y = top + lineIdx * lineH;
    line.forEach((tok, tokIdx) => {
      const text = tok.text + (tokIdx < line.length - 1 ? " " : "");
      paintText(text, x, y, tok.idx === activeIndex);
      x += c.measureText(text).width;
    });
  }
};

// Pick the best H.264 codec string for the target resolution. Chrome/Edge HW
// encoders accept these; Safari 16.4+ accepts the same profiles.
const codecForSize = (w: number, h: number) => {
  const px = w * h;
  if (px >= 3840 * 2160) return "avc1.640033"; // High 5.1 — 4K
  if (px >= 2560 * 1440) return "avc1.640032"; // High 5.0 — 1440p
  if (px >= 1920 * 1080) return "avc1.64002a"; // High 4.2 — 1080p
  return "avc1.4d0028";                        // Main 4.0 — 720p
};

async function pickSupportedVideoCodec(width: number, height: number, fps: number, bitrate: number, preferred?: string) {
  // Preferred codec (user-selected profile/level) is tried first, then a
  // sensible auto default, then a broadly-compatible baseline fallback.
  const seen = new Set<string>();
  const candidates = [preferred, codecForSize(width, height), "avc1.640028", "avc1.42E01F"]
    .filter((c): c is string => !!c && !seen.has(c) && (seen.add(c), true));
  for (const codec of candidates) {
    try {
      const r = await VideoEncoder.isConfigSupported({
        codec, width, height, framerate: fps, bitrate,
        hardwareAcceleration: "prefer-hardware",
        avc: { format: "avc" },
      } as any);
      if (r.supported) return { codec, hw: true as const };
    } catch {}
    try {
      const r2 = await VideoEncoder.isConfigSupported({
        codec, width, height, framerate: fps, bitrate,
        avc: { format: "avc" },
      } as any);
      if (r2.supported) return { codec, hw: false as const };
    } catch {}
  }
  throw new Error("No supported H.264 encoder configuration for this device.");
}

async function initEncoders(msg: InitMsg) {
  cfg = msg;
  canvas = new OffscreenCanvas(msg.width, msg.height);
  ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const scaleFit = Math.min(msg.width / msg.sourceW, msg.height / msg.sourceH);
  const dw = msg.sourceW * scaleFit, dh = msg.sourceH * scaleFit;
  drawParams = {
    dx: (msg.width - dw) / 2,
    dy: (msg.height - dh) / 2,
    dw, dh,
    capScale: msg.width / 720,
  };
  keyframeInterval = Math.max(30, msg.fps * 2);

  muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: "avc", width: msg.width, height: msg.height, frameRate: msg.fps },
    audio: msg.audio
      ? { codec: "aac", numberOfChannels: msg.audio.numberOfChannels, sampleRate: msg.audio.sampleRate }
      : undefined,
    fastStart: "in-memory",
    firstTimestampBehavior: "offset",
  });

  const { codec, hw } = await pickSupportedVideoCodec(msg.width, msg.height, msg.fps, msg.bitrate, msg.preferredCodec);
  videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer!.addVideoChunk(chunk, meta),
    error: (e) => (self as any).postMessage({ type: "error", message: String(e?.message ?? e) }),
  });
  videoEncoder.configure({
    codec, width: msg.width, height: msg.height, framerate: msg.fps, bitrate: msg.bitrate,
    ...(hw ? { hardwareAcceleration: "prefer-hardware" } : {}),
    avc: { format: "avc" },
  } as any);

  if (msg.audio) {
    audioEncoder = new AudioEncoder({
      output: (chunk, meta) => muxer!.addAudioChunk(chunk, meta),
      error: (e) => (self as any).postMessage({ type: "error", message: String(e?.message ?? e) }),
    });
    audioEncoder.configure({
      codec: "mp4a.40.2",
      sampleRate: msg.audio.sampleRate,
      numberOfChannels: msg.audio.numberOfChannels,
      bitrate: 192_000,
    });
  }
}

function handleFrame(vf: VideoFrame, timeSec: number) {
  if (!cfg || !ctx || !videoEncoder || !canvas) { vf.close(); return; }
  const { width: W, height: H } = cfg;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  try {
    ctx.drawImage(vf as unknown as CanvasImageSource, drawParams.dx, drawParams.dy, drawParams.dw, drawParams.dh);
  } catch {}
  vf.close();

  const idx = findActiveSeg(cfg.segs, timeSec);
  if (idx >= 0) {
    const seg = cfg.segs[idx];
    const shown = getVisibleWords(seg.text, seg.start, seg.end, timeSec, cfg.capStyle.wordsPerChunk, seg.words);
    drawCaption(ctx, W, H, drawParams.capScale, shown.words, shown.activeIndex, cfg.capStyle);
  }

  const outFrame = new VideoFrame(canvas as any, {
    timestamp: Math.round(timeSec * 1_000_000),
    duration: Math.round(1_000_000 / cfg.fps),
  });
  const keyFrame = frameCount % keyframeInterval === 0;
  videoEncoder.encode(outFrame, { keyFrame });
  outFrame.close();
  frameCount++;
}

function handleAudio(pcm: Float32Array, timestampUs: number, frames: number) {
  if (!audioEncoder || !cfg?.audio) return;
  const ad = new AudioData({
    format: "f32-planar",
    sampleRate: cfg.audio.sampleRate,
    numberOfFrames: frames,
    numberOfChannels: cfg.audio.numberOfChannels,
    timestamp: timestampUs,
    data: pcm.buffer as ArrayBuffer,
  });
  audioEncoder.encode(ad);
  ad.close();
}

async function finalize() {
  try {
    await videoEncoder?.flush();
    await audioEncoder?.flush();
    videoEncoder?.close();
    audioEncoder?.close();
    muxer!.finalize();
    const buf = (muxer!.target as ArrayBufferTarget).buffer;
    const blob = new Blob([buf], { type: "video/mp4" });
    (self as any).postMessage({ type: "done", blob });
  } catch (e: any) {
    (self as any).postMessage({ type: "error", message: String(e?.message ?? e) });
  }
}

self.onmessage = async (ev: MessageEvent<InitMsg | FrameMsg | AudioMsg | FinishMsg>) => {
  const msg = ev.data;
  try {
    if (msg.type === "init") await initEncoders(msg);
    else if (msg.type === "frame") handleFrame(msg.frame, msg.timeSec);
    else if (msg.type === "audio") handleAudio(msg.pcm, msg.timestampUs, msg.frames);
    else if (msg.type === "finish") await finalize();
  } catch (e: any) {
    (self as any).postMessage({ type: "error", message: String(e?.message ?? e) });
  }
};
