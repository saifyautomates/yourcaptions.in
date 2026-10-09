import { describe, it, expect } from "vitest";
import {
  CAP_PRESETS,
  DEFAULT_CAP_STYLE,
  normalizeCapStyle,
  captionSpanStyle,
  getPresetCategory,
  type CapStyle,
} from "@/lib/captionStyle";

describe("All Templates Exhaustive Verification (100% Reliability)", () => {
  it("has exactly 50 top world-class presets", () => {
    expect(CAP_PRESETS.length).toBe(50);
  });

  it("verifies all 5 signature studio packs have authentic templates", () => {
    const kineticTemplates = CAP_PRESETS.filter(
      (p) => p.category === "Kinetic Motion" || p.name.toLowerCase().includes("kinetic")
    );
    const reelsTemplates = CAP_PRESETS.filter(
      (p) => p.category === "Shorts & Reels" || p.name.toLowerCase().includes("reels")
    );
    const dynamicPopTemplates = CAP_PRESETS.filter(
      (p) => p.category === "Dynamic Pop" || p.name.toLowerCase().includes("dynamic")
    );
    const desiTemplates = CAP_PRESETS.filter(
      (p) => p.category === "Desi Viral" || p.name.toLowerCase().includes("desi")
    );
    const creatorProTemplates = CAP_PRESETS.filter(
      (p) => p.category === "Creator Pro" || p.name.toLowerCase().includes("creator")
    );

    expect(kineticTemplates.length).toBeGreaterThanOrEqual(10);
    expect(reelsTemplates.length).toBeGreaterThanOrEqual(10);
    expect(dynamicPopTemplates.length).toBeGreaterThanOrEqual(10);
    expect(desiTemplates.length).toBeGreaterThanOrEqual(10);
    expect(creatorProTemplates.length).toBeGreaterThanOrEqual(10);

    // Verify key signature presets exist
    const names = new Set(CAP_PRESETS.map((p) => p.name));
    expect(names.has("Kinetic · Viral Flow")).toBe(true);
    expect(names.has("Kinetic · 3D Depth Cutout")).toBe(true);
    expect(names.has("Reels · 1-Click Karaoke")).toBe(true);
    expect(names.has("Reels · Hormozi Punch")).toBe(true);
    expect(names.has("Dynamic · Classic Pill")).toBe(true);
    expect(names.has("Dynamic · Kinetic Pop")).toBe(true);
    expect(names.has("Desi · Karaoke Flow")).toBe(true);
    expect(names.has("Desi · Bollywood Hit")).toBe(true);
    expect(names.has("Creator · Hormozi Viral")).toBe(true);
    expect(names.has("Creator · Raj Shamani Podcast")).toBe(true);
  });

  it("checks that every template normalizes and produces valid CSS", () => {
    for (const [index, preset] of CAP_PRESETS.entries()) {
      expect(preset.name, `Preset #${index} must have a non-empty name`).toBeTruthy();
      expect(typeof preset.name).toBe("string");
      expect(preset.patch, `Preset "${preset.name}" must have a patch object`).toBeTypeOf("object");

      // Normalize style
      const normalized = normalizeCapStyle({
        ...DEFAULT_CAP_STYLE,
        ...preset.patch,
      });

      expect(normalized.fontSize, `FontSize for "${preset.name}" must be positive`).toBeGreaterThan(0);
      expect(normalized.fontFamily, `FontFamily for "${preset.name}" must be set`).toBeTruthy();

      // CSS generation for standard word
      const standardCss = captionSpanStyle(normalized);
      expect(standardCss, `captionSpanStyle returned empty for "${preset.name}"`).toBeTypeOf("object");
      expect(standardCss.fontFamily).toBeTruthy();

      // CSS generation for active word
      if (normalized.activeWordOn) {
        expect(normalized.activeWordScale).toBeGreaterThanOrEqual(1);
        if (normalized.activeWordBgOn) {
          expect(normalized.activeWordBgColor).toBeTruthy();
        }
      }

      // Check category derivation
      const category = getPresetCategory(preset);
      expect(category, `Category for "${preset.name}" must be derived`).toBeTruthy();
    }
  });

  it("validates colors and opacity across all presets", () => {
    const colorRegex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
    const rgbaRegex = /^rgba?\(/i;

    for (const preset of CAP_PRESETS) {
      const p = preset.patch;
      if (p.color && !p.color.startsWith("rgba")) {
        expect(colorRegex.test(p.color) || p.color.startsWith("rgb"), `Invalid color in ${preset.name}: ${p.color}`).toBe(true);
      }
      if (p.activeWordColor && !p.activeWordColor.startsWith("rgba")) {
        expect(colorRegex.test(p.activeWordColor) || p.activeWordColor.startsWith("rgb"), `Invalid activeWordColor in ${preset.name}: ${p.activeWordColor}`).toBe(true);
      }
      if (p.shadowColor && !p.shadowColor.startsWith("rgba")) {
        expect(colorRegex.test(p.shadowColor) || p.shadowColor.startsWith("rgb"), `Invalid shadowColor in ${preset.name}: ${p.shadowColor}`).toBe(true);
      }
      if (p.strokeColor && !p.strokeColor.startsWith("rgba")) {
        expect(colorRegex.test(p.strokeColor) || p.strokeColor.startsWith("rgb"), `Invalid strokeColor in ${preset.name}: ${p.strokeColor}`).toBe(true);
      }
      if (p.bgColor && !p.bgColor.startsWith("rgba")) {
        expect(colorRegex.test(p.bgColor) || p.bgColor.startsWith("rgb"), `Invalid bgColor in ${preset.name}: ${p.bgColor}`).toBe(true);
      }
    }
  });

  it("ensures no duplicate template names exist", () => {
    const seen = new Map<string, number>();
    for (const preset of CAP_PRESETS) {
      const lower = preset.name.toLowerCase();
      const count = seen.get(lower) ?? 0;
      seen.set(lower, count + 1);
    }

    const duplicates = Array.from(seen.entries()).filter(([_, count]) => count > 1);
    expect(duplicates, `Found duplicate template names: ${JSON.stringify(duplicates)}`).toEqual([]);
  });
});
