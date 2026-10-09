import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Visual-alignment contract tests for the collapsible right panel + video
 * frame in ProjectView. These lock the responsive Tailwind classes that
 * keep the video hugging the collapse-arrow across breakpoints.
 *
 * If a future refactor removes or changes these class combinations the
 * test fails loudly — preventing silent regressions of the visual layout.
 */

const source = readFileSync(
  resolve(__dirname, "../pages/ProjectView.tsx"),
  "utf8",
);

describe("arrow ↔ video alignment contract", () => {
  it("shrink-wraps the video preview when no custom drag width is set", () => {
    expect(source).toContain("const shrinkWrapPreview = videoTrackWidth == null");
    expect(source).toContain('lg:w-fit lg:max-w-full lg:self-end');
    expect(source).toContain('lg:w-fit lg:max-w-full lg:justify-self-end');
  });

  it("uses fit-content video grid tracks so captions absorb leftover space", () => {
    const gridBlock = source.match(/gridTemplateColumns:[\s\S]*?\}\)\(\),/)?.[0] ?? "";
    expect(gridBlock).toBeTruthy();
    expect(gridBlock).toContain("fit-content(${maxVideoTrackWidth}px)");
    expect(gridBlock).toContain("minmax(0, 1fr)");
    expect(gridBlock).toContain("minmax(${captionsTrackMin}px, 1fr)");
  });

  it("custom drag width still fills the explicit video column", () => {
    expect(source).toContain('shrinkWrapPreview ? "w-fit" : "w-full"');
    expect(source).toContain('customVideoTrackW == null ? "lg:w-fit lg:max-w-full lg:justify-self-end" : "lg:w-full"');
    expect(source).toContain('videoTrackWidth={customVideoTrackW == null ? null : activeVideoTrackWidth}');
  });

  it("frame style caps non-fullscreen widths so video never overflows its track", () => {
    const frameBlock = source.match(/const frameStyle:[\s\S]*?;\r?\n/)?.[0] ?? "";
    expect(frameBlock).toBeTruthy();
    const nonFullscreenBranches = frameBlock.split("\n").filter((l) => l.includes("framedCap"));
    expect(nonFullscreenBranches.length).toBeGreaterThanOrEqual(3);
    for (const line of nonFullscreenBranches) {
      expect(line).toContain('maxWidth: "100%"');
    }
  });

  it("container re-measures on window resize and orientation change", () => {
    expect(source).toContain('window.addEventListener("resize", markResizing)');
    expect(source).toContain('window.addEventListener("orientationchange", markResizing)');
  });
});
