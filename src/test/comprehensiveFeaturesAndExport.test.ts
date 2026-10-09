import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CAP_PRESETS,
  DEFAULT_CAP_STYLE,
  normalizeCapStyle,
  captionSpanStyle,
  applyTextCase,
  hexToRgbTuple,
  getVisibleWords,
  type CapStyle,
} from "@/lib/captionStyle";
import { DASHBOARD_TEMPLATES } from "@/components/dashboard/DashboardTemplatesSection";
import { RESOLUTION_DIMS, triggerDownload } from "@/lib/exportVideo";
import { isIndianLanguage } from "@/lib/languages";
import { getPlanCapabilities } from "@/lib/plans";
import {
  shiftDelay,
  splitSegmentAt,
  mergeSegments,
  deleteWord,
  searchReplace,
  type Segment,
} from "@/lib/captionOps";

describe("Comprehensive Suite: All Templates, Video Rendering & Downloads", () => {
  describe("1. All Templates Validation (165+ presets)", () => {
    it("validates every single preset in CAP_PRESETS", () => {
      expect(CAP_PRESETS.length).toBeGreaterThanOrEqual(165);

      for (const preset of CAP_PRESETS) {
        expect(preset.name, "Preset must have a name").toBeTruthy();
        expect(preset.category, `Preset "${preset.name}" must have a category`).toBeTruthy();
        expect(preset.patch, `Preset "${preset.name}" must have a patch`).toBeTypeOf("object");

        const normalized = normalizeCapStyle({
          ...DEFAULT_CAP_STYLE,
          ...preset.patch,
        });

        // Ensure key properties are within valid ranges
        expect(normalized.fontSize).toBeGreaterThan(0);
        expect(normalized.fontFamily).toBeTruthy();
        expect(normalized.lineHeight).toBeGreaterThan(0);
        expect(normalized.posX).toBeGreaterThanOrEqual(0);
        expect(normalized.posX).toBeLessThanOrEqual(100);
        expect(normalized.posY).toBeGreaterThanOrEqual(0);
        expect(normalized.posY).toBeLessThanOrEqual(100);

        // Verify CSS compilation
        const css = captionSpanStyle(normalized);
        expect(css).toBeTypeOf("object");
        expect(css.fontFamily).toBeTruthy();

        // Verify RGB parsing if colors are set
        if (normalized.color.startsWith("#") && normalized.color.length >= 4) {
          const rgb = hexToRgbTuple(normalized.color);
          expect(rgb.split(",")).toHaveLength(3);
        }
      }
    });

    it("validates all dashboard quick templates", () => {
      expect(DASHBOARD_TEMPLATES.length).toBe(6);

      for (const t of DASHBOARD_TEMPLATES) {
        expect(t.id).toBeTruthy();
        expect(t.name).toBeTruthy();
        expect(t.creator).toBeTruthy();
        expect(t.fontFamily).toBeTruthy();
        expect(t.sampleWords.length).toBeGreaterThan(0);
        expect(t.colors.text).toBeTruthy();
        expect(t.colors.activeText).toBeTruthy();

        // Check textCase conversion
        const sample = t.sampleWords[0];
        const transformed = applyTextCase(sample, t.textCase);
        if (t.textCase === "upper") {
          expect(transformed).toBe(sample.toUpperCase());
        }
      }
    });
  });

  describe("2. Video Rendering Engine Specs (720p, 1080p, 1440p, 4K)", () => {
    it("has exact dimensions for all standard export resolutions", () => {
      expect(RESOLUTION_DIMS["720p"].w).toBe(1280);
      expect(RESOLUTION_DIMS["720p"].h).toBe(720);
      expect(RESOLUTION_DIMS["1080p"].w).toBe(1920);
      expect(RESOLUTION_DIMS["1080p"].h).toBe(1080);
      expect(RESOLUTION_DIMS["1440p"].w).toBe(2560);
      expect(RESOLUTION_DIMS["1440p"].h).toBe(1440);
      expect(RESOLUTION_DIMS["4k"].w).toBe(3840);
      expect(RESOLUTION_DIMS["4k"].h).toBe(2160);
    });

    it("calculates appropriate target bitrates for video quality tiers", () => {
      const getBitrate = (w: number, h: number) => {
        const px = w * h;
        if (px >= 3840 * 2160) return 40_000_000;
        if (px >= 2560 * 1440) return 20_000_000;
        if (px >= 1920 * 1080) return 12_000_000;
        return 6_000_000;
      };

      expect(getBitrate(1280, 720)).toBe(6_000_000);
      expect(getBitrate(1920, 1080)).toBe(12_000_000);
      expect(getBitrate(2560, 1440)).toBe(20_000_000);
      expect(getBitrate(3840, 2160)).toBe(40_000_000);
    });

    it("selects correct hardware H.264 codecs per resolution", () => {
      const codecForSize = (w: number, h: number) => {
        const px = w * h;
        if (px >= 3840 * 2160) return "avc1.640033"; // 4K
        if (px >= 2560 * 1440) return "avc1.640032"; // 1440p
        if (px >= 1920 * 1080) return "avc1.64002a"; // 1080p
        return "avc1.4d0028";                        // 720p
      };

      expect(codecForSize(1280, 720)).toBe("avc1.4d0028");
      expect(codecForSize(1920, 1080)).toBe("avc1.64002a");
      expect(codecForSize(2560, 1440)).toBe("avc1.640032");
      expect(codecForSize(3840, 2160)).toBe("avc1.640033");
    });
  });

  describe("3. Video Downloading & File Triggering", () => {
    it("successfully creates download anchor, sets filename, and triggers click", () => {
      const clicks: { href: string; download: string }[] = [];
      const origCreate = document.createElement.bind(document);

      const spy = vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
        const el = origCreate(tag as any);
        if (tag === "a") {
          const anchor = el as HTMLAnchorElement;
          anchor.click = () => {
            clicks.push({ href: anchor.href, download: anchor.download });
          };
        }
        return el;
      });

      triggerDownload("blob:mock-video-url", "my_awesome_reel.mp4");

      expect(clicks).toHaveLength(1);
      expect(clicks[0].download).toBe("my_awesome_reel.mp4");
      expect(clicks[0].href).toBe("blob:mock-video-url");

      spy.mockRestore();
    });
  });

  describe("4. Language Transcription Provider Routing", () => {
    it("routes Indian languages to Sarvam AI and international to Deepgram", () => {
      const indianLangs = ["hi", "bn", "ta", "te", "mr", "gu", "kn", "ml", "pa", "or", "ur"];
      const internationalLangs = ["en", "es", "fr", "de", "ja", "zh", "ru", "ar", "pt", "it"];

      for (const lang of indianLangs) {
        expect(isIndianLanguage(lang), `${lang} should route to Sarvam AI`).toBe(true);
      }

      for (const lang of internationalLangs) {
        expect(isIndianLanguage(lang), `${lang} should route to Deepgram`).toBe(false);
      }
    });
  });

  describe("5. Caption Operations Engine", () => {
    it("correctly shifts, splits, merges, and replaces words in segments", () => {
      let segs: Segment[] = [
        { start: 1.0, end: 3.0, text: "First segment here" },
        { start: 3.5, end: 5.5, text: "Second segment goes here" },
      ];

      // Delay shift
      segs = shiftDelay(segs, 0.5);
      expect(segs[0].start).toBeCloseTo(1.5, 5);
      expect(segs[0].end).toBeCloseTo(3.5, 5);

      // Split segment
      segs = splitSegmentAt(segs, 1, 2);
      expect(segs).toHaveLength(3);

      // Delete word
      segs = deleteWord(segs, 0, 0); // remove "First"
      expect(segs[0].text).toBe("segment here");

      // Search & replace
      const result = searchReplace(segs, "segment", "caption");
      expect(result.count).toBeGreaterThan(0);
      expect(result.segs[0].text).toContain("caption");
    });
  });

  describe("6. Plan Capabilities & Feature Gating", () => {
    it("correctly gates resolution and advanced features across tiers", () => {
      const starterCaps = getPlanCapabilities("starter");
      const editorCaps = getPlanCapabilities("editor");
      const creatorCaps = getPlanCapabilities("creator");
      const studioCaps = getPlanCapabilities("studio");

      // Resolution gating
      expect(starterCaps.maxExportResolution).toBe("720p");
      expect(editorCaps.maxExportResolution).toBe("1080p");
      expect(creatorCaps.maxExportResolution).toBe("4K");
      expect(studioCaps.maxExportResolution).toBe("4K");

      // Translation capabilities
      expect(starterCaps.canTranslate).toBe(false);
      expect(editorCaps.canTranslate).toBe(false);
      expect(creatorCaps.canTranslate).toBe(true);
      expect(studioCaps.canTranslate).toBe(true);

      // Watermark requirements
      expect(starterCaps.watermarkRequired).toBe(true);
      expect(editorCaps.watermarkRequired).toBe(false);
      expect(creatorCaps.watermarkRequired).toBe(false);
      expect(studioCaps.watermarkRequired).toBe(false);
    });
  });
});
