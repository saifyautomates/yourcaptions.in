import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Row = {
  id: string;
  user_id: string | null;
  name: string | null;
  email: string | null;
  message: string;
  status: string;
  created_at: string;
};

export default function AdminFeedback() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "new" | "resolved">("all");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("feedback_submissions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setRows((data as Row[]) ?? []);
  }

  useEffect(() => { load(); }, []);

  async function setStatus(id: string, status: string) {
    const { error } = await supabase.from("feedback_submissions").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setRows((r) => r.map((x) => (x.id === id ? { ...x, status } : x)));
  }

  async function remove(id: string) {
    if (!confirm("Delete this feedback?")) return;
    const { error } = await supabase.from("feedback_submissions").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setRows((r) => r.filter((x) => x.id !== id));
  }

  const filtered = rows.filter((r) => filter === "all" ? true : r.status === filter);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">User Feedback</h1>
          <p className="text-sm text-muted-foreground">Suggestions submitted from the landing page.</p>
        </div>
        <div className="flex gap-2">
          {(["all", "new", "resolved"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md border px-3 py-1.5 text-[13px] font-medium capitalize ${
                filter === f ? "border-[#E60000] bg-[#E60000]/10 text-white" : "border-border text-muted-foreground hover:text-white"
              }`}
            >
              {f}
            </button>
          ))}
          <button onClick={load} className="rounded-md border border-border px-3 py-1.5 text-[13px]">Refresh</button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
          No feedback yet.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div key={r.id} className="rounded-lg border border-border bg-card p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[13px] text-muted-foreground">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-white">{r.name || "Anonymous"}</span>
                  {r.email && <span>· {r.email}</span>}
                  <span>· {new Date(r.created_at).toLocaleString()}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[12px] uppercase ${r.status === "new" ? "bg-[#E60000]/20 text-[#FF4D4D]" : "bg-[#1a1a1a] text-[#A3A3A3]"}`}>
                    {r.status}
                  </span>
                </div>
                <div className="flex gap-2">
                  {r.status !== "resolved" && (
                    <button onClick={() => setStatus(r.id, "resolved")} className="text-[13px] text-[#FF4D4D] hover:text-white">
                      Mark resolved
                    </button>
                  )}
                  {r.status === "resolved" && (
                    <button onClick={() => setStatus(r.id, "new")} className="text-[13px] text-muted-foreground hover:text-white">
                      Reopen
                    </button>
                  )}
                  <button onClick={() => remove(r.id)} className="text-[13px] text-muted-foreground hover:text-red-400">
                    Delete
                  </button>
                </div>
              </div>
              <p className="whitespace-pre-wrap text-sm text-white/90">{r.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
