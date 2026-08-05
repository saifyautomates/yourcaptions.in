/**
 * Pure caption-segment operations extracted from ProjectView so they can be
 * exercised by unit tests without mounting the whole editor.
 *
 * Every op is a pure function: it takes an input segment array and returns a
 * new one — no mutation, no React state. This keeps the smoke-test suite
 * fast and lets the real editor consume the exact same code path.
 */

export interface WordTiming { text: string; start: number; end: number }
export interface Segment {
  start: number;
  end: number;
  text: string;
  confidence?: number;
  words?: WordTiming[];
}

const MIN_DUR = 0.2;

/** Shift every segment's start/end by `delta` seconds. Clamps at 0. */
export const shiftDelay = (segs: Segment[], delta: number): Segment[] =>
  segs.map((s) => ({
    ...s,
    start: Math.max(0, s.start + delta),
    end: Math.max(0, s.end + delta),
  }));

/** Snap sequential segments together so there is no visual pause. */
export const removeGaps = (segs: Segment[]): Segment[] => {
  const out = segs.map((s) => ({ ...s }));
  for (let k = 1; k < out.length; k++) {
    if (out[k].start > out[k - 1].end) out[k].start = out[k - 1].end;
  }
  return out;
};

export const removeEmojis = (segs: Segment[]): Segment[] =>
  segs.map((s) => ({
    ...s,
    text: s.text.replace(/\p{Extended_Pictographic}/gu, "").replace(/\s+/g, " ").trim(),
  }));

export const removePunctuation = (segs: Segment[]): Segment[] =>
  segs.map((s) => ({
    ...s,
    text: s.text.replace(/[.,!?;:"“”‘’()[\]{}—–\-]/g, "").replace(/\s+/g, " ").trim(),
  }));

/**
 * Split a segment at a given word index (or midpoint if omitted). Uses
 * per-word timings when available; otherwise falls back to proportional
 * timing. Both resulting halves keep the original styling metadata.
 */
export const splitSegmentAt = (segs: Segment[], i: number, wordIdx?: number): Segment[] => {
  const s = segs[i];
  if (!s) return segs;
  const words = s.text.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return segs;

  const cutAt = wordIdx != null
    ? Math.max(1, Math.min(words.length - 1, wordIdx))
    : Math.floor(words.length / 2);

  const wt = s.words;
  let cut: number;
  if (wt && wt.length === words.length && wt[cutAt - 1] && wt[cutAt]) {
    cut = (wt[cutAt - 1].end + wt[cutAt].start) / 2;
  } else {
    const dur = s.end - s.start;
    cut = s.start + dur * (cutAt / words.length);
  }
  cut = Math.min(s.end - 0.05, Math.max(s.start + 0.05, cut));

  const left: Segment = {
    ...s,
    text: words.slice(0, cutAt).join(" "),
    end: cut,
    words: wt ? wt.slice(0, cutAt) : undefined,
  };
  const right: Segment = {
    ...s,
    text: words.slice(cutAt).join(" "),
    start: cut,
    words: wt ? wt.slice(cutAt) : undefined,
  };
  const next = [...segs];
  next.splice(i, 1, left, right);
  return next;
};

/** Delete a whole segment row. */
export const deleteSegment = (segs: Segment[], i: number): Segment[] =>
  segs.filter((_, idx) => idx !== i);

/** Delete one word from a segment; if the segment becomes empty the row is dropped. */
export const deleteWord = (segs: Segment[], i: number, wi: number): Segment[] => {
  const s = segs[i];
  if (!s) return segs;
  const words = s.text.split(/\s+/).filter(Boolean);
  if (wi < 0 || wi >= words.length) return segs;
  words.splice(wi, 1);
  if (words.length === 0) return deleteSegment(segs, i);
  const next = [...segs];
  next[i] = { ...s, text: words.join(" ") };
  return next;
};

/**
 * Move a word from segment `srcIdx`@`wi` to the adjacent segment (`dir` = -1
 * for previous, +1 for next). Timing on both segments is left untouched
 * because per-word bounds already control the visual timing.
 */
export const moveWord = (
  segs: Segment[],
  srcIdx: number,
  wi: number,
  dir: -1 | 1,
): Segment[] => {
  const tgtIdx = srcIdx + dir;
  if (srcIdx < 0 || srcIdx >= segs.length) return segs;
  if (tgtIdx < 0 || tgtIdx >= segs.length) return segs;
  const src = segs[srcIdx];
  const tgt = segs[tgtIdx];
  const srcWords = src.text.split(/\s+/).filter(Boolean);
  const w = srcWords[wi];
  if (!w) return segs;
  srcWords.splice(wi, 1);
  const tgtWords = tgt.text.split(/\s+/).filter(Boolean);
  if (dir === -1) tgtWords.push(w);
  else tgtWords.unshift(w);
  const next = [...segs];
  next[srcIdx] = { ...src, text: srcWords.join(" ") };
  next[tgtIdx] = { ...tgt, text: tgtWords.join(" ") };
  if (srcWords.length === 0) return deleteSegment(next, srcIdx);
  return next;
};

/** Global search & replace across every segment. Returns count + new segments. */
export const searchReplace = (
  segs: Segment[],
  find: string,
  replace: string,
  opts: { caseSensitive?: boolean; wholeWord?: boolean } = {},
): { segs: Segment[]; count: number } => {
  if (!find) return { segs, count: 0 };
  const esc = find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = opts.wholeWord ? `\\b${esc}\\b` : esc;
  const re = new RegExp(pattern, opts.caseSensitive ? "g" : "gi");
  let count = 0;
  const next = segs.map((s) => {
    const nText = s.text.replace(re, () => { count++; return replace; });
    return nText === s.text ? s : { ...s, text: nText };
  });
  return { segs: next, count };
};

/**
 * Adjust one segment's start or end, clamped by neighbour bounds, [0, duration],
 * and a minimum duration of `MIN_DUR`.
 */
export const editSegmentTime = (
  segs: Segment[],
  i: number,
  patch: { start?: number; end?: number },
  duration = 0,
): Segment[] => {
  const c = segs[i];
  if (!c) return segs;
  const p = segs[i - 1];
  const n = segs[i + 1];
  let s = patch.start ?? c.start;
  let e = patch.end ?? c.end;
  if (p) s = Math.max(s, p.end);
  if (n) e = Math.min(e, n.start);
  s = Math.max(0, s);
  if (duration > 0) e = Math.min(e, duration);
  if (e - s < MIN_DUR) {
    if (patch.start !== undefined) s = e - MIN_DUR;
    else e = s + MIN_DUR;
  }
  const next = [...segs];
  next[i] = { ...c, start: s, end: e };
  return next;
};
