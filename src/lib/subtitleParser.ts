// Parse a pasted subtitle blob (SRT / WebVTT / plain text) into Segment[].
// Word-level timings are synthesized by distributing each cue's duration
// evenly across its words so downstream highlighting animations still work.

export interface ParsedWord { text: string; start: number; end: number }
export interface ParsedSegment {
  start: number;
  end: number;
  text: string;
  words?: ParsedWord[];
}

const TIME_RE = /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/;

function parseTs(s: string): number | null {
  const m = TIME_RE.exec(s);
  if (!m) return null;
  const [, h, mm, ss, ms] = m;
  return (+h) * 3600 + (+mm) * 60 + (+ss) + (+ms) / (ms.length === 2 ? 100 : ms.length === 1 ? 10 : 1000);
}

function synthWords(text: string, start: number, end: number): ParsedWord[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const dur = Math.max(end - start, 0.001);
  const per = dur / tokens.length;
  return tokens.map((t, i) => ({
    text: t,
    start: start + i * per,
    end: start + (i + 1) * per,
  }));
}

function cleanCueText(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, "")           // strip VTT/HTML tags
    .replace(/\{\\?[^}]+\}/g, "")      // strip SSA/ASS style tags
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join(" ")
    .trim();
}

function parseTimed(input: string): ParsedSegment[] | null {
  // Split into cue blocks separated by blank lines. Works for both SRT and VTT.
  const blocks = input.replace(/^\uFEFF/, "").replace(/\r/g, "").split(/\n{2,}/);
  const out: ParsedSegment[] = [];
  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    if (/^WEBVTT/i.test(lines[0])) continue;             // VTT header
    // Optional numeric index line
    if (/^\d+$/.test(lines[0])) lines.shift();
    const tsLine = lines.shift();
    if (!tsLine) continue;
    const parts = tsLine.split(/-->/);
    if (parts.length !== 2) continue;
    const start = parseTs(parts[0]);
    const end = parseTs(parts[1]);
    if (start == null || end == null || end <= start) continue;
    const text = cleanCueText(lines.join("\n"));
    if (!text) continue;
    out.push({ start, end, text, words: synthWords(text, start, end) });
  }
  return out.length ? out : null;
}

function parsePlain(input: string, totalDuration: number): ParsedSegment[] {
  // Split on sentence terminators (Latin + Devanagari danda) and hard newlines.
  const sentences = input
    .replace(/\r/g, "")
    .split(/(?<=[.!?।])\s+|\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!sentences.length) return [];
  // If a real duration is available, spread evenly; otherwise assume ~3.5s each.
  const dur = totalDuration > 0 ? totalDuration : sentences.length * 3.5;
  const per = dur / sentences.length;
  return sentences.map((text, i) => {
    const start = i * per;
    const end = (i + 1) * per;
    return { start, end, text, words: synthWords(text, start, end) };
  });
}

export function parseSubtitles(input: string, totalDuration = 0): ParsedSegment[] {
  const trimmed = input.trim();
  if (!trimmed) return [];
  // Detect SRT/VTT by presence of `-->` timing arrows.
  if (/-->/.test(trimmed)) {
    const timed = parseTimed(trimmed);
    if (timed && timed.length) return timed;
  }
  return parsePlain(trimmed, totalDuration);
}

export function detectFormat(input: string): "srt" | "vtt" | "plain" | "empty" {
  const t = input.trim();
  if (!t) return "empty";
  if (/^WEBVTT/i.test(t)) return "vtt";
  if (/-->/.test(t)) return "srt";
  return "plain";
}
