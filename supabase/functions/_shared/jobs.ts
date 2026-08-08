// Shared helpers for the persistent background-job queue.
// Rows live in public.jobs. Progress + message are written incrementally so
// the client can display a live progress bar and resume after reconnect.

import { createClient, SupabaseClient } from "@supabase/supabase-js";

export type JobKind = "transcribe" | "dub" | "translate";
export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";

export function jobsClient(): SupabaseClient {
  return createClient(
    (Deno.env.get("SUPABASE_URL") || "").replace("mqotnflwrgqppbhjkwyq", "mqotnlflwrgqpbhjkwyq"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export async function createJob(
  admin: SupabaseClient,
  args: {
    user_id: string;
    project_id?: string | null;
    kind: JobKind;
    input?: Record<string, unknown>;
    message?: string;
  },
): Promise<string> {
  const { data, error } = await admin
    .from("jobs")
    .insert({
      user_id: args.user_id,
      project_id: args.project_id ?? null,
      kind: args.kind,
      status: "queued",
      progress: 0,
      message: args.message ?? "Queued",
      input: args.input ?? {},
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`createJob: ${error?.message ?? "no row"}`);
  return data.id as string;
}

export async function startJob(admin: SupabaseClient, jobId: string, message = "Starting") {
  await admin.from("jobs").update({
    status: "running",
    progress: 1,
    message,
    started_at: new Date().toISOString(),
  }).eq("id", jobId);
}

// Throttled progress writer — avoids hammering Postgres with per-token updates.
export function progressWriter(admin: SupabaseClient, jobId: string, minMs = 400) {
  let last = 0;
  let pending: { progress: number; message: string } | null = null;
  let flushing: Promise<void> | null = null;

  const flush = async () => {
    if (!pending) return;
    const p = pending; pending = null;
    last = Date.now();
    await admin.from("jobs").update({
      progress: Math.min(99, Math.max(1, Math.round(p.progress))),
      message: p.message,
    }).eq("id", jobId);
  };

  return async (progress: number, message: string) => {
    pending = { progress, message };
    const gap = Date.now() - last;
    if (gap < minMs) {
      if (!flushing) {
        flushing = new Promise<void>((resolve) => setTimeout(async () => {
          flushing = null; try { await flush(); } finally { resolve(); }
        }, minMs - gap));
      }
      return;
    }
    await flush();
  };
}

export async function succeedJob(
  admin: SupabaseClient,
  jobId: string,
  result: Record<string, unknown>,
  message = "Complete",
) {
  await admin.from("jobs").update({
    status: "succeeded",
    progress: 100,
    message,
    result,
    finished_at: new Date().toISOString(),
  }).eq("id", jobId);
}

export async function failJob(admin: SupabaseClient, jobId: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  await admin.from("jobs").update({
    status: "failed",
    message: "Failed",
    error: message,
    finished_at: new Date().toISOString(),
  }).eq("id", jobId);
}
