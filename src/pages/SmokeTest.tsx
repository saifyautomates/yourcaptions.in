import { useMemo, useRef, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithRetry } from "@/lib/invokeWithRetry";
import { runQuickExport } from "@/lib/quickExport";
import { CAP_PRESETS, DEFAULT_CAP_STYLE, normalizeCapStyle } from "@/lib/captionStyle";
import { CheckCircle2, Circle, Loader2, AlertCircle, UploadCloud, PlayCircle, Sparkles, Download, RefreshCw, FlaskConical, Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

type StepId = "upload" | "create" | "transcribe" | "editor" | "template" | "export" | "cleanup";
type StepState = "pending" | "running" | "ok" | "fail" | "skipped";

interface StepInfo { id: StepId; title: string; hint: string; icon: any }
const STEPS: StepInfo[] = [
  { id: "upload",     title: "Upload short clip",      hint: "≤ 60 seconds recommended · MP4/MOV/audio · max 100 MB", icon: UploadCloud },
  { id: "create",     title: "Create project",         hint: "Provisions a temporary project row and storage object",  icon: FlaskConical },
  { id: "transcribe", title: "Run transcription",      hint: "AssemblyAI end-to-end · polls until captions arrive",    icon: PlayCircle },
  { id: "editor",     title: "Load editor preview",    hint: "Fetches signed media URL and warms the caption editor",  icon: Eye },
  { id: "template",   title: "Apply styling",          hint: "Loads the “Hormozi” preset onto the caption style",      icon: Sparkles },
  { id: "export",     title: "Export 1080p",           hint: "Meters credits, encodes, and downloads the burn-in",     icon: Download },
  { id: "cleanup",    title: "Cleanup temp files",     hint: "Removes the temporary project and storage object",       icon: Trash2 },
];


const uploadWithProgress = (url: string, token: string, file: File, onProgress: (p: number) => void) =>
  new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(xhr.responseText || `Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const INITIAL_STATES: Record<StepId, StepState> = {
  upload: "pending", create: "pending", transcribe: "pending",
  editor: "pending", template: "pending", export: "pending", cleanup: "pending",
};

const SmokeTest = () => {
  const { user, session } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [autoCleanup, setAutoCleanup] = useState(true);
  const [states, setStates] = useState<Record<StepId, StepState>>({ ...INITIAL_STATES });
  const [logs, setLogs] = useState<string[]>([]);
  const [uploadPct, setUploadPct] = useState(0);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [failMsg, setFailMsg] = useState<string | null>(null);
  const abortRef = useRef(false);

  const log = (msg: string) => setLogs((l) => [...l, `${new Date().toLocaleTimeString()}  ${msg}`]);
  const setState = (id: StepId, s: StepState) => setStates((prev) => ({ ...prev, [id]: s }));

  const reset = () => {
    abortRef.current = false;
    setStates({ ...INITIAL_STATES });
    setLogs([]); setUploadPct(0); setProjectId(null); setFailMsg(null); setRunning(false);
  };

  const run = async () => {
    if (!file || !user || !session) return;
    reset(); setRunning(true);

    let pid: string | null = null;
    let mediaUrl: string | null = null;
    let mediaPath: string | null = null;

    try {
      // 1) Upload
      setState("upload", "running"); log(`Uploading ${file.name} (${(file.size/1024/1024).toFixed(1)} MB) to temporary storage`);
      const path = `${user.id}/smoke-${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      await uploadWithProgress(`${supabaseUrl}/storage/v1/object/media/${path}`, session.access_token, file, setUploadPct);
      mediaPath = path;
      log("Upload complete"); setState("upload", "ok");

      // 2) Create project
      setState("create", "running"); log("Creating project row");
      const { data: proj, error: pErr } = await supabase.from("projects").insert({
        user_id: user.id, title: `Smoke test · ${new Date().toLocaleString()}`,
        source_language: "en", provider: "assemblyai", compare_mode: false,
        media_path: path, status: "processing",
      }).select("id").single();
      if (pErr) throw new Error(`Create failed: ${pErr.message}`);
      pid = proj.id; setProjectId(pid);
      log(`Project ${pid.slice(0, 8)}… ready`); setState("create", "ok");

      // 3) Transcribe (invoke + poll)
      setState("transcribe", "running"); log("Invoking transcribe edge function");
      const { error: tErr } = await invokeWithRetry("transcribe", { body: { project_id: pid } });
      if (tErr) throw new Error(`transcribe invoke failed: ${tErr.message}`);
      log("Polling captions…");
      const deadline = Date.now() + 4 * 60 * 1000;
      let segs: any[] = []; let lastStatus = "";
      while (Date.now() < deadline) {
        if (abortRef.current) throw new Error("aborted");
        await sleep(2500);
        const [{ data: p }, { data: caps }] = await Promise.all([
          supabase.from("projects").select("status,error_message").eq("id", pid).maybeSingle(),
          supabase.from("captions").select("segments").eq("project_id", pid).maybeSingle(),
        ]);
        if (p?.status && p.status !== lastStatus) { log(`status → ${p.status}`); lastStatus = p.status; }
        if (p?.status === "failed") throw new Error(p.error_message || "Transcription failed");
        const s = (caps?.segments as any[]) ?? [];
        if (s.length && (p?.status === "ready" || p?.status === "processing")) { segs = s; break; }
      }
      if (!segs.length) throw new Error("No captions produced within timeout");
      log(`Received ${segs.length} segments`); setState("transcribe", "ok");

      // 4) Load editor preview (signed URL + probe)
      setState("editor", "running"); log("Warming caption editor");
      const signed = await supabase.storage.from("media").createSignedUrl(path, 3600);
      mediaUrl = signed.data?.signedUrl ?? null;
      if (!mediaUrl) throw new Error("Signed media URL unavailable");
      const probe = document.createElement("video");
      probe.preload = "metadata"; probe.muted = true; probe.src = mediaUrl;
      await new Promise<void>((resolve) => {
        const done = () => { probe.removeAttribute("src"); try { probe.load(); } catch {} resolve(); };
        probe.onloadedmetadata = done;
        probe.onerror = done;
        window.setTimeout(done, 4000);
      });
      log(`Editor ready · ${probe.videoWidth || "?"}×${probe.videoHeight || "?"}`); setState("editor", "ok");

      // 5) Apply template
      setState("template", "running");
      const preset = CAP_PRESETS.find((p) => /hormozi/i.test(p.name)) ?? CAP_PRESETS[0];
      const capStyle = normalizeCapStyle({ ...DEFAULT_CAP_STYLE, ...preset.patch });
      log(`Applied template “${preset.name}”`); setState("template", "ok");
      await sleep(200);

      // 6) Export 1080p
      setState("export", "running"); log("Exporting 1080p…");
      const ok = await runQuickExport({
        mediaUrl, segs, capStyle, title: `smoke-${pid.slice(0, 8)}`, resolution: "1080p",
      });
      if (!ok) throw new Error("Export was cancelled or precondition failed");
      log("Export downloaded"); setState("export", "ok");

      // 7) Cleanup temp files
      if (autoCleanup) {
        setState("cleanup", "running"); log("Removing temporary project and media");
        try { await supabase.from("projects").delete().eq("id", pid); } catch (e: any) { log(`cleanup: project delete warned: ${e.message}`); }
        try { await supabase.storage.from("media").remove([path]); } catch (e: any) { log(`cleanup: storage remove warned: ${e.message}`); }
        log("Temp files removed"); setState("cleanup", "ok");
      } else {
        setState("cleanup", "skipped"); log("Cleanup skipped — project kept");
      }

      toast.success("Smoke test passed end-to-end");

    } catch (e: any) {
      const msg = e?.message ?? String(e);
      log(`✗ ${msg}`);
      setFailMsg(msg);
      setStates((prev) => {
        const next = { ...prev };
        (Object.keys(next) as StepId[]).forEach((k) => { if (next[k] === "running") next[k] = "fail"; });
        return next;
      });
      toast.error(msg);
    } finally {
      setRunning(false);
    }
  };

  const cancel = () => { abortRef.current = true; };

  const totalOk = useMemo(() => Object.values(states).filter((s) => s === "ok" || s === "skipped").length, [states]);

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-4xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Guided smoke test</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Uploads a temporary clip and auto-runs transcription, editor warm-up, styling, and 1080p export. Best with a clip under 60 seconds.
            </p>
          </div>
          <div className="rounded-full border border-border bg-card/50 px-3 py-1 text-xs text-muted-foreground">
            {totalOk}/{STEPS.length} steps passed
          </div>
        </div>

        {/* Uploader */}
        <label className={`mt-6 flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-dashed p-5 transition-colors ${
          file ? "border-primary/50 bg-primary/5" : "border-border bg-card/40 hover:border-primary/40"}`}>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary/70"><UploadCloud className="h-5 w-5 text-primary" /></div>
            <div>
              <div className="text-sm font-medium">{file ? file.name : "Choose a short clip"}</div>
              <div className="text-xs text-muted-foreground">
                {file ? `${(file.size/1024/1024).toFixed(1)} MB · ${file.type || "media"}` : "MP4, MOV, or audio · under ~60s recommended"}
              </div>
            </div>
          </div>
          <input type="file" accept="video/*,audio/*" className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)} disabled={running} />
          <span className="rounded-lg border border-border bg-background/60 px-3 py-1.5 text-xs font-semibold">
            {file ? "Change" : "Browse"}
          </span>
        </label>

        {/* Actions */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={run}
            disabled={!file || running || !user}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
            {running ? "Running smoke test…" : "Start smoke test"}
          </button>
          {running && (
            <button onClick={cancel} className="rounded-lg border border-border bg-card/60 px-3 py-2 text-xs font-semibold hover:border-destructive/50">
              Cancel
            </button>
          )}
          {!running && (states.export === "ok" || failMsg) && (
            <button onClick={reset} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/60 px-3 py-2 text-xs font-semibold">
              <RefreshCw className="h-3.5 w-3.5" /> Reset
            </button>
          )}
          <label className="inline-flex items-center gap-2 rounded-lg border border-border bg-card/40 px-3 py-2 text-xs font-semibold">
            <input type="checkbox" checked={autoCleanup} onChange={(e) => setAutoCleanup(e.target.checked)} disabled={running}
              className="h-3.5 w-3.5 accent-primary" />
            Auto-delete temp files after test
          </label>
          {projectId && !autoCleanup && (
            <Link to={`/dashboard/project/${projectId}`} className="ml-auto text-xs font-semibold text-primary hover:underline">
              Open project →
            </Link>
          )}
        </div>

        {/* Checkpoints */}
        <ol className="mt-6 space-y-2">
          {STEPS.map((s, i) => {
            const state = states[s.id];
            const Icon = s.icon;
            const dot =
              state === "ok"      ? <CheckCircle2 className="h-5 w-5 text-primary" /> :
              state === "running" ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> :
              state === "fail"    ? <AlertCircle className="h-5 w-5 text-destructive" /> :
              state === "skipped" ? <Circle className="h-5 w-5 text-muted-foreground/40" /> :
                                    <Circle className="h-5 w-5 text-muted-foreground/60" />;
            return (
              <li key={s.id}
                className={`flex items-start gap-3 rounded-xl border p-4 transition-colors ${
                  state === "running" ? "border-primary/40 bg-primary/5" :
                  state === "ok"      ? "border-border bg-card/40" :
                  state === "fail"    ? "border-destructive/40 bg-destructive/10" :
                                        "border-border bg-card/30"
                }`}>
                <div className="mt-0.5">{dot}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">{s.title}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{s.hint}</p>
                  {s.id === "upload" && state === "running" && (
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                      <div className="h-full bg-primary transition-[width]" style={{ width: `${uploadPct}%` }} />
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        {/* Log */}
        {logs.length > 0 && (
          <div className="mt-6 rounded-xl border border-border bg-black/40 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Run log</span>
              {failMsg && <span className="text-xs text-destructive">{failMsg}</span>}
            </div>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-muted-foreground">
{logs.join("\n")}
            </pre>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default SmokeTest;
