import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import {
  CAP_PRESETS,
  DEFAULT_CAP_STYLE,
  normalizeCapStyle,
  captionSpanStyle,
  FONT_OPTIONS,
  type CapStyle,
} from "@/lib/captionStyle";
import { AlertCircle, CheckCircle2, Search, RefreshCw } from "lucide-react";

type Result = {
  id: number;
  name: string;
  ok: boolean;
  error?: string;
  warnings: string[];
  style?: CapStyle;
};

const SAMPLE = "The quick brown fox";

const evaluate = (
  preset: { name: string; patch: Partial<CapStyle> },
  id: number,
): Result => {
  const warnings: string[] = [];
  try {
    if (!preset.name || typeof preset.name !== "string") {
      throw new Error("Template is missing a name");
    }
    if (!preset.patch || typeof preset.patch !== "object") {
      throw new Error("Template has no patch object");
    }
    const merged = normalizeCapStyle({ ...DEFAULT_CAP_STYLE, ...preset.patch });

    // Font resolution check
    if (preset.patch.fontFamily) {
      const found = FONT_OPTIONS.some(
        (f) => f.value === preset.patch.fontFamily || f.label === preset.patch.fontFamily,
      );
      if (!found && !/,/.test(preset.patch.fontFamily)) {
        warnings.push(`Font "${preset.patch.fontFamily}" not found in FONT_OPTIONS`);
      }
    }

    // Hex color sanity
    const hexKeys = [
      "color", "highlightColor", "strokeColor", "shadowColor",
      "glowColor", "bgColor", "gradFrom", "gradTo",
    ];
    for (const k of hexKeys) {
      const v = (merged as any)[k];
      if (typeof v === "string" && v.startsWith("#") && !/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)) {
        warnings.push(`Invalid hex for ${k}: "${v}"`);
      }
    }

    // Attempt CSS build
    const css = captionSpanStyle(merged);
    if (!css || typeof css !== "object") throw new Error("captionSpanStyle returned nothing");

    return { id, name: preset.name, ok: true, warnings, style: merged };
  } catch (e: any) {
    return {
      id,
      name: preset?.name ?? "(unnamed)",
      ok: false,
      error: e?.message ?? String(e),
      warnings,
    };
  }
};

const TemplatesSmokeTest = () => {
  const [query, setQuery] = useState("");
  const [showFailingOnly, setShowFailingOnly] = useState(false);
  const [tick, setTick] = useState(0);

  const results = useMemo<Result[]>(
    () => CAP_PRESETS.map((p, i) => evaluate(p, i)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tick],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return results.filter((r) => {
      if (showFailingOnly && r.ok && r.warnings.length === 0) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        String(r.id).includes(q) ||
        (r.error?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [results, query, showFailingOnly]);

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  const warned = results.filter((r) => r.ok && r.warnings.length > 0).length;

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Templates smoke test</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Loads every entry in <code className="rounded bg-secondary/60 px-1 py-0.5 text-[11px]">CAP_PRESETS</code>, renders a preview, and flags any failing templates with the exact template id and error.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-full border border-border bg-card/50 px-3 py-1 text-xs">
              <span className="text-primary font-semibold">{passed}</span>
              <span className="text-muted-foreground"> passed</span>
              {warned > 0 && (
                <>
                  <span className="mx-2 text-muted-foreground/40">·</span>
                  <span className="text-amber-400 font-semibold">{warned}</span>
                  <span className="text-muted-foreground"> warned</span>
                </>
              )}
              {failed > 0 && (
                <>
                  <span className="mx-2 text-muted-foreground/40">·</span>
                  <span className="text-destructive font-semibold">{failed}</span>
                  <span className="text-muted-foreground"> failed</span>
                </>
              )}
              <span className="mx-2 text-muted-foreground/40">/</span>
              <span className="text-muted-foreground">{results.length} total</span>
            </div>
            <button
              onClick={() => setTick((t) => t + 1)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/60 px-3 py-1.5 text-xs font-semibold hover:border-primary/50"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Re-run
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by name, id, or error…"
              className="w-full rounded-lg border border-border bg-background/60 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary/60"
            />
          </div>
          <label className="inline-flex items-center gap-2 rounded-lg border border-border bg-card/40 px-3 py-2 text-xs font-semibold">
            <input
              type="checkbox"
              checked={showFailingOnly}
              onChange={(e) => setShowFailingOnly(e.target.checked)}
              className="h-3.5 w-3.5 accent-primary"
            />
            Show failing / warning only
          </label>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <div
              key={r.id}
              className={`rounded-xl border p-3 transition-colors ${
                !r.ok
                  ? "border-destructive/40 bg-destructive/5"
                  : r.warnings.length
                  ? "border-amber-500/40 bg-amber-500/5"
                  : "border-border bg-card/40"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {r.ok ? (
                    <CheckCircle2 className={`h-4 w-4 flex-shrink-0 ${r.warnings.length ? "text-amber-400" : "text-primary"}`} />
                  ) : (
                    <AlertCircle className="h-4 w-4 flex-shrink-0 text-destructive" />
                  )}
                  <span className="truncate text-sm font-semibold" title={r.name}>{r.name}</span>
                </div>
                <span className="rounded bg-secondary/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  #{String(r.id).padStart(3, "0")}
                </span>
              </div>

              <div
                className="mt-3 grid h-24 place-items-center overflow-hidden rounded-lg border border-border/60 bg-black/60 px-3"
                style={{ backgroundImage: "linear-gradient(135deg, #0b0b0f 0%, #1a1a24 100%)" }}
              >
                {r.ok && r.style ? (
                  <span
                    style={{
                      ...captionSpanStyle(r.style),
                      fontSize: `${Math.min(28, Math.max(14, r.style.fontSize * 0.4))}px`,
                      display: "inline-block",
                      textAlign: "center",
                      maxWidth: "100%",
                    }}
                  >
                    {SAMPLE}
                  </span>
                ) : (
                  <span className="text-xs text-destructive">Preview unavailable</span>
                )}
              </div>

              {!r.ok && (
                <pre className="mt-2 max-h-24 overflow-auto rounded bg-black/40 p-2 font-mono text-[10px] leading-relaxed text-destructive">
{`id: ${r.id}
name: ${r.name}
error: ${r.error}`}
                </pre>
              )}

              {r.warnings.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-[10px] text-amber-400/90">
                  {r.warnings.map((w, i) => (
                    <li key={i} className="font-mono">⚠ {w}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="mt-8 rounded-xl border border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
            No templates match the current filter.
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default TemplatesSmokeTest;
