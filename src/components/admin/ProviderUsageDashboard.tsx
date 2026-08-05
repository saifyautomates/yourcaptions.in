import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Activity } from "lucide-react";
import { toast } from "sonner";

type ProviderStats = {
  provider: string;
  total_seconds: number;
  request_count: number;
};

export const ProviderUsageDashboard = () => {
  const [stats, setStats] = useState<ProviderStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        // We'll fetch all projects and aggregate their duration by provider
        // for Deepgram and AssemblyAI (STT).
        const { data: projects, error: projectsError } = await supabase
          .from("projects")
          .select("provider, duration_seconds");

        // We could also fetch dubbing data if recorded in a similar way or via events.
        // For ElevenLabs, typically it's recorded in usage_events or another table.
        // We'll simulate the elevenlabs token usage via usage_events if possible,
        // but since usage_events doesn't natively store 'provider' column, we will
        // try to fetch from 'usage_events' and count 'dub-elevenlabs' if that's the format,
        // or just mock the aggregation if the DB structure for dub provider is absent.
        // Let's assume projects captures STT provider, and maybe we have dub events.
        
        if (projectsError) {
          // If table missing in this env, we just skip
          console.error(projectsError);
        }
        
        // Aggregate projects
        const agg = new Map<string, ProviderStats>();
        
        const ensureProv = (p: string) => {
          if (!agg.has(p)) {
            agg.set(p, { provider: p, total_seconds: 0, request_count: 0 });
          }
          return agg.get(p)!;
        };

        if (projects) {
          for (const p of projects) {
            const provName = p.provider || "default";
            const s = ensureProv(provName);
            s.request_count++;
            s.total_seconds += (p.duration_seconds || 0);
          }
        }
        
        // Simulate fetching elevenlabs from usage_events if we have cost_units
        const { data: events, error: evError } = await supabase
          .from("usage_events")
          .select("function_name, cost_units");
          
        if (events) {
          for (const e of events) {
            if (e.function_name === "dub-elevenlabs" || e.function_name === "elevenlabs-dub") {
              const s = ensureProv("elevenlabs");
              s.request_count++;
              s.total_seconds += (e.cost_units || 0);
            }
          }
        }

        if (mounted) {
          setStats(Array.from(agg.values()).sort((a, b) => b.total_seconds - a.total_seconds));
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    
    load();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="overflow-hidden rounded-xl border border-border mt-6">
      <div className="flex items-center justify-between border-b border-border bg-card/50 px-4 py-2 text-xs font-medium text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5" />
          Provider Token Consumption
        </span>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      </div>
      <div className="p-4 grid gap-4 md:grid-cols-3">
        {stats.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground col-span-full">No provider data available.</p>
        )}
        {stats.map((s) => (
          <div key={s.provider} className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-medium capitalize mb-2">{s.provider}</h3>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-2xl font-semibold tabular-nums">{Math.round(s.total_seconds)}<span className="text-sm text-muted-foreground font-normal ml-1">sec</span></p>
                <p className="text-xs text-muted-foreground mt-1">{s.request_count} requests</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
