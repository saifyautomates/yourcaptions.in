import { useEffect } from "react";
import { toast } from "sonner";
import { TEMPLATE_WARNINGS, type TemplateWarning } from "@/lib/captionStyle";

// Drains warnings collected at import time and listens for new ones emitted at
// runtime, batching them into a single friendly toast so a broken pack never
// spams the UI or crashes the preview.
export const useTemplateWarnings = () => {
  useEffect(() => {
    const shown = new Set<string>();
    const key = (w: TemplateWarning) => `${w.templateName}::${w.field}::${w.value}`;

    const summarize = (items: TemplateWarning[]) => {
      const first = items[0];
      const extra = items.length - 1;
      const head = `Template "${first.templateName}" · ${first.field}: ${first.reason}`;
      return extra > 0 ? `${head} (+${extra} more)` : head;
    };

    const flush = (batch: TemplateWarning[]) => {
      const fresh = batch.filter((w) => {
        const k = key(w);
        if (shown.has(k)) return false;
        shown.add(k);
        return true;
      });
      if (fresh.length === 0) return;
      toast.warning("Some caption templates need attention", {
        description: summarize(fresh),
        duration: 6000,
      });
    };

    // Drain what was collected during module init.
    if (TEMPLATE_WARNINGS.length > 0) flush([...TEMPLATE_WARNINGS]);

    // Debounce runtime warnings so a burst becomes one toast.
    let queue: TemplateWarning[] = [];
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onWarn = (e: Event) => {
      const detail = (e as CustomEvent<TemplateWarning>).detail;
      if (!detail) return;
      queue.push(detail);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        flush(queue);
        queue = [];
        timer = null;
      }, 400);
    };

    window.addEventListener("captions:template-warning", onWarn as EventListener);
    return () => {
      window.removeEventListener("captions:template-warning", onWarn as EventListener);
      if (timer) clearTimeout(timer);
    };
  }, []);
};
