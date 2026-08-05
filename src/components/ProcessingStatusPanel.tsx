// Live processing status panel for a project's transcription pipeline.
// Subscribes to the most recent transcribe job for this project (queued/running
// or just finished) via useActiveJobs + realtime updates, and maps the job's
// progress+message to the ordered pipeline steps: media load → FFmpeg audio
// extraction → provider transcription (Deepgram Nova-3 / Whisper / AssemblyAI /
// Whisper) → save + cleanup. Each step shows a running/done/pending state and
// the overall progress bar.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveJobs, type JobRow } from "@/hooks/useJob";
import { Check, Loader2, Circle, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

type StepKey = "load" | "ffmpeg" | "provider" | "save";

interface StepDef {
  key: StepKey;
  label: string;
  detail: (job: JobRow) => string;
  // progress threshold at which this step is considered active
  from: number;
  to: number;
}

const STEPS: StepDef[] = [
  { key: "load",     label: "Loading media",           detail: () => "Fetching source video",           from: 1,  to: 15 },
  { key: "ffmpeg",   label: "Extracting audio",        detail: () => "Optimizing audio format",                    from: 15, to: 28 },
  { key: "provider", label: "Transcribing",            detail: (j) => providerLabel(j),                 from: 28, to: 82 },
  { key: "save",     label: "Saving & cleanup",        detail: () => "Writing captions",                from: 82, to: 100 },
];

function providerLabel(j: JobRow): string {
  const msg = (j.message ?? "").toLowerCase();
  if (msg.includes("deepgram")) return "AI Model 1";
  if (msg.includes("whisper")) return "OpenAI Whisper";
  if (msg.includes("assemblyai")) return "AssemblyAI Universal";
  if (msg.includes("retry")) return "Falling back to next provider…";
  const inputProv = (j.input as any)?.provider;
  if (inputProv) return `Provider: ${inputProv}`;
  return "Provider running";
}

function stepState(step: StepDef, job: JobRow): "done" | "running" | "pending" | "failed" {
  if (job.status === "failed") {
    if (job.progress >= step.from && job.progress < step.to) return "failed";
    if (job.progress >= step.to) return "done";
    return "pending";
  }
  if (job.status === "succeeded") return "done";
  if (job.progress >= step.to) return "done";
  if (job.progress >= step.from) return "running";
  return "pending";
}

export function ProcessingStatusPanel({ projectId }: { projectId: string }) {
  const { jobs } = useActiveJobs({ projectId, kind: "transcribe" });
  const activeJob = jobs[0] ?? null;

  // Also surface the most recently finished job for a few seconds so users
  // see the ✔ Complete state before it disappears.
  const [lastDone, setLastDone] = useState<JobRow | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (activeJob) return;
    (async () => {
      const { data } = await supabase.from("jobs")
        .select("*")
        .eq("project_id", projectId)
        .eq("kind", "transcribe")
        .order("created_at", { ascending: false })
        .limit(1);
      if (cancelled) return;
      const j = (data ?? [])[0] as JobRow | undefined;
      if (j && (j.status === "succeeded" || j.status === "failed")) {
        const age = Date.now() - new Date(j.finished_at ?? j.updated_at).getTime();
        if (age < 20_000) setLastDone(j);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId, activeJob]);

  const job = activeJob ?? lastDone;
  const [dismissed, setDismissed] = useState<string | null>(null);
  if (!job || dismissed === job.id) return null;

  const running = job.status === "queued" || job.status === "running";
  const failed = job.status === "failed";

  return (
    <div className="mx-4 my-2 rounded-lg border border-border/60 bg-card/60 backdrop-blur px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          {running ? (
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          ) : failed ? (
            <AlertTriangle className="w-4 h-4 text-destructive" />
          ) : (
            <Check className="w-4 h-4 text-green-500" />
          )}
          <span>
            {running ? "Processing captions" : failed ? "Processing failed" : "Processing complete"}
          </span>
          <span className="text-xs text-muted-foreground ml-1">
            {job.progress}% · {job.message ?? job.status}
          </span>
        </div>
        {!running && (
          <button
            onClick={() => setDismissed(job.id)}
            className="text-muted-foreground hover:text-foreground p-1 rounded"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mb-3">
        <div
          className={cn(
            "h-full transition-all duration-500",
            failed ? "bg-destructive" : running ? "bg-primary" : "bg-green-500",
          )}
          style={{ width: `${Math.min(100, Math.max(2, job.progress))}%` }}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        {STEPS.map((s) => {
          const st = stepState(s, job);
          return (
            <div
              key={s.key}
              className={cn(
                "flex items-start gap-2 rounded-md border px-2.5 py-2 text-xs",
                st === "running" && "border-primary/50 bg-primary/5",
                st === "done" && "border-green-500/40 bg-green-500/5",
                st === "failed" && "border-destructive/50 bg-destructive/5",
                st === "pending" && "border-border/50 bg-transparent opacity-70",
              )}
            >
              <div className="mt-0.5 shrink-0">
                {st === "done" ? <Check className="w-3.5 h-3.5 text-green-500" />
                  : st === "running" ? <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                  : st === "failed" ? <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                  : <Circle className="w-3.5 h-3.5 text-muted-foreground" />}
              </div>
              <div className="min-w-0">
                <div className="font-medium truncate">{s.label}</div>
                <div className="text-muted-foreground truncate">
                  {st === "running" || (s.key === "provider" && st === "done") ? s.detail(job) : ""}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {failed && job.error && (
        <div className="mt-2 text-xs text-destructive/90 truncate" title={job.error}>
          {job.error}
        </div>
      )}
    </div>
  );
}

export default ProcessingStatusPanel;
