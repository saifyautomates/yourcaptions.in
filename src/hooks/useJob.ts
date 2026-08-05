// Client-side hook for subscribing to a background job.
// Fetches the initial row, then subscribes via Supabase Realtime for live
// progress updates. Handles reconnect: whenever the realtime channel drops
// and rejoins we re-fetch the latest state so we can never miss the terminal
// event.

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";
export type JobKind = "transcribe" | "dub" | "translate";

export interface JobRow {
  id: string;
  user_id: string;
  project_id: string | null;
  kind: JobKind;
  status: JobStatus;
  progress: number;
  message: string | null;
  input: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export function useJob(jobId: string | null | undefined) {
  const [job, setJob] = useState<JobRow | null>(null);
  const [loading, setLoading] = useState<boolean>(!!jobId);
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

  useEffect(() => {
    if (!jobId) { setJob(null); setLoading(false); return; }
    setLoading(true);

    let cancelled = false;
    const refetch = async () => {
      const { data } = await supabase.from("jobs").select("*").eq("id", jobId).maybeSingle();
      if (cancelled || !mounted.current) return;
      if (data) setJob(data as JobRow);
      setLoading(false);
    };
    refetch();

    const channel = supabase
      .channel(`job:${jobId}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "jobs", filter: `id=eq.${jobId}` },
        (payload) => { if (!cancelled) setJob(payload.new as JobRow); },
      )
      .subscribe((status) => {
        // If the socket dropped and rejoined, resync — we may have missed events.
        if (status === "SUBSCRIBED") refetch();
      });

    return () => {
      cancelled = true;
      try { channel.unsubscribe(); } catch { /* noop */ }
      supabase.removeChannel(channel);
    };
  }, [jobId]);

  return { job, loading };
}

// Lists this user's active (queued/running) jobs — used on load to resume
// any in-flight work started in a previous session.
export function useActiveJobs(opts?: { projectId?: string; kind?: JobKind }) {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      let q = supabase.from("jobs").select("*")
        .in("status", ["queued", "running"])
        .order("created_at", { ascending: false });
      if (opts?.projectId) q = q.eq("project_id", opts.projectId);
      if (opts?.kind) q = q.eq("kind", opts.kind);
      const { data } = await q;
      if (!cancelled) { setJobs((data ?? []) as JobRow[]); setLoading(false); }
    };
    load();

    const filter = opts?.projectId ? `project_id=eq.${opts.projectId}` : undefined;
    const channel = supabase
      .channel(`jobs:active${opts?.projectId ? `:${opts.projectId}` : ""}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs", ...(filter ? { filter } : {}) },
        () => load(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      try { channel.unsubscribe(); } catch { /* noop */ }
      supabase.removeChannel(channel);
    };
  }, [opts?.projectId, opts?.kind]);

  return { jobs, loading };
}
