import { describe, it, expect } from "vitest";
import { isIndianLanguage } from "@/lib/languages";
import { CAPABILITIES, getPlanCapabilities } from "@/lib/plans";

describe("SaaS Provider Routing & Language Detection", () => {
  it("accurately classifies Indian regional languages, scheduled languages, and vernacular dialects", () => {
    const indianList = [
      "hi", "hi-IN", "hi-Latn", "hinglish",
      "bn", "bn-IN", "bengali",
      "ta", "ta-IN", "tanglish", "tamil",
      "te", "te-IN", "teluglish", "telugu",
      "mr", "mr-IN", "minglish", "marathi",
      "gu", "gu-IN", "gujlish", "gujarati",
      "kn", "kn-IN", "kanglish", "kannada",
      "ml", "ml-IN", "manglish", "malayalam",
      "pa", "pa-IN", "punglish", "punjabi",
      "ur", "ur-IN", "urdu",
      "or", "od", "odia",
      "as", "as-IN", "assamese",
      "bho", "bhojpuri",
      "raj", "rajasthani",
      "sa", "sanskrit",
      "mai", "maithili",
      "kok", "konkani",
    ];

    for (const code of indianList) {
      expect(isIndianLanguage(code), `Expected ${code} to be classified as Indian language`).toBe(true);
    }
  });

  it("accurately classifies non-Indian global / foreign languages", () => {
    const foreignList = [
      "en", "en-US", "en-GB", "en-AU",
      "es", "es-ES", "es-MX",
      "fr", "fr-FR",
      "de", "de-DE",
      "ja", "ja-JP",
      "ko", "ko-KR",
      "zh", "zh-CN", "zh-TW",
      "ar", "ar-SA",
      "ru", "ru-RU",
      "pt", "pt-BR",
      "it", "it-IT",
      "nl", "sv", "pl", "tr", "vi", "th", "id",
    ];

    for (const code of foreignList) {
      expect(isIndianLanguage(code), `Expected ${code} to NOT be classified as Indian language`).toBe(false);
    }
  });

  it("chooses Sarvam AI for Indian languages and Deepgram for foreign languages", () => {
    const selectProvider = (lang: string) => (isIndianLanguage(lang) ? "sarvam" : "deepgram");

    expect(selectProvider("hi")).toBe("sarvam");
    expect(selectProvider("hi-IN")).toBe("sarvam");
    expect(selectProvider("hinglish")).toBe("sarvam");
    expect(selectProvider("ta")).toBe("sarvam");
    expect(selectProvider("te")).toBe("sarvam");
    expect(selectProvider("mr")).toBe("sarvam");
    expect(selectProvider("gu")).toBe("sarvam");
    expect(selectProvider("pa")).toBe("sarvam");
    expect(selectProvider("bn")).toBe("sarvam");

    expect(selectProvider("en")).toBe("deepgram");
    expect(selectProvider("es")).toBe("deepgram");
    expect(selectProvider("fr")).toBe("deepgram");
    expect(selectProvider("de")).toBe("deepgram");
    expect(selectProvider("ja")).toBe("deepgram");
    expect(selectProvider("ko")).toBe("deepgram");
    expect(selectProvider("zh")).toBe("deepgram");
    expect(selectProvider("ar")).toBe("deepgram");
  });
});

describe("Pricing Matrix & Feature Capabilities Alignment", () => {
  it("enforces Free (Starter) plan limits accurately", () => {
    const free = getPlanCapabilities("starter");
    expect(free.maxExportResolution).toBe("720p");
    expect(free.watermarkRequired).toBe(true);
    expect(free.monthlyMinutes).toBe(5);
    expect(free.maxVideoDurationMin).toBe(2);
    expect(free.maxUploadBytes).toBe(250 * 1024 * 1024); // 250 MB
    expect(free.canTranslate).toBe(false);
    expect(free.canSpeakerDetect).toBe(false);
    expect(free.canCustomBrand).toBe(false);
    expect(free.maxBrandKits).toBe(0);
  });

  it("enforces Editor plan limits according to pricing page", () => {
    const editor = getPlanCapabilities("editor");
    expect(editor.maxExportResolution).toBe("1080p");
    expect(editor.watermarkRequired).toBe(false);
    expect(editor.monthlyMinutes).toBe(120);
    expect(editor.maxVideoDurationMin).toBe(30);
    expect(editor.maxUploadBytes).toBe(1 * 1024 * 1024 * 1024); // 1 GB
    expect(editor.canTranslate).toBe(false); // Translation is Creator+
    expect(editor.canSpeakerDetect).toBe(false);
    expect(editor.canCustomBrand).toBe(false);
  });

  it("enforces Creator plan limits according to pricing page", () => {
    const creator = getPlanCapabilities("creator");
    expect(creator.maxExportResolution).toBe("4K");
    expect(creator.watermarkRequired).toBe(false);
    expect(creator.monthlyMinutes).toBe(300);
    expect(creator.maxVideoDurationMin).toBe(60);
    expect(creator.maxUploadBytes).toBe(2 * 1024 * 1024 * 1024); // 2 GB
    expect(creator.canTranslate).toBe(true);
    expect(creator.canSpeakerDetect).toBe(true);
    expect(creator.maxSpeakerPresets).toBe(5);
    expect(creator.canCustomBrand).toBe(true);
    expect(creator.maxBrandKits).toBe(2);
  });

  it("enforces Studio plan limits according to pricing page", () => {
    const studio = getPlanCapabilities("studio");
    expect(studio.maxExportResolution).toBe("4K");
    expect(studio.watermarkRequired).toBe(false);
    expect(studio.monthlyMinutes).toBe(720);
    expect(studio.maxVideoDurationMin).toBe(120);
    expect(studio.maxUploadBytes).toBe(5 * 1024 * 1024 * 1024); // 5 GB
    expect(studio.canTranslate).toBe(true);
    expect(studio.canSpeakerDetect).toBe(true);
    expect(studio.maxSpeakerPresets).toBeGreaterThanOrEqual(9999);
    expect(studio.canCustomBrand).toBe(true);
    expect(studio.maxBrandKits).toBeGreaterThanOrEqual(9999);
  });
});
