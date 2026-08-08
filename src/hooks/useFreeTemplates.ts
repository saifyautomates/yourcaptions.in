// Reads the admin-configured list of free template names from platform_settings.
// Falls back to the built-in FREE_PRESET_NAMES defaults when the setting is
// unset. Public SELECT is allowed on platform_settings so every visitor can
// resolve the gate without auth.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { adminFetch } from "@/lib/adminFetch";
import { CAP_PRESETS, FREE_PRESET_NAMES } from "@/lib/captionStyle";

const KEY = "free_templates";
const MIN_FREE = 5;
const MAX_FREE = 6;

/** Throws if the list violates the 5–6 unique-valid-name rule. */
export function validateFreeTemplateNames(input: unknown): string[] {
  if (!Array.isArray(input)) throw new Error("Free templates must be a list.");
  const cleaned = input
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((v) => v.length > 0);
  if (cleaned.length < MIN_FREE) throw new Error(`Select at least ${MIN_FREE} free templates.`);
  if (cleaned.length > MAX_FREE) throw new Error(`Select at most ${MAX_FREE} free templates.`);
  const validSet = new Set(CAP_PRESETS.map((p) => p.name.toLowerCase()));
  const seen = new Set<string>();
  for (const n of cleaned) {
    const key = n.toLowerCase();
    if (!validSet.has(key)) throw new Error(`"${n}" is not a valid template.`);
    if (seen.has(key)) throw new Error(`Duplicate template: "${n}".`);
    seen.add(key);
  }
  return cleaned;
}

export function useFreeTemplates() {
  const [names, setNames] = useState<string[]>([...FREE_PRESET_NAMES]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", KEY)
      .maybeSingle();
    const raw = (data as any)?.value;
    const arr = Array.isArray(raw) ? raw : Array.isArray(raw?.names) ? raw.names : null;
    setNames(arr && arr.length ? arr.map(String) : [...FREE_PRESET_NAMES]);
    setLoading(false);
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const save = useCallback(async (nextNames: string[]) => {
    const validated = validateFreeTemplateNames(nextNames);
    const res = await adminFetch(`/functions/v1/admin-api/system-settings/${KEY}`, {
      method: "PATCH",
      body: JSON.stringify({ value: validated })
    });
    if (!res.ok) throw new Error(await res.text());
    setNames(validated);
  }, []);

  const set = useMemo(() => new Set(names.map((n) => n.toLowerCase())), [names]);
  const isFree = useCallback((n: string) => set.has(n.toLowerCase()), [set]);

  return { names, isFree, loading, save, refetch };
}
