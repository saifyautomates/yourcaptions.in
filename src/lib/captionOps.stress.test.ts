import { describe, it, expect } from "vitest";
import {
  shiftDelay,
  removeGaps,
  splitSegmentAt,
  searchReplace,
  editSegmentTime,
  moveWord,
  type Segment,
} from "./captionOps";

/**
 * Stress-test the pure caption ops with a very long transcript.
 * These are the same functions the editor's timeline drag, delay slider,
 * split menu, and search/replace call — if they stay fast and correct at
 * this scale, the UI has headroom.
 */

const WORDS = [
  "hello", "world", "this", "is", "a", "long", "transcript", "used",
  "for", "stress", "testing", "the", "caption", "editor", "pipeline",
  "with", "many", "segments", "and", "words", "per", "line",
];

const makeLongTranscript = (numSegments: number, wordsPerSeg = 8): Segment[] => {
  const segs: Segment[] = [];
  let t = 0;
  for (let i = 0; i < numSegments; i++) {
    const dur = 1 + (i % 3) * 0.3;
    const start = t;
    const end = t + dur;
    const words = Array.from({ length: wordsPerSeg }, (_, k) => WORDS[(i + k) % WORDS.length]);
    const wt = words.map((w, k) => ({
      text: w,
      start: start + (k / wordsPerSeg) * dur,
      end: start + ((k + 1) / wordsPerSeg) * dur - 0.01,
    }));
    segs.push({ start, end, text: words.join(" "), words: wt });
    t = end + 0.1;
  }
  return segs;
};

describe("captionOps — stress suite (long transcript)", () => {
  const BIG = makeLongTranscript(2000, 10); // 2 000 segments × 10 words = 20 000 words

  it("generates the expected shape", () => {
    expect(BIG).toHaveLength(2000);
    expect(BIG[0].words).toHaveLength(10);
    expect(BIG[BIG.length - 1].end).toBeGreaterThan(2000);
  });

  it("shiftDelay handles 2 000 segments in < 50ms", () => {
    const t0 = performance.now();
    const out = shiftDelay(BIG, 1.5);
    const ms = performance.now() - t0;
    expect(out).toHaveLength(BIG.length);
    expect(out[0].start).toBeCloseTo(BIG[0].start + 1.5, 5);
    expect(ms).toBeLessThan(50);
  });

  it("removeGaps preserves monotonic starts across the whole transcript", () => {
    const out = removeGaps(BIG);
    for (let i = 1; i < out.length; i++) {
      expect(out[i].start).toBeGreaterThanOrEqual(out[i - 1].start);
      expect(out[i].start).toBeLessThanOrEqual(out[i - 1].end + 1e-9);
    }
  });

  it("splitSegmentAt at 1 000 different indices stays fast (< 500ms total)", () => {
    let segs = BIG;
    const t0 = performance.now();
    for (let k = 0; k < 1000; k++) {
      const idx = Math.min(k * 2, segs.length - 1);
      segs = splitSegmentAt(segs, idx, 3);
    }
    const ms = performance.now() - t0;
    // Every valid split adds a row, so length grew by 1 000.
    expect(segs.length).toBe(BIG.length + 1000);
    expect(ms).toBeLessThan(500);
  });

  it("global searchReplace scans 20 000 words in < 100ms", () => {
    const t0 = performance.now();
    const { segs, count } = searchReplace(BIG, "hello", "HI");
    const ms = performance.now() - t0;
    expect(count).toBeGreaterThan(0);
    expect(segs).toHaveLength(BIG.length);
    expect(ms).toBeLessThan(100);
  });

  it("editSegmentTime clamps correctly at boundaries under load", () => {
    // Simulate dragging every 100th chip by ±0.05s.
    let segs = BIG;
    for (let i = 100; i < segs.length; i += 100) {
      segs = editSegmentTime(segs, i, { start: segs[i].start - 0.05 }, segs[segs.length - 1].end + 5);
      expect(segs[i].start).toBeGreaterThanOrEqual(segs[i - 1].end);
      expect(segs[i].end - segs[i].start).toBeGreaterThanOrEqual(0.2 - 1e-9);
    }
  });

  it("moveWord across 500 adjacent segments preserves total word count", () => {
    let segs = makeLongTranscript(500, 6);
    const totalBefore = segs.reduce((n, s) => n + s.text.split(/\s+/).length, 0);
    for (let i = 0; i < 200; i++) segs = moveWord(segs, i + 1, 0, -1);
    const totalAfter = segs.reduce((n, s) => n + s.text.split(/\s+/).length, 0);
    expect(totalAfter).toBe(totalBefore);
  });

  it("max words / chars per line — no segment ever balloons past a hard cap", () => {
    // The editor exposes maxWords + maxChars caps. Emulate the reflow rule
    // (a segment that exceeds either limit should be split).
    const MAX_WORDS = 6;
    const MAX_CHARS = 42;
    let segs = BIG;
    let guard = 0;
    while (guard++ < 20000) {
      const overIdx = segs.findIndex(
        (s) => s.text.split(/\s+/).length > MAX_WORDS || s.text.length > MAX_CHARS,
      );
      if (overIdx === -1) break;
      segs = splitSegmentAt(segs, overIdx);
    }
    expect(guard).toBeLessThan(20000);
    for (const s of segs) {
      expect(s.text.split(/\s+/).length).toBeLessThanOrEqual(MAX_WORDS);
      expect(s.text.length).toBeLessThanOrEqual(MAX_CHARS);
    }
  });

  it("full stress pipeline: delay → gaps → replace → cap-reflow stays stable", () => {
    const t0 = performance.now();
    let segs = shiftDelay(BIG, 2);
    segs = removeGaps(segs);
    ({ segs } = searchReplace(segs, "transcript", "TRANSCRIPT"));

    const MAX = 8;
    let guard = 0;
    while (guard++ < 20000) {
      const overIdx = segs.findIndex((s) => s.text.split(/\s+/).length > MAX);
      if (overIdx === -1) break;
      segs = splitSegmentAt(segs, overIdx);
    }
    const ms = performance.now() - t0;
    expect(ms).toBeLessThan(5000);
    // monotonic invariant
    for (let i = 1; i < segs.length; i++) {
      expect(segs[i].start).toBeGreaterThanOrEqual(segs[i - 1].start - 1e-9);
    }
  });
});
