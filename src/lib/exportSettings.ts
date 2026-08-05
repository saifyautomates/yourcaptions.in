// User-configurable export encoding settings.
//
// The worker still discovers what the local encoder actually supports at
// runtime — these settings just describe the user's *preference*. If a
// preferred codec/level combo isn't supported, the worker falls back through
// the candidate list.

import type { ExportResolution } from "./exportVideo";
import { RESOLUTION_DIMS } from "./exportVideo";

export type H264Profile = "baseline" | "main" | "high";
export type H264Level =
  | "3.0" | "3.1" | "3.2" | "4.0" | "4.1" | "4.2" | "5.0" | "5.1" | "5.2";

export interface EncodeSettings {
  resolution: ExportResolution;
  profile: H264Profile;
  level: H264Level;
  /** Video bitrate in bits/second. */
  bitrate: number;
  /** Target frame rate. */
  fps: number;
}

/** Named presets exposed in the UI. */
export type PresetKey =
  | "balanced"
  | "high-quality"
  | "small-file"
  | "compatibility"
  | "custom";

export const PROFILE_IDC: Record<H264Profile, string> = {
  baseline: "42",
  main: "4d",
  high: "64",
};

// Constraint flag byte. `E0` (all constraints set) is the safest default for
// baseline; other profiles use `00`.
const CONSTRAINT_BYTE: Record<H264Profile, string> = {
  baseline: "e0",
  main: "40",
  high: "00",
};

const LEVEL_IDC: Record<H264Level, string> = {
  "3.0": "1e", "3.1": "1f", "3.2": "20",
  "4.0": "28", "4.1": "29", "4.2": "2a",
  "5.0": "32", "5.1": "33", "5.2": "34",
};

/** Build the `avc1.PPCCLL` codec string. */
export const buildAvc1Codec = (profile: H264Profile, level: H264Level) =>
  `avc1.${PROFILE_IDC[profile]}${CONSTRAINT_BYTE[profile]}${LEVEL_IDC[level]}`;

/**
 * Best-fit H.264 level for a given resolution + frame rate.
 * Uses the H.264 spec's MaxMBPS (macroblocks/second) and MaxFS (frame size in
 * macroblocks) caps and picks the lowest level that clears both. Levels 3.0
 * and 4.0 are skipped because 3.1 and 4.1 have the same caps but are the more
 * conventional labels for 720p and 1080p, respectively.
 */
const LEVEL_CAPS: Array<{ level: H264Level; maxMbps: number; maxFs: number }> = [
  { level: "3.1", maxMbps: 108_000,   maxFs: 3_600 },
  { level: "3.2", maxMbps: 216_000,   maxFs: 5_120 },
  { level: "4.1", maxMbps: 245_760,   maxFs: 8_192 },
  { level: "4.2", maxMbps: 522_240,   maxFs: 8_704 },
  { level: "5.0", maxMbps: 589_824,   maxFs: 22_080 },
  { level: "5.1", maxMbps: 983_040,   maxFs: 36_864 },
  { level: "5.2", maxMbps: 2_073_600, maxFs: 36_864 },
];

export const recommendedLevel = (res: ExportResolution, fps: number): H264Level => {
  const { w, h } = RESOLUTION_DIMS[res];
  const fs = Math.ceil(w / 16) * Math.ceil(h / 16);
  const mbps = fs * fps;
  for (const cap of LEVEL_CAPS) {
    if (cap.maxMbps >= mbps && cap.maxFs >= fs) return cap.level;
  }
  return "5.2";
};

/** Recommended bitrate (bps) for a given resolution — a balanced streaming target. */
export const recommendedBitrate = (res: ExportResolution): number => {
  const { w, h } = RESOLUTION_DIMS[res];
  const px = w * h;
  if (px >= 3840 * 2160) return 40_000_000;
  if (px >= 2560 * 1440) return 20_000_000;
  if (px >= 1920 * 1080) return 12_000_000;
  return 6_000_000;
};

/** Bitrate range shown in the UI (min, max) per resolution, in Mbps. */
export const bitrateRangeMbps = (res: ExportResolution): { min: number; max: number } => {
  switch (res) {
    case "4k":    return { min: 15, max: 80 };
    case "1440p": return { min: 8,  max: 45 };
    case "1080p": return { min: 4,  max: 25 };
    case "720p":  return { min: 2,  max: 15 };
  }
};

