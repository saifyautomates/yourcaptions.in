import { describe, it, expect } from "vitest";
import { canUseTemplate, isFreeTemplateName } from "@/lib/templateGating";
import { FREE_PRESET_NAMES, CAP_PRESETS } from "@/lib/captionStyle";

const FREE = ["Yellow Highlight", "Popping Text", "Stroke Outline"];
const PREMIUM_SAMPLE = "Neon Cyberpunk XYZ";

describe("isFreeTemplateName", () => {
  it("matches exact names", () => {
    expect(isFreeTemplateName("Yellow Highlight", FREE)).toBe(true);
  });
  it("is case- and whitespace-insensitive", () => {
    expect(isFreeTemplateName("  yellow HIGHLIGHT ", FREE)).toBe(true);
  });
  it("rejects names not in the free list", () => {
    expect(isFreeTemplateName(PREMIUM_SAMPLE, FREE)).toBe(false);
  });
  it("returns false for empty input", () => {
    expect(isFreeTemplateName("", FREE)).toBe(false);
    expect(isFreeTemplateName("   ", FREE)).toBe(false);
  });
  it("falls back to built-in FREE_PRESET_NAMES when no list given", () => {
    for (const n of FREE_PRESET_NAMES) {
      expect(isFreeTemplateName(n)).toBe(true);
    }
  });
});

describe("canUseTemplate - free (non-paid) users", () => {
  const base = { freeNames: FREE, isPaid: false, isAdmin: false };
  it("allows every free template", () => {
    for (const n of FREE) {
      expect(canUseTemplate({ ...base, name: n })).toBe(true);
    }
  });
  it("blocks every premium template", () => {
    expect(canUseTemplate({ ...base, name: PREMIUM_SAMPLE })).toBe(false);
    expect(canUseTemplate({ ...base, name: "Anything Not In List" })).toBe(false);
  });
});

describe("canUseTemplate - paid users", () => {
  it("allows free and premium templates", () => {
    expect(canUseTemplate({ name: FREE[0], freeNames: FREE, isPaid: true })).toBe(true);
    expect(canUseTemplate({ name: PREMIUM_SAMPLE, freeNames: FREE, isPaid: true })).toBe(true);
  });
});

describe("canUseTemplate - admin users", () => {
  it("bypasses gating for all templates", () => {
    expect(canUseTemplate({ name: PREMIUM_SAMPLE, freeNames: FREE, isAdmin: true })).toBe(true);
    expect(canUseTemplate({ name: FREE[0], freeNames: [], isAdmin: true })).toBe(true);
  });
  it("grants access even when not paid", () => {
    expect(
      canUseTemplate({ name: PREMIUM_SAMPLE, freeNames: FREE, isPaid: false, isAdmin: true }),
    ).toBe(true);
  });
});

describe("canUseTemplate - admin free-list config edge cases", () => {
  it("blocks all templates for free users when admin empties the list", () => {
    for (const p of CAP_PRESETS.slice(0, 10)) {
      expect(canUseTemplate({ name: p.name, freeNames: [], isPaid: false })).toBe(false);
    }
  });
  it("respects admin-added names that aren't in the built-in defaults", () => {
    expect(
      canUseTemplate({ name: PREMIUM_SAMPLE, freeNames: [PREMIUM_SAMPLE], isPaid: false }),
    ).toBe(true);
  });
  it("built-in defaults resolve to real presets in CAP_PRESETS", () => {
    const presetNames = new Set(CAP_PRESETS.map((p) => p.name.toLowerCase()));
    for (const n of FREE_PRESET_NAMES) {
      expect(presetNames.has(n.toLowerCase())).toBe(true);
    }
  });
});

describe("canUseTemplate - coverage across all 100+ templates", () => {
  it("free users can only access templates from freeNames", () => {
    const freeSet = new Set(FREE_PRESET_NAMES.map((n) => n.toLowerCase()));
    for (const p of CAP_PRESETS) {
      const expected = freeSet.has(p.name.toLowerCase());
      expect(canUseTemplate({ name: p.name, isPaid: false, isAdmin: false })).toBe(expected);
    }
  });
  it("paid users can access every preset", () => {
    for (const p of CAP_PRESETS) {
      expect(canUseTemplate({ name: p.name, isPaid: true })).toBe(true);
    }
  });
});
