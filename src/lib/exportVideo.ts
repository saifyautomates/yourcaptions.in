// Client-side video exporter — burns styled captions into a new video using
// Canvas + WebAudio + MediaRecorder. Plays the source through in real time.
//
// Notes:
//   - MediaRecorder in Chrome/Edge supports "video/webm" reliably; some builds
//     also support "video/mp4;codecs=avc1,mp4a.40.2". We pick the best.
//   - Resolutions are the canvas output size. If the source is smaller, we
//     upscale (won't add real detail but keeps the container size).
//   - Captions replicate CapStyle: gradient/solid fill, stroke, shadow, glow,
//     background pill, textCase, alignment, position (%), word-per-chunk pop.

import { CapStyle, applyTextCase, hexToRgbTuple, getVisibleChunk } from "./captionStyle";

export interface Segment { start: number; end: number; text: string }

export type ExportResolution = "720p" | "1080p" | "1440p" | "4k";

export const RESOLUTION_DIMS: Record<ExportResolution, { w: number; h: number; label: string }> = {
  "720p":  { w: 1280, h: 720,  label: "HD 720p" },
  "1080p": { w: 1920, h: 1080, label: "Full HD 1080p" },
  "1440p": { w: 2560, h: 1440, label: "QHD 1440p" },
  "4k":    { w: 3840, h: 2160, label: "Ultra HD 4K" },
};

const pickMimeType = (): { mime: string; ext: "mp4" | "webm" } => {
  const candidates: { mime: string; ext: "mp4" | "webm" }[] = [
    { mime: "video/mp4;codecs=avc1.640028,mp4a.40.2", ext: "mp4" },
    { mime: "video/mp4;codecs=avc1,mp4a.40.2",        ext: "mp4" },
    { mime: "video/webm;codecs=vp9,opus",             ext: "webm" },
    { mime: "video/webm;codecs=vp8,opus",             ext: "webm" },
    { mime: "video/webm",                             ext: "webm" },
  ];
  const MR = (window as any).MediaRecorder;
  if (!MR) return { mime: "video/webm", ext: "webm" };
  for (const c of candidates) if (MR.isTypeSupported?.(c.mime)) return c;
  return { mime: "video/webm", ext: "webm" };
};

const bitrateFor = (w: number, h: number) => {
  const px = w * h;
  if (px >= 3840 * 2160) return 40_000_000;
  if (px >= 2560 * 1440) return 20_000_000;
  if (px >= 1920 * 1080) return 12_000_000;
  return 6_000_000;
};

const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
};

const findActiveSeg = (segs: Segment[], t: number) => {
  for (let i = 0; i < segs.length; i++) if (t >= segs[i].start && t <= segs[i].end) return i;
  return -1;
};