export const applyPreset = (preset: PresetKey, res: ExportResolution, fps = 30): EncodeSettings => {
  const level = recommendedLevel(res, fps);
  const base: EncodeSettings = {
    resolution: res, fps, profile: "high", level,
    bitrate: recommendedBitrate(res),
  };
  switch (preset) {
    case "balanced":     return base;
    case "high-quality": return { ...base, bitrate: Math.round(recommendedBitrate(res) * 1.8) };
    case "small-file":   return { ...base, profile: "main", bitrate: Math.round(recommendedBitrate(res) * 0.55) };
    case "compatibility":return { ...base, profile: "baseline", level: "4.0", bitrate: Math.round(recommendedBitrate(res) * 0.75) };
    case "custom":       return base;
  }
};

export interface PresetOption {
  key: PresetKey;
  label: string;
  description: string;
}
export const PRESETS: PresetOption[] = [
  { key: "balanced",      label: "Balanced",       description: "High profile, streaming-friendly bitrate." },
  { key: "high-quality",  label: "High quality",   description: "Larger file, minimal compression artifacts." },
  { key: "small-file",    label: "Small file",     description: "Main profile at ~55% bitrate. Great for sharing." },
  { key: "compatibility", label: "Compatibility",  description: "Baseline profile — plays on older phones and low-end devices." },
  { key: "custom",        label: "Custom",         description: "Choose your own profile, level and bitrate." },
];

export interface Warning { level: "warn" | "info"; message: string }

/** Sanity checks that turn into inline hints in the UI. */
export const settingsWarnings = (s: EncodeSettings): Warning[] => {
  const out: Warning[] = [];
  const { w, h } = RESOLUTION_DIMS[s.resolution];
  const px = w * h;
  const rec = recommendedBitrate(s.resolution);

  if (s.bitrate < rec * 0.4) {
    out.push({ level: "warn", message: "Bitrate is well below the recommended range — expect visible blocking and banding on motion-heavy scenes." });
  } else if (s.bitrate > rec * 3) {
    out.push({ level: "info", message: "Bitrate is much higher than typical for this resolution. The file will be very large without a noticeable quality gain." });
  }

  if (s.profile === "baseline" && px >= 1920 * 1080) {
    out.push({ level: "warn", message: "Baseline profile at 1080p+ sacrifices efficiency for old-device support. Prefer High or Main unless you specifically need it." });
  }

  const levelMax: Record<H264Level, number> = {
    "3.0": 720 * 576, "3.1": 1280 * 720, "3.2": 1280 * 720,
    "4.0": 1920 * 1080, "4.1": 1920 * 1080, "4.2": 1920 * 1080,
    "5.0": 2560 * 1920, "5.1": 3840 * 2160, "5.2": 4096 * 2304,
  };
  if (px > levelMax[s.level]) {
    out.push({ level: "warn", message: `Level ${s.level} is below what ${w}×${h} typically requires. Some players will refuse the file — consider level ${recommendedLevel(s.resolution, s.fps)}.` });
  }

  if (s.fps >= 60 && s.bitrate < rec * 1.3) {
    out.push({ level: "info", message: "60 fps at streaming-tier bitrate can look soft during fast motion. Consider raising bitrate ~30%." });
  }

  return out;
};

/** Estimate the finished file size (bytes) for a video of `durationSec` at these settings. */
export const estimateFileSize = (s: EncodeSettings, durationSec: number): number => {
  // Assume ~192 kbps AAC audio.
  return Math.round(((s.bitrate + 192_000) / 8) * durationSec);
};

export const fmtBitrate = (bps: number) => `${(bps / 1_000_000).toFixed(bps < 1_000_000 ? 2 : 1)} Mbps`;
export const fmtFileSize = (bytes: number) => {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
};

export const LEVELS: H264Level[] = ["3.0", "3.1", "3.2", "4.0", "4.1", "4.2", "5.0", "5.1", "5.2"];
export const PROFILES: H264Profile[] = ["baseline", "main", "high"];
