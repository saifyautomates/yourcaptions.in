// Synthetic stress test: 3000-segment transcript, rapid random seeks, active-index
// lookup + getVisibleChunk on every "frame". Emulates the editor's hot path
// without a browser. Measures throughput, per-op latency percentiles, and
// heap growth to catch leaks.
import { getVisibleChunk } from "../src/lib/captionStyle";

type Seg = { start: number; end: number; text: string };

const SEG_COUNT = 3000;              // ~50 minutes of dense captions
const SEEK_OPS = 200_000;            // rapid random seeks
const WORDS_PER_SEG = 8;

const rand = (() => {
  let s = 42;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 0xffffffff;
})();

const words = "the quick brown fox jumps over lazy dog then sits and watches clouds drift".split(" ");
const makeSeg = (i: number): Seg => {
  const start = i * 1.0;
  const end = start + 0.9;
  const text = Array.from({ length: WORDS_PER_SEG }, () => words[Math.floor(rand() * words.length)]).join(" ");
  return { start, end, text };
};

const segs: Seg[] = Array.from({ length: SEG_COUNT }, (_, i) => makeSeg(i));
const duration = segs[segs.length - 1].end;

// Same lookup the editor uses to find the active segment for a given time.
const findActive = (t: number): number => {
  let lo = 0, hi = segs.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const s = segs[mid];
    if (t < s.start) hi = mid - 1;
    else if (t > s.end) lo = mid + 1;
    else return mid;
  }
  return -1;
};

const percentile = (arr: number[], p: number) => {
  const a = arr.slice().sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.floor(a.length * p))];
};

const mb = (n: number) => (n / 1024 / 1024).toFixed(1) + " MB";

console.log(`\n== Stress: ${SEG_COUNT} segments, ${SEEK_OPS.toLocaleString()} random seeks ==\n`);
const memBefore = process.memoryUsage();

const samples: number[] = [];
const t0 = performance.now();
let sink = "";
for (let i = 0; i < SEEK_OPS; i++) {
  const t = rand() * duration;
  const opStart = performance.now();
  const idx = findActive(t);
  if (idx >= 0) {
    const s = segs[idx];
    sink = getVisibleChunk(s.text, s.start, s.end, t, 3);
  }
  const dur = performance.now() - opStart;
  if (i % 200 === 0) samples.push(dur); // sample to keep memory bounded
}
const totalMs = performance.now() - t0;
if (global.gc) global.gc();
const memAfter = process.memoryUsage();

console.log(`total:        ${totalMs.toFixed(0)} ms`);
console.log(`throughput:   ${((SEEK_OPS / totalMs) * 1000).toFixed(0)} ops/sec`);
console.log(`avg latency:  ${(totalMs / SEEK_OPS * 1000).toFixed(2)} µs/op`);
console.log(`p50:          ${(percentile(samples, 0.5) * 1000).toFixed(2)} µs`);
console.log(`p95:          ${(percentile(samples, 0.95) * 1000).toFixed(2)} µs`);
console.log(`p99:          ${(percentile(samples, 0.99) * 1000).toFixed(2)} µs`);
console.log(`max sample:   ${(Math.max(...samples) * 1000).toFixed(2)} µs`);
console.log(`heap before:  ${mb(memBefore.heapUsed)}`);
console.log(`heap after:   ${mb(memAfter.heapUsed)}`);
console.log(`heap delta:   ${mb(memAfter.heapUsed - memBefore.heapUsed)}`);
console.log(`rss delta:    ${mb(memAfter.rss - memBefore.rss)}`);
console.log(`sink:         "${sink.slice(0, 40)}…"`);

// Leak probe: run 5 additional bursts and log heap growth per burst.
console.log(`\n== Leak probe: 5 × 40k-op bursts ==`);
for (let b = 0; b < 5; b++) {
  const before = process.memoryUsage().heapUsed;
  for (let i = 0; i < 40_000; i++) {
    const t = rand() * duration;
    const idx = findActive(t);
    if (idx >= 0) {
      const s = segs[idx];
      sink = getVisibleChunk(s.text, s.start, s.end, t, 3);
    }
  }
  if (global.gc) global.gc();
  const after = process.memoryUsage().heapUsed;
  console.log(`burst ${b + 1}: heap ${mb(before)} → ${mb(after)}  (Δ ${mb(after - before)})`);
}