const drawCaption = (
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  scale: number,
  text: string,
  s: CapStyle,
) => {
  if (!text) return;
  const weight = s.italic ? `italic ${s.fontWeight}` : `${s.fontWeight}`;
  const size = s.fontSize * scale;
  ctx.font = `${weight} ${size}px ${s.fontFamily}`;
  ctx.textBaseline = "middle";
  // Canvas letterSpacing is Chromium 99+ / recent Firefox. Safe to set.
  (ctx as any).letterSpacing = `${s.letterSpacing * scale}px`;
  ctx.textAlign = s.align as CanvasTextAlign;

  const cased = applyTextCase(text, s.textCase);
  // Support explicit \n plus a max-width wrap (~86% of canvas width).
  const maxW = W * 0.86;
  const paragraphs = cased.split(/\n/);
  const lines: string[] = [];
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { lines.push(""); continue; }
    let cur = words[0];
    for (let i = 1; i < words.length; i++) {
      const trial = cur + " " + words[i];
      if (ctx.measureText(trial).width > maxW) { lines.push(cur); cur = words[i]; }
      else cur = trial;
    }
    lines.push(cur);
  }

  const lineH = size * s.lineHeight;
  const blockH = lineH * lines.length;
  const cx = (s.posX / 100) * W;
  const cy = (s.posY / 100) * H;
  const top = cy - blockH / 2 + lineH / 2;

  // Background pill (per-line)
  if (s.bgOn) {
    const padX = s.bgPadX * scale, padY = s.bgPadY * scale;
    ctx.save();
    ctx.fillStyle = `rgba(${hexToRgbTuple(s.bgColor)},${s.bgOpacity / 100})`;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const w = ctx.measureText(line).width;
      const y = top + i * lineH;
      let x = cx;
      if (s.align === "left") x = cx;
      else if (s.align === "right") x = cx - w;
      else x = cx - w / 2;
      drawRoundedRect(ctx, x - padX, y - lineH / 2 - padY / 2, w + padX * 2, lineH + padY, s.bgRadius * scale);
      ctx.fill();
    }
    ctx.restore();
  }

  const paintLine = (line: string, y: number) => {
    // Glow (draw as offset blurred fills)
    if (s.glowOn) {
      ctx.save();
      ctx.shadowColor = `rgba(${hexToRgbTuple(s.glowColor)},${s.glowIntensity / 100})`;
      ctx.shadowBlur = s.glowBlur * scale;
      ctx.fillStyle = ctx.shadowColor;
      // Multiple passes for stronger glow
      for (let i = 0; i < 3; i++) ctx.fillText(line, cx, y);
      ctx.restore();
    }
    // Drop shadow
    if (s.shadowOn) {
      ctx.save();
      ctx.shadowColor = `rgba(${hexToRgbTuple(s.shadowColor)},${s.shadowOpacity / 100})`;
      ctx.shadowOffsetX = s.shadowX * scale;
      ctx.shadowOffsetY = s.shadowY * scale;
      ctx.shadowBlur = s.shadowBlur * scale;
      // Paint a transparent fill to project the shadow
      ctx.fillStyle = "rgba(0,0,0,0)";
      ctx.fillText(line, cx, y);
      // Actually canvas shadow requires a visible fill; paint the main fill under shadow
      ctx.fillStyle = s.colorMode === "solid" ? s.color : "#ffffff";
      ctx.fillText(line, cx, y);
      ctx.restore();
    }
    // Stroke
    if (s.strokeOn) {
      ctx.save();
      ctx.lineWidth = s.strokeWidth * scale * 2; // outer half is preserved
      ctx.strokeStyle = s.strokeColor;
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;
      ctx.strokeText(line, cx, y);
      ctx.restore();
    }
    // Fill
    ctx.save();
    if (s.colorMode === "gradient") {
      const w = ctx.measureText(line).width;
      const rad = (s.gradAngle * Math.PI) / 180;
      const dx = Math.cos(rad) * w / 2, dy = Math.sin(rad) * lineH / 2;
      const g = ctx.createLinearGradient(cx - dx, y - dy, cx + dx, y + dy);
      g.addColorStop(0, s.gradFrom);
      g.addColorStop(1, s.gradTo);
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = s.color;
    }
    ctx.fillText(line, cx, y);
    // Underline
    if (s.underline) {
      const w = ctx.measureText(line).width;
      let x0 = cx;
      if (s.align === "left") x0 = cx;
      else if (s.align === "right") x0 = cx - w;
      else x0 = cx - w / 2;
      ctx.fillRect(x0, y + size * 0.42, w, Math.max(1, size * 0.06));
    }
    ctx.restore();
  };

  for (let i = 0; i < lines.length; i++) paintLine(lines[i], top + i * lineH);
};

export interface ExportOptions {
  mediaUrl: string;
  segs: Segment[];
  capStyle: CapStyle;
  resolution: ExportResolution;
  filename?: string;
  onProgress?: (pct: number) => void;
  signal?: AbortSignal;
}

export async function exportVideoWithCaptions(opts: ExportOptions): Promise<{ blob: Blob; url: string; filename: string }> {
  const { mediaUrl, segs, capStyle, resolution, onProgress, signal } = opts;
  const { w: W, h: H } = RESOLUTION_DIMS[resolution];

  // Hidden video element (own instance so we don't fight the editor's <video>)
  const video = document.createElement("video");
  video.src = mediaUrl;
  video.crossOrigin = "anonymous";
  video.muted = false;
  video.playsInline = true;
  video.preload = "auto";
  (video as any).playsInline = true;

  await new Promise<void>((resolve, reject) => {
    const onErr = () => reject(new Error("Failed to load source video for export"));
    video.addEventListener("loadedmetadata", () => resolve(), { once: true });
    video.addEventListener("error", onErr, { once: true });
  });

  const vw = video.videoWidth || W;
  const vh = video.videoHeight || H;

  // Fit source into canvas while preserving aspect ratio
  const scaleFit = Math.min(W / vw, H / vh);
  const drawW = vw * scaleFit;
  const drawH = vh * scaleFit;
  const dx = (W - drawW) / 2;
  const dy = (H - drawH) / 2;

  // Caption size scale factor. The editor preview canvases at ~720px max width;
  // scale caption metrics up to the target canvas width for perceived parity.
  const capScale = W / 720;

  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Audio graph — route the source's audio into the recorded stream
  const AudioCtx: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioCtx();
  const source = audioCtx.createMediaElementSource(video);
  const dest = audioCtx.createMediaStreamDestination();
  source.connect(dest);
  // Keep playback audible? no — we don't want it playing to speakers during export
  // (Not connecting to audioCtx.destination keeps it silent to the user.)

  const videoStream = (canvas as any).captureStream(30) as MediaStream;
  const audioTracks = dest.stream.getAudioTracks();
  const combined = new MediaStream([...videoStream.getVideoTracks(), ...audioTracks]);

  const { mime, ext } = pickMimeType();
  const recorder = new MediaRecorder(combined, {
    mimeType: mime,
    videoBitsPerSecond: bitrateFor(W, H),
    audioBitsPerSecond: 192_000,
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };

  const stopped = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });

  // Fill background black once (for letterbox bars)
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);

  recorder.start(1000);

