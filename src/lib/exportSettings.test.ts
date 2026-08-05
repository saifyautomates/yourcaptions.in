import { describe, it, expect } from "vitest";
import {
  buildAvc1Codec,
  recommendedLevel,
  recommendedBitrate,
  bitrateRangeMbps,
  applyPreset,
  settingsWarnings,
  estimateFileSize,
  fmtBitrate,
  fmtFileSize,
  LEVELS,
  PROFILES,
} from "@/lib/exportSettings";

describe("buildAvc1Codec", () => {
  it("emits the canonical Baseline/Main/High identifiers", () => {
    expect(buildAvc1Codec("baseline", "3.1")).toBe("avc1.42e01f");
    expect(buildAvc1Codec("main", "4.0")).toBe("avc1.4d4028");
    expect(buildAvc1Codec("high", "4.2")).toBe("avc1.64002a");
    expect(buildAvc1Codec("high", "5.1")).toBe("avc1.640033");
  });

  it("returns a valid string for every LEVELS × PROFILES combo", () => {
    for (const p of PROFILES) {
      for (const l of LEVELS) {
        const c = buildAvc1Codec(p, l);
        expect(c).toMatch(/^avc1\.[0-9a-f]{6}$/);
      }
    }
  });
});

describe("recommendedLevel", () => {
  it("picks a level that fits the resolution/framerate", () => {
    expect(recommendedLevel("720p", 30)).toBe("3.1");
    expect(recommendedLevel("1080p", 30)).toBe("4.1");
    expect(recommendedLevel("1080p", 60)).toBe("4.2");
    expect(recommendedLevel("1440p", 30)).toBe("5.0");
    expect(recommendedLevel("4k", 30)).toBe("5.1");
    expect(recommendedLevel("4k", 60)).toBe("5.2");
  });
});

describe("recommendedBitrate + bitrateRangeMbps", () => {
  it("scales with resolution", () => {
    expect(recommendedBitrate("720p")).toBeLessThan(recommendedBitrate("1080p"));
    expect(recommendedBitrate("1080p")).toBeLessThan(recommendedBitrate("1440p"));
    expect(recommendedBitrate("1440p")).toBeLessThan(recommendedBitrate("4k"));
  });
  it("keeps the recommended bitrate inside the exposed slider range", () => {
    for (const r of ["720p", "1080p", "1440p", "4k"] as const) {
      const rec = recommendedBitrate(r) / 1_000_000;
      const { min, max } = bitrateRangeMbps(r);
      expect(rec).toBeGreaterThanOrEqual(min);
      expect(rec).toBeLessThanOrEqual(max);
    }
  });
});

describe("applyPreset", () => {
  it("balanced matches recommendedBitrate exactly", () => {
    expect(applyPreset("balanced", "1080p").bitrate).toBe(recommendedBitrate("1080p"));
  });
  it("high-quality is materially higher, small-file materially lower", () => {
    const b = applyPreset("balanced", "1080p").bitrate;
    expect(applyPreset("high-quality", "1080p").bitrate).toBeGreaterThan(b * 1.5);
    expect(applyPreset("small-file", "1080p").bitrate).toBeLessThan(b * 0.75);
  });
  it("compatibility drops to baseline profile", () => {
    expect(applyPreset("compatibility", "1080p").profile).toBe("baseline");
  });
});

describe("settingsWarnings", () => {
  const base = applyPreset("balanced", "1080p");

  it("returns no warnings for a sensible balanced preset", () => {
    expect(settingsWarnings(base).filter((w) => w.level === "warn")).toEqual([]);
  });

  it("flags very low bitrate as a warning", () => {
    const s = { ...base, bitrate: 1_000_000 };
    const msgs = settingsWarnings(s);
    expect(msgs.some((w) => w.level === "warn" && /bitrate/i.test(w.message))).toBe(true);
  });

  it("flags baseline profile at 1080p+", () => {
    const s = { ...base, profile: "baseline" as const };
    expect(settingsWarnings(s).some((w) => /baseline/i.test(w.message))).toBe(true);
  });

  it("flags a level that is too low for the resolution", () => {
    const s = { ...base, level: "3.1" as const };
    expect(settingsWarnings(s).some((w) => /level/i.test(w.message))).toBe(true);
  });
});

describe("estimateFileSize", () => {
  it("grows roughly linearly with duration", () => {
    const s = applyPreset("balanced", "1080p");
    const a = estimateFileSize(s, 60);
    const b = estimateFileSize(s, 120);
    // 2x duration → ~2x size, ±5%
    expect(b / a).toBeGreaterThan(1.9);
    expect(b / a).toBeLessThan(2.1);
  });
});

describe("formatting helpers", () => {
  it("formats bitrates in Mbps", () => {
    expect(fmtBitrate(12_000_000)).toBe("12.0 Mbps");
    expect(fmtBitrate(2_500_000)).toBe("2.5 Mbps");
  });
  it("formats file sizes", () => {
    expect(fmtFileSize(500 * 1024)).toBe("500 KB");
    expect(fmtFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(fmtFileSize(2 * 1024 ** 3)).toBe("2.00 GB");
  });
});
