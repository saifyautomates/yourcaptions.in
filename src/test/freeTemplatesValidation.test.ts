import { describe, it, expect } from "vitest";
import { validateFreeTemplateNames } from "@/hooks/useFreeTemplates";
import { CAP_PRESETS } from "@/lib/captionStyle";

const valid5 = CAP_PRESETS.slice(0, 5).map((p) => p.name);
const valid6 = CAP_PRESETS.slice(0, 6).map((p) => p.name);

describe("validateFreeTemplateNames", () => {
  it("accepts exactly 5 valid names", () => {
    expect(validateFreeTemplateNames(valid5)).toEqual(valid5);
  });
  it("accepts exactly 6 valid names", () => {
    expect(validateFreeTemplateNames(valid6)).toEqual(valid6);
  });
  it("trims whitespace but preserves original casing", () => {
    const padded = valid5.map((n) => `  ${n}  `);
    expect(validateFreeTemplateNames(padded)).toEqual(valid5);
  });
  it("rejects fewer than 5", () => {
    expect(() => validateFreeTemplateNames(valid5.slice(0, 4))).toThrow(/at least 5/);
  });
  it("rejects more than 6", () => {
    expect(() => validateFreeTemplateNames(CAP_PRESETS.slice(0, 7).map((p) => p.name)))
      .toThrow(/at most 6/);
  });
  it("rejects unknown names", () => {
    expect(() => validateFreeTemplateNames([...valid5.slice(0, 4), "Totally Made Up"]))
      .toThrow(/not a valid template/);
  });
  it("rejects duplicates (case-insensitive)", () => {
    const dupe = [...valid5.slice(0, 4), valid5[0].toUpperCase()];
    expect(() => validateFreeTemplateNames(dupe)).toThrow(/[Dd]uplicate/);
  });
  it("rejects non-array input", () => {
    expect(() => validateFreeTemplateNames("nope" as unknown)).toThrow(/must be a list/);
    expect(() => validateFreeTemplateNames(null)).toThrow(/must be a list/);
  });
  it("filters empty strings before counting", () => {
    expect(() => validateFreeTemplateNames([...valid5, "", "  "])).not.toThrow();
    expect(() => validateFreeTemplateNames([...valid5.slice(0, 3), "", "  "])).toThrow(/at least 5/);
  });
});
