import { useEffect } from "react";

type Handler = (e: KeyboardEvent) => void;

/**
 * Register global keyboard shortcuts. Skips when focus is inside an editable element.
 * Keys map format: { "mod+k": fn, "?": fn, "space": fn, "j": fn }.
 */
export function useHotkeys(map: Record<string, Handler>, deps: unknown[] = []) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const editable =
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable);
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key === " " ? "space" : e.key.toLowerCase();
      const combo = `${mod ? "mod+" : ""}${e.shiftKey && key.length > 1 ? "shift+" : ""}${key}`;
      // Allow mod+ combos even in editable fields (Save, Search)
      if (editable && !mod) return;
      const fn = map[combo] || map[key];
      if (fn) {
        e.preventDefault();
        fn(e);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
