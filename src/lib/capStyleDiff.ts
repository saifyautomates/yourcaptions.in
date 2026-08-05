// Human-readable diff labels for CapStyle history entries.
//
// The editor's undo/redo stack stores full CapStyle snapshots (see
// ProjectView.tsx → historyRef). For the History panel we want a short label
// per entry so the user can recognize what each step changed — "Moved to 40%,
// 82%", "Font size 42→48", "Template: Neon Pop", etc.
//
// The comparison is intentionally coarse: we pick the single most user-visible
// change and describe that. Multiple simultaneous edits (rare, since edits are
// debounced) fall through to a generic "Style tweak" label.

import type { CapStyle } from "./captionStyle";

const num = (a: number, b: number) => Math.abs(a - b) > 0.5;

export function describeCapDiff(prev: CapStyle, next: CapStyle): string {
  // Position moves are by far the most common edit → check first.
  if (num(prev.posX, next.posX) || num(prev.posY, next.posY)) {
    return `Moved to ${next.posX.toFixed(0)}%, ${next.posY.toFixed(0)}%`;
  }
  if (prev.fontFamily !== next.fontFamily) return `Font: ${next.fontFamily}`;
  if (prev.fontSize !== next.fontSize) return `Font size ${prev.fontSize} → ${next.fontSize}`;
  if (prev.fontWeight !== next.fontWeight) return `Weight ${prev.fontWeight} → ${next.fontWeight}`;
  if (prev.italic !== next.italic) return next.italic ? "Italic on" : "Italic off";
  if (prev.underline !== next.underline) return next.underline ? "Underline on" : "Underline off";
  if (prev.textCase !== next.textCase) return `Case: ${next.textCase}`;
  if (prev.align !== next.align) return `Align: ${next.align}`;
  if (prev.colorMode !== next.colorMode) return `Color mode: ${next.colorMode}`;
  if (prev.color !== next.color) return "Text color";
  if (prev.gradFrom !== next.gradFrom || prev.gradTo !== next.gradTo || prev.gradAngle !== next.gradAngle) return "Gradient";
  if (prev.strokeOn !== next.strokeOn) return next.strokeOn ? "Stroke on" : "Stroke off";
  if (prev.strokeColor !== next.strokeColor || prev.strokeWidth !== next.strokeWidth) return "Stroke tweak";
  if (prev.glowOn !== next.glowOn) return next.glowOn ? "Glow on" : "Glow off";
  if (prev.glowColor !== next.glowColor || prev.glowBlur !== next.glowBlur || prev.glowIntensity !== next.glowIntensity) return "Glow tweak";
  if (prev.shadowOn !== next.shadowOn) return next.shadowOn ? "Shadow on" : "Shadow off";
  if (prev.shadowColor !== next.shadowColor || prev.shadowOpacity !== next.shadowOpacity || prev.shadowX !== next.shadowX || prev.shadowY !== next.shadowY || prev.shadowBlur !== next.shadowBlur) return "Shadow tweak";
  if (prev.bgOn !== next.bgOn) return next.bgOn ? "Background on" : "Background off";
  if (prev.bgColor !== next.bgColor || prev.bgOpacity !== next.bgOpacity || prev.bgRadius !== next.bgRadius || prev.bgPadX !== next.bgPadX || prev.bgPadY !== next.bgPadY) return "Background tweak";
  if (prev.letterSpacing !== next.letterSpacing) return `Letter spacing ${prev.letterSpacing} → ${next.letterSpacing}`;
  if (prev.lineHeight !== next.lineHeight) return `Line height ${prev.lineHeight} → ${next.lineHeight}`;
  if (prev.transition !== next.transition) return `Transition: ${next.transition}`;
  if (prev.transitionSpeed !== next.transitionSpeed) return `Speed ${prev.transitionSpeed}ms`;
  if (prev.wordsPerChunk !== next.wordsPerChunk) return `Words/chunk: ${next.wordsPerChunk || "full line"}`;
  if (prev.activeWordOn !== next.activeWordOn) return next.activeWordOn ? "Active word on" : "Active word off";
  if (prev.activeWordColor !== next.activeWordColor || prev.activeWordBgOn !== next.activeWordBgOn || prev.activeWordBgColor !== next.activeWordBgColor || prev.activeWordScale !== next.activeWordScale) return "Active word tweak";
  if (prev.autoEmojiOn !== next.autoEmojiOn) return next.autoEmojiOn ? "Auto emoji on" : "Auto emoji off";
  if (prev.emojiSize !== next.emojiSize) return `Emoji size ${next.emojiSize}`;
  if (prev.fitToVideo !== next.fitToVideo) return next.fitToVideo ? "Fit-to-video on" : "Fit-to-video off";
  if (prev.safeMargin !== next.safeMargin) return `Safe margin ${next.safeMargin}%`;
  if (prev.impactWordsRed !== next.impactWordsRed || prev.impactWordsYellow !== next.impactWordsYellow || prev.impactRedColor !== next.impactRedColor || prev.impactYellowColor !== next.impactYellowColor) return "Impact words";
  return "Style tweak";
}

export function formatHistoryTime(at: number): string {
  const delta = Math.max(0, Date.now() - at);
  if (delta < 5_000) return "just now";
  if (delta < 60_000) return `${Math.round(delta / 1000)}s ago`;
  if (delta < 3_600_000) return `${Math.round(delta / 60_000)}m ago`;
  return `${Math.round(delta / 3_600_000)}h ago`;
}