const drawWatermark = (c: CanvasRenderingContext2D, W: number, H: number, scale: number) => {
  c.save();
  const text = "YourCaptions.in";
  const fontSize = Math.max(13, Math.round(16 * scale));
  c.font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`;
  c.textBaseline = "middle";
  c.textAlign = "left";

  const paddingX = Math.round(11 * scale);
  const paddingY = Math.round(6 * scale);
  const dotRadius = Math.round(3.5 * scale);
  const dotSpacing = Math.round(7 * scale);
  const textWidth = c.measureText(text).width;
  const pillW = textWidth + paddingX * 2 + dotRadius * 2 + dotSpacing;
  const pillH = fontSize + paddingY * 2;

  const marginX = Math.round(W * 0.04);
  const marginY = Math.round(H * 0.04);
  const x = W - marginX - pillW;
  const y = H - marginY - pillH;

  drawRoundedRect(c, x, y, pillW, pillH, pillH / 2);
  c.fillStyle = "rgba(10, 10, 12, 0.75)";
  c.fill();
  c.strokeStyle = "rgba(255, 255, 255, 0.14)";
  c.lineWidth = Math.max(1, Math.round(1 * scale));
  c.stroke();

  const dotX = x + paddingX + dotRadius;
  const dotY = y + pillH / 2;
  c.beginPath();
  c.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
  c.fillStyle = "#E60000";
  c.fill();

  const textX = dotX + dotRadius + dotSpacing;
  c.fillStyle = "rgba(255, 255, 255, 0.9)";
  c.fillText(text, textX, dotY);

  c.restore();
};

  const draw = () => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    try { ctx.drawImage(video, dx, dy, drawW, drawH); } catch {}
    const t = video.currentTime;
    const idx = findActiveSeg(segs, t);
    if (idx >= 0) {
      const seg = segs[idx];
      const shown = getVisibleChunk(seg.text, seg.start, seg.end, t, capStyle.wordsPerChunk);
      drawCaption(ctx, W, H, capScale, shown, capStyle);
    }
    if ((capStyle as any)?.watermark) {
      drawWatermark(ctx, W, H, capScale);
    }
    if (onProgress && video.duration > 0) onProgress(Math.min(1, t / video.duration));
  };

  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    try { video.pause(); } catch {}
    if (recorder.state !== "inactive") recorder.stop();
  };

  // Frame loop — prefer requestVideoFrameCallback for tight sync
  const anyVideo = video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number };
  if (typeof anyVideo.requestVideoFrameCallback === "function") {
    const tick = () => {
      draw();
      if (video.ended || video.paused) return;
      anyVideo.requestVideoFrameCallback!(tick);
    };
    anyVideo.requestVideoFrameCallback(tick);
  } else {
    const tick = () => {
      draw();
      if (video.ended || video.paused) return;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  video.addEventListener("ended", stop, { once: true });
  signal?.addEventListener("abort", stop, { once: true });

  await video.play();
  await stopped;

  try { source.disconnect(); } catch {}
  try { await audioCtx.close(); } catch {}

  const blob = new Blob(chunks, { type: mime });
  const url = URL.createObjectURL(blob);
  const filename = (opts.filename ?? "captioned-video") + "." + ext;
  return { blob, url, filename };
}

export const triggerDownload = (url: string, filename: string) => {
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
};
