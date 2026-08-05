import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const MaintenanceBanner = () => {
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("platform_settings" as any)
        .select("value")
        .eq("key", "maintenance_mode")
        .maybeSingle();
      if (cancelled || !data) return;
      const v = (data as any).value ?? {};
      setEnabled(!!v.enabled);
      setMessage(v.message ?? "Scheduled maintenance in progress.");
    })();
    return () => { cancelled = true; };
  }, []);

  if (!enabled) return null;
  return (
    <div className="w-full border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-300">
      <span className="inline-flex items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5" />
        {message}
      </span>
    </div>
  );
};
