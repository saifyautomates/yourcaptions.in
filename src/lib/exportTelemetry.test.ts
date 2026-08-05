import { describe, it, expect } from "vitest";
import { categorizeError } from "@/lib/exportTelemetry";

describe("categorizeError", () => {
  it("returns 'abort' when the caller signals abort, regardless of message", () => {
    expect(categorizeError(new Error("anything at all"), true)).toBe("abort");
  });

  it("recognizes encoder / codec failures", () => {
    expect(categorizeError(new Error("No supported H.264 encoder configuration"), false)).toBe("codec");
    expect(categorizeError(new Error("codec avc1.640033 not supported"), false)).toBe("codec");
  });

  it("recognizes demux/decode failures", () => {
    expect(categorizeError(new Error("VideoDecoder: hardware error"), false)).toBe("decode");
    expect(categorizeError(new Error("mp4box: box parse failed"), false)).toBe("decode");
    expect(categorizeError(new Error("Unsupported codec (no avcC/hvcC description)"), false)).toBe("decode");
  });

  it("recognizes quota + network failures", () => {
    expect(categorizeError(new Error("quota exceeded"), false)).toBe("quota");
    expect(categorizeError(new Error("HTTP 402 Payment Required"), false)).toBe("quota");
    expect(categorizeError(new Error("Failed to load source video"), false)).toBe("network");
    expect(categorizeError(new Error("fetch failed"), false)).toBe("network");
  });

  it("falls back to 'unknown' for anything else", () => {
    expect(categorizeError(new Error("something weird"), false)).toBe("unknown");
    expect(categorizeError(null, false)).toBe("unknown");
    expect(categorizeError(undefined, false)).toBe("unknown");
  });
});
