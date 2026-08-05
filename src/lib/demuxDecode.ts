// Faster-than-realtime demux + decode using WebCodecs.
//
// The realtime export path drives a hidden <video> element with .play() and
// samples each presented frame — that ties encode throughput to playback speed
// (1x). This module instead fetches the source file, demuxes it with MP4Box.js
// to pull raw H.264 samples + avcC description, and feeds them directly into a
// `VideoDecoder`. Decoded VideoFrames are handed to `onFrame` at the speed of
// the hardware pipeline — typically 3–10x realtime.

// mp4box has no first-class TS types; the runtime shape we use is small.
 
import * as MP4BoxModule from "mp4box";

type Mp4Sample = {
  cts: number;
  dts: number;
  duration: number;
  is_sync: boolean;
  data: Uint8Array;
  timescale: number;
};
type Mp4Track = {
  id: number;
  type: string;
  codec: string;
  timescale: number;
  duration: number;
  video?: { width: number; height: number };
  nb_samples: number;
};
type Mp4Info = { tracks: Mp4Track[]; duration: number; timescale: number };

/** Extract the avcC box bytes (H.264 decoder description) from mp4box's track entry. */
function extractAvcCDescription(file: any, trackId: number): Uint8Array | null {
  const trak = file.getTrackById(trackId);
  if (!trak) return null;
  for (const entry of trak.mdia.minf.stbl.stsd.entries) {
    const box = entry.avcC ?? entry.hvcC ?? entry.vpcC;
    if (!box) continue;
    // mp4box writes the box body via .write(stream)
    const Stream = (MP4BoxModule as any).DataStream;
    const stream = new Stream(undefined, 0, Stream.BIG_ENDIAN);
    box.write(stream);
    // Skip the 8-byte box header (size+type)
    return new Uint8Array(stream.buffer, 8);
  }
  return null;
}

export interface DemuxDecodeOptions {
  mediaUrl: string;
  signal?: AbortSignal;
  /** Called with each decoded frame. The callback OWNS the frame and must close it. */
  onFrame: (frame: VideoFrame, timeSec: number) => void | Promise<void>;
  /** Called once, before frames start flowing. */
  onReady?: (meta: { width: number; height: number; duration: number; totalFrames: number }) => void;
  onProgress?: (pct: number) => void;
  /** Cap on outstanding decode requests. Prevents unbounded memory growth. */
  maxDecodeQueue?: number;
}

export const isDemuxDecodeSupported = () =>
  typeof (globalThis as any).VideoDecoder === "function" &&
  typeof (globalThis as any).VideoFrame === "function";

/**
 * Demux an MP4 URL and decode every video sample as fast as the hardware allows.
 * Resolves when all frames have been emitted through `onFrame`.
 * Throws if the source is not a demuxable MP4/H.264 stream.
 */
export async function demuxDecodeMp4(opts: DemuxDecodeOptions): Promise<void> {
  if (!isDemuxDecodeSupported()) throw new Error("VideoDecoder unsupported");

  const { mediaUrl, signal, onFrame, onReady, onProgress } = opts;
  const maxQueue = opts.maxDecodeQueue ?? 24;

  const res = await fetch(mediaUrl, { signal });
  if (!res.ok) throw new Error(`Failed to fetch source (${res.status})`);
  const buf = await res.arrayBuffer();
  // MP4Box requires a fileStart marker on ArrayBuffer segments
  (buf as any).fileStart = 0;

  const file = (MP4BoxModule as any).createFile();

  // Wait for the moov before we know track/codec info
  const info: Mp4Info = await new Promise((resolve, reject) => {
    file.onError = (e: unknown) => reject(new Error(`mp4box: ${String(e)}`));
    file.onReady = (i: Mp4Info) => resolve(i);
    file.appendBuffer(buf as ArrayBuffer);
    file.flush();
  });

  const vTrack = info.tracks.find((t) => t.type === "video");
  if (!vTrack) throw new Error("No video track found");
  const width = vTrack.video?.width ?? 0;
  const height = vTrack.video?.height ?? 0;
  const durationSec = info.duration / info.timescale;
  const totalFrames = vTrack.nb_samples;

  const description = extractAvcCDescription(file, vTrack.id);
  if (!description) throw new Error("Unsupported codec (no avcC/hvcC description)");

  onReady?.({ width, height, duration: durationSec, totalFrames });

  // Wire the decoder
  let decoded = 0;
  let decodeError: Error | null = null;
  const framePromises: Array<Promise<void> | void> = [];

  const decoder: VideoDecoder = new (globalThis as any).VideoDecoder({
    output: (vf: VideoFrame) => {
      const timeSec = (vf.timestamp ?? 0) / 1_000_000;
      decoded++;
      if (onProgress && totalFrames > 0) onProgress(Math.min(1, decoded / totalFrames));
      // Deliver to caller. They own the frame (must .close() when done).
      const p = onFrame(vf, timeSec);
      if (p) framePromises.push(p);
    },
    error: (e) => {
      decodeError = new Error(`VideoDecoder: ${String((e as any)?.message ?? e)}`);
    },
  });

  decoder.configure({
    codec: vTrack.codec,
    codedWidth: width,
    codedHeight: height,
    description,
    hardwareAcceleration: "prefer-hardware",
    optimizeForLatency: false,
  } as VideoDecoderConfig);

  // Collect samples in decode order, feed them in
  const samples: Mp4Sample[] = await new Promise((resolve, reject) => {
    const collected: Mp4Sample[] = [];
    file.onError = (e: unknown) => reject(new Error(`mp4box: ${String(e)}`));
    file.onSamples = (_id: number, _user: unknown, chunk: Mp4Sample[]) => {
      for (const s of chunk) collected.push(s);
      if (collected.length >= vTrack.nb_samples) resolve(collected);
    };
    file.setExtractionOptions(vTrack.id, null, { nbSamples: Number.MAX_SAFE_INTEGER });
    file.start();
    // Some inputs finish immediately (single onSamples call); guard via microtask.
    queueMicrotask(() => { if (collected.length) resolve(collected); });
  });

  for (let i = 0; i < samples.length; i++) {
    if (signal?.aborted) throw new Error("aborted");
    if (decodeError) throw decodeError;
    const s = samples[i];
    // Backpressure: yield so the output callback drains
    while (decoder.decodeQueueSize > maxQueue) {
      await new Promise<void>((r) => setTimeout(r, 0));
      if (signal?.aborted) throw new Error("aborted");
      if (decodeError) throw decodeError;
    }
    const chunk = new (globalThis as any).EncodedVideoChunk({
      type: s.is_sync ? "key" : "delta",
      timestamp: Math.round((s.cts / s.timescale) * 1_000_000),
      duration: Math.round((s.duration / s.timescale) * 1_000_000),
      data: s.data,
    }) as EncodedVideoChunk;
    decoder.decode(chunk);
  }

  await decoder.flush();
  decoder.close();
  await Promise.all(framePromises);
  if (decodeError) throw decodeError;
}
