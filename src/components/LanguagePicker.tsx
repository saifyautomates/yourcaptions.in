import { useMemo, useState } from "react";
import { Search, Check, ChevronDown, X } from "lucide-react";
import { LANGUAGES, LANG_BY_CODE, searchLanguages, type Language } from "@/lib/languages";
import { usePlanInfo } from "@/hooks/usePlanInfo";
import { Lock } from "lucide-react";

type BaseProps = {
  className?: string;
  placeholder?: string;
  /** Optional: restrict pool (e.g. only Indian). */
  only?: Language["region"][];
};

type SingleProps = BaseProps & {
  multi?: false;
  value: string;
  onChange: (code: string) => void;
};

type MultiProps = BaseProps & {
  multi: true;
  value: string[];
  onChange: (codes: string[]) => void;
};

// Region quick-filter chips. Each returns true when the language belongs.
const SOUTH_ASIA_CODES = new Set(["ps", "si", "dv", "dz"]);
const SOUTH_ASIA_SUFFIX = /-(PK|BD|LK|AF|BT|MV|NP)$/i;
const REGION_FILTERS: { key: string; label: string; match: (l: Language) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  {
    key: "south-asia",
    label: "South Asia",
    match: (l) =>
      l.region === "India" ||
      SOUTH_ASIA_CODES.has(l.code) ||
      SOUTH_ASIA_SUFFIX.test(l.code),
  },
  { key: "India", label: "India", match: (l) => l.region === "India" },
  { key: "Asia", label: "Asia", match: (l) => l.region === "Asia" },
  { key: "Middle East", label: "Middle East", match: (l) => l.region === "Middle East" },
  { key: "Europe", label: "Europe", match: (l) => l.region === "Europe" },
  { key: "Africa", label: "Africa", match: (l) => l.region === "Africa" },
  { key: "Americas", label: "Americas", match: (l) => l.region === "Americas" },
  { key: "Oceania", label: "Oceania", match: (l) => l.region === "Oceania" },
];

// Pinned quick picks — one tap for the most-requested languages.
const QUICK_PICKS = ["ps", "ur", "hi", "en", "en-IN", "bn", "ta", "ar", "es", "zh"];

export function LanguagePicker(props: SingleProps | MultiProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [region, setRegion] = useState<string>("all");
  const pool = useMemo(
    () => (props.only ? LANGUAGES.filter((l) => props.only!.includes(l.region!)) : LANGUAGES),
    [props.only],
  );
  const regionFiltered = useMemo(() => {
    const f = REGION_FILTERS.find((r) => r.key === region) ?? REGION_FILTERS[0];
    return pool.filter(f.match);
  }, [pool, region]);
  const results = useMemo(() => searchLanguages(q, regionFiltered), [q, regionFiltered]);

  const grouped = useMemo(() => {
    const groups: Record<string, Language[]> = {};
    for (const l of results) {
      const key = l.region ?? "Other";
      (groups[key] ||= []).push(l);
    }
    return groups;
  }, [results]);

  const quickPicks = useMemo(
    () => QUICK_PICKS.map((c) => LANG_BY_CODE[c]).filter(Boolean) as Language[],
    [],
  );

  const isSelected = (code: string) =>
    props.multi === true ? props.value.includes(code) : props.value === code;

  const toggle = (code: string) => {
    if (props.multi === true) {
      const cur = props.value;
      const next = cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code];
      props.onChange(next);
    } else {
      props.onChange(code);
      setOpen(false);
    }
  };

  const label =
    props.multi === true
      ? props.value.length === 0
        ? props.placeholder ?? "Select languages"
        : `${props.value.length} selected`
      : LANG_BY_CODE[props.value]?.name ?? props.placeholder ?? "Select language";

  return (
    <div className={`relative ${props.className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
      >
        <span className="truncate">{label}</span>
        <ChevronDown className="ml-2 h-4 w-4 opacity-60" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 mt-1.5 w-full min-w-[280px] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg">
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <Search className="h-4 w-4 opacity-60" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search 100+ languages…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {q && (
                <button type="button" onClick={() => setQ("")} aria-label="Clear">
                  <X className="h-3.5 w-3.5 opacity-60" />
                </button>
              )}
            </div>

            {/* Region chips */}
            <div className="flex flex-wrap gap-1 border-b border-border px-2 py-2">
              {REGION_FILTERS.map((r) => {
                if (r.isPremium && !isStudio) return null;
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setRegion(r.key)}
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition flex items-center gap-1 ${
                      region === r.key
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    
                    {r.label}
                  </button>
                );
              })}
            </div>

            {/* Quick picks — only shown when not searching and on "All" */}
            {!q && region === "all" && (
              <div className="border-b border-border px-2 py-2">
                <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Quick picks
                </div>
                <div className="flex flex-wrap gap-1">
                  {quickPicks.map((l) => {
                    const sel = isSelected(l.code);
                    return (
                      <button
                        key={l.code}
                        type="button"
                        onClick={() => toggle(l.code)}
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] transition ${
                          sel
                            ? "border-foreground bg-foreground text-background"
                            : "border-border bg-background hover:bg-accent hover:text-accent-foreground"
                        }`}
                        dir={l.rtl ? "rtl" : "ltr"}
                      >
                        {l.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="max-h-64 overflow-y-auto">
              {Object.keys(grouped).length === 0 && (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                  No languages match “{q}”.
                </div>
              )}
              {(["India", "Asia", "Middle East", "Europe", "Africa", "Americas", "Oceania"] as const).map(
                (region) =>
                  grouped[region] ? (
                    <div key={region}>
                      <div className="sticky top-0 bg-popover px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {region}
                      </div>
                      {grouped[region].map((l) => {
                        const sel = isSelected(l.code);
                        return (
                          <button
                            type="button"
                            key={l.code}
                            onClick={() => toggle(l.code)}
                            className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground ${
                              sel ? "bg-accent/50" : ""
                            }`}
                          >
                            <span className="flex items-baseline gap-2">
                              <span>{l.name}</span>
                              {l.native && l.native !== l.name && (
                                <span className="text-xs text-muted-foreground" dir={l.rtl ? "rtl" : "ltr"}>
                                  {l.native}
                                </span>
                              )}
                            </span>
                            <span className="flex items-center gap-2">
                              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                {l.code}
                              </span>
                              {sel && <Check className="h-3.5 w-3.5" />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null,
              )}
            </div>

            {props.multi && props.value.length > 0 && (
              <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs">
                <span className="text-muted-foreground">{props.value.length} selected</span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => props.onChange([])}
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
