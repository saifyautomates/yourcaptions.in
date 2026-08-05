import { describe, expect, it } from "vitest";
import {
  buildExportFilename,
  formatExportStamp,
  sanitizeFilenameToken,
} from "./errorLogExport";

// Fixed reference instant used throughout: 2026-07-19T15:30:45.123Z.
const FIXED = new Date(Date.UTC(2026, 6, 19, 15, 30, 45, 123));
const FIXED_STAMP = "2026-07-19T15-30-45";

describe("formatExportStamp", () => {
  it("produces a filesystem-safe ISO stamp without ':' or '.'", () => {
    const s = formatExportStamp(FIXED);
    expect(s).toBe(FIXED_STAMP);
    expect(s).not.toMatch(/[:.]/);
    expect(s).toHaveLength(19);
  });

  it("is deterministic for the same instant", () => {
    expect(formatExportStamp(FIXED)).toBe(formatExportStamp(new Date(FIXED.getTime())));
  });

  it("throws RangeError on invalid dates", () => {
    expect(() => formatExportStamp(new Date("not-a-date"))).toThrow(RangeError);
    // @ts-expect-error deliberate misuse
    expect(() => formatExportStamp("2026-01-01")).toThrow(RangeError);
  });
});

describe("sanitizeFilenameToken", () => {
  it("lowercases, replaces unsafe chars with '-', and trims separators", () => {
    expect(sanitizeFilenameToken("Edge Function")).toBe("edge-function");
    expect(sanitizeFilenameToken("A / B \\ C")).toBe("a-b-c");
    expect(sanitizeFilenameToken("__weird..NAME__")).toBe("weird-name");
    expect(sanitizeFilenameToken("../../etc/passwd")).toBe("etc-passwd");
    expect(sanitizeFilenameToken("💥emoji💥")).toBe("emoji");
  });
});

describe("buildExportFilename", () => {
  it("uses 'errors' tag and matches format extension by default", () => {
    const csv = buildExportFilename({ format: "csv", status: "open", authOnly: false, date: FIXED });
    const json = buildExportFilename({ format: "json", status: "open", authOnly: false, date: FIXED });
    expect(csv).toBe(`errors-open-${FIXED_STAMP}.csv`);
    expect(json).toBe(`errors-open-${FIXED_STAMP}.json`);
    expect(csv.endsWith(".csv")).toBe(true);
    expect(json.endsWith(".json")).toBe(true);
  });

  it("switches the tag to 'auth' when authOnly is on", () => {
    const name = buildExportFilename({ format: "csv", status: "resolved", authOnly: true, date: FIXED });
    expect(name).toBe(`auth-resolved-${FIXED_STAMP}.csv`);
  });

  it("omits severity/source qualifiers when they are 'all'", () => {
    const name = buildExportFilename({
      format: "json", status: "all", authOnly: false,
      severity: "all", source: "all", date: FIXED,
    });
    expect(name).toBe(`errors-all-${FIXED_STAMP}.json`);
  });

  it("appends severity and source when they narrow the filter", () => {
    const name = buildExportFilename({
      format: "csv", status: "open", authOnly: false,
      severity: "critical", source: "edge_function", date: FIXED,
    });
    expect(name).toBe(`errors-open-critical-edge-function-${FIXED_STAMP}.csv`);
  });

  it("is deterministic and only differs when inputs differ", () => {
    const a = buildExportFilename({ format: "csv", status: "open", authOnly: false, date: FIXED });
    const b = buildExportFilename({ format: "csv", status: "open", authOnly: false, date: FIXED });
    expect(a).toBe(b);

    const different = [
      buildExportFilename({ format: "json", status: "open", authOnly: false, date: FIXED }),
      buildExportFilename({ format: "csv", status: "resolved", authOnly: false, date: FIXED }),
      buildExportFilename({ format: "csv", status: "open", authOnly: true, date: FIXED }),
      buildExportFilename({ format: "csv", status: "open", authOnly: false, severity: "error", date: FIXED }),
      buildExportFilename({ format: "csv", status: "open", authOnly: false, source: "frontend", date: FIXED }),
      buildExportFilename({ format: "csv", status: "open", authOnly: false, date: new Date(FIXED.getTime() + 1000) }),
    ];
    for (const other of different) expect(other).not.toBe(a);
    // ...and every combination is itself unique.
    expect(new Set(different).size).toBe(different.length);
  });

  it("contains only URL/filesystem-safe characters", () => {
    const name = buildExportFilename({
      format: "csv", status: "open", authOnly: true,
      severity: "warning", source: "edge_function", date: FIXED,
    });
    expect(name).toMatch(/^[a-zA-Z0-9.\-]+$/);
    expect(name).not.toMatch(/[\s/\\?%*:|"<>]/);
    expect(name.split(".").pop()).toBe("csv");
  });

  it("uses the current date when none is provided", () => {
    const before = Date.now();
    const name = buildExportFilename({ format: "csv", status: "open", authOnly: false });
    const after = Date.now();
    const match = name.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})\.csv$/);
    expect(match).not.toBeNull();
    const parsed = new Date(match![1].replace(/-(\d{2})-(\d{2})$/, ":$1:$2").replace(/T(\d{2})-/, "T$1:")).getTime();
    // Allow a 5-second window either side for clock skew.
    expect(parsed).toBeGreaterThanOrEqual(before - 5000);
    expect(parsed).toBeLessThanOrEqual(after + 5000);
  });

  it("rejects unsupported formats and statuses", () => {
    // @ts-expect-error deliberate misuse
    expect(() => buildExportFilename({ format: "xml", status: "open", authOnly: false })).toThrow(RangeError);
    // @ts-expect-error deliberate misuse
    expect(() => buildExportFilename({ format: "csv", status: "pending", authOnly: false })).toThrow(RangeError);
  });

  it("caps length while preserving the timestamp and extension", () => {
    // Craft an artificially long severity token through the enum's escape hatch.
    const long = "x".repeat(500);
    const name = buildExportFilename({
      format: "json", status: "open", authOnly: false,
      // @ts-expect-error force sanitiser to see a long token
      severity: long, source: "frontend", date: FIXED,
    });
    expect(name.length).toBeLessThanOrEqual(120);
    expect(name.endsWith(`-${FIXED_STAMP}.json`)).toBe(true);
    // Middle got trimmed but the timestamp is intact.
    expect(name).toContain(FIXED_STAMP);
  });
});
