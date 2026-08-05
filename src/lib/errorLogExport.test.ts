import { describe, it, expect } from "vitest";
import {
  buildCsv,
  buildJson,
  CSV_COLUMNS,
  CSV_HEADER_LABELS,
  escapeCsvCell,
  filterBySearch,
  type ErrorRow,
} from "./errorLogExport";

const row = (over: Partial<ErrorRow> = {}, i = 0): ErrorRow => ({
  id: `id-${i}`,
  fingerprint: `fp-${i}`,
  severity: "error",
  source: "frontend",
  message: `boom ${i}`,
  stack: null,
  url: null,
  user_agent: null,
  function_name: null,
  user_id: null,
  context: {},
  occurrence_count: 1,
  first_seen_at: "2026-07-19T00:00:00.000Z",
  last_seen_at: "2026-07-19T00:00:00.000Z",
  resolved: false,
  resolved_at: null,
  ...over,
});

describe("filterBySearch — empty filters & special chars", () => {
  it("returns every row when the query is empty or whitespace-only", () => {
    const rows = [row({}, 1), row({}, 2), row({}, 3)];
    expect(filterBySearch(rows, "")).toBe(rows);
    expect(filterBySearch(rows, "   ")).toBe(rows);
  });

  it("returns an empty array — never truncates or throws — when nothing matches", () => {
    const rows = [row({ message: "hello" })];
    expect(filterBySearch(rows, "no-such-token")).toEqual([]);
  });

  it("matches against url/function_name/stack too, case-insensitively", () => {
    const rows = [
      row({ message: "x", url: "https://APP/checkout" }, 1),
      row({ message: "x", function_name: "auth" }, 2),
      row({ message: "x", stack: "at Foo (bar.ts:10)" }, 3),
      row({ message: "unrelated" }, 4),
    ];
    expect(filterBySearch(rows, "checkout")).toHaveLength(1);
    expect(filterBySearch(rows, "AUTH")).toHaveLength(1);
    expect(filterBySearch(rows, "bar.ts")).toHaveLength(1);
  });

  it("treats regex metachars in the query as plain text (no ReDoS, no crash)", () => {
    const rows = [
      row({ message: "price is $9.99 (USD)" }, 1),
      row({ message: "safe" }, 2),
    ];
    expect(filterBySearch(rows, ".*")).toEqual([]);
    expect(filterBySearch(rows, "$9.99")).toHaveLength(1);
    expect(filterBySearch(rows, "(usd)")).toHaveLength(1);
  });

  it("matches unicode/emoji queries", () => {
    const rows = [row({ message: "user 你好 🚀 crashed" })];
    expect(filterBySearch(rows, "你好")).toHaveLength(1);
    expect(filterBySearch(rows, "🚀")).toHaveLength(1);
  });
});

describe("escapeCsvCell", () => {
  it("returns empty string for null/undefined", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
  });

  it("quotes and doubles internal quotes", () => {
    expect(escapeCsvCell(`she said "hi"`)).toBe(`"she said ""hi"""`);
  });

  it("quotes cells that contain commas, CR, or LF", () => {
    expect(escapeCsvCell("a,b")).toBe(`"a,b"`);
    expect(escapeCsvCell("line1\nline2")).toBe(`"line1\nline2"`);
    expect(escapeCsvCell("line1\r\nline2")).toBe(`"line1\r\nline2"`);
  });

  it("serialises objects to JSON and escapes the result", () => {
    expect(escapeCsvCell({ a: 'b"c', d: [1, 2] })).toBe(`"{""a"":""b\\""c"",""d"":[1,2]}"`);
  });

  it("leaves benign strings unquoted", () => {
    expect(escapeCsvCell("plain")).toBe("plain");
    expect(escapeCsvCell(42)).toBe("42");
  });
});

describe("buildCsv", () => {
  it("emits header + trailing CRLF for empty rows without truncating columns", () => {
    const csv = buildCsv([]);
    const expectedHeader = [...CSV_COLUMNS, "context"].map((k) => CSV_HEADER_LABELS[k] ?? k).join(",");
    expect(csv).toBe(`${expectedHeader}\r\n\r\n`);
    expect(csv.split(",").length - 1).toBe(CSV_COLUMNS.length); // n commas -> n+1 cols
  });

  it("round-trips special characters via RFC-4180 quoting", () => {
    const csv = buildCsv([
      row({
        message: `crash, "boom"\nnewline`,
        url: "https://ex.com/a,b",
        stack: "line1\r\nline2",
        context: { note: `he said "hi"`, tags: ["a,b", "c"] },
      }),
    ]);
    const lines = csv.split("\r\n");
    // header + 1 data row + trailing empty from final CRLF
    expect(lines).toHaveLength(4);
    expect(lines[3]).toBe("");
    expect(csv).toContain(`"crash, ""boom""`);
    expect(csv).toContain(`"https://ex.com/a,b"`);
    expect(csv).toContain(`""he said \\""hi\\""""`);
  });

  it("handles 10,000 rows without dropping any (no truncation)", () => {
    const rows = Array.from({ length: 10_000 }, (_, i) =>
      row({ message: `m,${i}\n"q"`, occurrence_count: i }, i),
    );
    const csv = buildCsv(rows);
    // header + N data lines + trailing empty
    const parts = csv.split("\r\n");
    expect(parts).toHaveLength(1 + rows.length + 1);
    expect(parts[0].startsWith("Last Seen,")).toBe(true);
    expect(parts[parts.length - 1]).toBe("");
    // Spot-check first and last rows are intact and quoted
    expect(parts[1]).toContain(`"m,0`);
    expect(parts[rows.length]).toContain(`"m,${rows.length - 1}`);
  });
});

describe("buildJson", () => {
  it("returns '[]' for empty input", () => {
    expect(buildJson([])).toBe("[]");
  });

  it("preserves special characters and nested context verbatim", () => {
    const r = row({
      message: `weird "quoted", 你好\nline`,
      context: { emoji: "🚀", nested: { a: 1 } },
    });
    const out = JSON.parse(buildJson([r]));
    expect(out).toHaveLength(1);
    expect(out[0].message).toBe(r.message);
    expect(out[0].context).toEqual(r.context);
  });

  it("keeps all rows in a large export (no truncation)", () => {
    const rows = Array.from({ length: 5_000 }, (_, i) => row({}, i));
    const parsed = JSON.parse(buildJson(rows));
    expect(parsed).toHaveLength(5_000);
    expect(parsed[0].id).toBe("id-0");
    expect(parsed[4999].id).toBe("id-4999");
  });
});
