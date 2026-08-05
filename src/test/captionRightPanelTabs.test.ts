import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Contract test — the CaptionRightPanel tab row (Text, Templates, Motion,
 * Music, AI Audio) must never overlap when the right panel is narrowed via
 * the drag handle. The row must:
 *   - use a horizontal flex layout (not a fixed 5-col grid that squeezes)
 *   - keep every tab on a single line (whitespace-nowrap + shrink-0)
 *   - allow horizontal scrolling when width < sum of tab widths
 *
 * A regression that reintroduces `grid grid-cols-5` (or drops nowrap /
 * overflow-x) would cause labels to wrap into each other and fails here.
 */

const source = readFileSync(
  resolve(__dirname, "../components/CaptionRightPanel.tsx"),
  "utf8",
);

const tabRow =
  source.match(/\{\/\* Text tabs[\s\S]*?\{TABS\.map[\s\S]*?\}\)\}\s*<\/div>/)?.[0] ?? "";

describe("CaptionRightPanel tab row — narrow-panel overlap contract", () => {
  it("tab-row block is discoverable", () => {
    expect(tabRow).toBeTruthy();
  });

  it("uses horizontal flex with scroll, NOT a fixed 5-column grid", () => {
    expect(tabRow).not.toMatch(/grid-cols-5/);
    expect(tabRow).toMatch(/\bflex\b/);
    expect(tabRow).toMatch(/overflow-x-auto/);
  });

  it("prevents wrapping so labels never stack/overlap", () => {
    expect(tabRow).toMatch(/whitespace-nowrap/);
  });

  it("each tab is shrink-0 so labels keep full width when panel narrows", () => {
    const btnClass =
      source.match(/TABS\.map[\s\S]*?<button[\s\S]*?className=\{`([\s\S]*?)`\}/)?.[1] ?? "";
    expect(btnClass).toContain("shrink-0");
  });

  it("hides the horizontal scrollbar chrome (visual polish)", () => {
    expect(tabRow).toMatch(/\[scrollbar-width:none\]/);
    expect(tabRow).toMatch(/\[&::-webkit-scrollbar\]:hidden/);
  });

  it("Text and Templates tabs share the TabShell wrapper for identical outer layout", () => {
    // Both tab components must render their content inside <TabShell> so the
    // outer flex/min-width behavior is identical at every panel width.
    const textBody = source.match(/const TextTab[\s\S]*?^\);/m)?.[0] ?? "";
    const tmplBody = source.match(/const TemplatesTab[\s\S]*?^\};/m)?.[0] ?? "";
    expect(textBody).toMatch(/<TabShell>/);
    expect(textBody).toMatch(/<\/TabShell>/);
    expect(tmplBody).toMatch(/<TabShell>/);
    expect(tmplBody).toMatch(/<\/TabShell>/);
  });

  it("Row uses safely-shrinking minmax tracks (no fixed 92px column)", () => {
    const rowBody = source.match(/const Row = [\s\S]*?^\);/m)?.[0] ?? "";
    expect(rowBody).toMatch(/minmax\(0,\s*92px\)/);
    expect(rowBody).toMatch(/minmax\(0,\s*1fr\)/);
    expect(rowBody).not.toMatch(/grid-cols-\[92px_1fr_auto\]/);
  });
});
