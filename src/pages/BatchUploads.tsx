import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  UploadCloud, CheckCircle2, Loader2, AlertCircle, X, Ban, FileVideo,
  Play, Trash2, ExternalLink, RefreshCw,
} from "lucide-react";
import { LanguagePicker } from "@/components/LanguagePicker";
import { isIndianLanguage, langName } from "@/lib/languages";
import { invokeWithRetry } from "@/lib/invokeWithRetry";

type ItemStatus =
  | "queued"
  | "uploading"
  | "creating"
  | "queueing"
  | "processing"
  | "ready"
  | "failed"
  | "cancelled";

type Item = {
  id: string;                // local id
  file: File;
  status: ItemStatus;
  progress: number;          // 0-100
  projectId?: string;
  errorMessage?: string;
  serverStatus?: string;     // status from projects row
};

const MAX_BYTES = 200 * 1024 * 1024;
const MAX_PARALLEL = 2;

const STATUS_LABEL: Record<ItemStatus, string> = {
  queued: "Queued",
  uploading: "Uploading",
  creating: "Creating project",
  queueing: "Queuing",
  processing: "Transcribing",
  ready: "Ready",
  failed: "Failed",
  cancelled: "Cancelled",
};

const STATUS_TONE: Record<ItemStatus, string> = {
  queued: "text-muted-foreground border-border bg-card/40",
  uploading: "text-foreground border-primary/40 bg-primary/5",
  creating: "text-foreground border-primary/40 bg-primary/5",
  queueing: "text-foreground border-primary/40 bg-primary/5",
  processing: "text-foreground border-primary/40 bg-primary/5",
  ready: "text-primary border-primary/50 bg-primary/10",
  failed: "text-destructive border-destructive/40 bg-destructive/10",
  cancelled: "text-muted-foreground border-border bg-card/40",
};

const uploadWithProgress = (
  url: string,
  token: string,
  file: File,
  onProgress: (pct: number) => void,
  onXhr?: (xhr: XMLHttpRequest) => void,
) =>
  new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    onXhr?.(xhr);
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(xhr.responseText || `Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => reject(Object.assign(new Error("Upload cancelled"), { cancelled: true }));
    xhr.send(file);
  });

const BatchUploads = () => {
  const { user, session } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [sourceLang, setSourceLang] = useState("hi");
  const [targets, setTargets] = useState<string[]>([]);
  const [provider, setProvider] = useState("auto");
  const [running, setRunning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // Per-item cancel refs
  const xhrRefs = useRef<Map<string, XMLHttpRequest>>(new Map());
  const cancelledRef = useRef<Set<string>>(new Set());
  const uploadedPathRefs = useRef<Map<string, string>>(new Map());
  const createdIdRefs = useRef<Map<string, string>>(new Map());

  const stats = useMemo(() => {
    const total = items.length;
    const ready = items.filter((i) => i.status === "ready").length;
    const failed = items.filter((i) => i.status === "failed").length;
    const active = items.filter((i) =>
      ["uploading", "creating", "queueing", "processing"].includes(i.status),
    ).length;
    return { total, ready, failed, active };
  }, [items]);

  const patch = (id: string, next: Partial<Item>) =>
    setItems((list) => list.map((it) => (it.id === id ? { ...it, ...next } : it)));

  const addFiles = (files: FileList | File[]) => {
    const arr = Array.from(files);
    const accepted: Item[] = [];
    for (const f of arr) {
      if (!/^audio\/|^video\//.test(f.type)) {
        toast.error(`${f.name}: unsupported file type`);
        continue;
      }
      if (f.size > MAX_BYTES) {
        toast.error(`${f.name}: exceeds 200 MB`);
        continue;
      }
      accepted.push({
        id: crypto.randomUUID(),
        file: f,
        status: "queued",
        progress: 0,
      });
    }
    if (accepted.length) setItems((list) => [...list, ...accepted]);
  };

  const removeItem = (id: string) => {
    if (running) {
      const it = items.find((x) => x.id === id);
      if (it && ["uploading", "creating", "queueing", "processing"].includes(it.status)) {
        cancelOne(id);
        return;
      }
    }
    setItems((list) => list.filter((x) => x.id !== id));
  };

  const cancelOne = async (id: string) => {
    cancelledRef.current.add(id);
    try { xhrRefs.current.get(id)?.abort(); } catch {}
    const projectId = createdIdRefs.current.get(id);
    const path = uploadedPathRefs.current.get(id);
    try { if (projectId) await supabase.from("projects").delete().eq("id", projectId); } catch {}
    try { if (path) await supabase.storage.from("media").remove([path]); } catch {}
    patch(id, { status: "cancelled" });
  };

  const processOne = async (item: Item) => {
    if (!user || !session) return;
    const id = item.id;
    if (cancelledRef.current.has(id)) return;

    try {
      patch(id, { status: "uploading", progress: 0, errorMessage: undefined });

      const path = `${user.id}/${crypto.randomUUID()}-${item.file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      await uploadWithProgress(
        `${supabaseUrl}/storage/v1/object/media/${path}`,
        session.access_token,
        item.file,
        (pct) => patch(id, { progress: pct }),
        (xhr) => { xhrRefs.current.set(id, xhr); },
      );
      uploadedPathRefs.current.set(id, path);
      if (cancelledRef.current.has(id)) return;

      patch(id, { status: "creating", progress: 100 });
      const title = item.file.name.replace(/\.[^.]+$/, "").slice(0, 120) || "Untitled";
      const resolvedProvider = provider === "auto"
        ? (isIndianLanguage(sourceLang) ? "sarvam" : "deepgram")
        : provider;

      const { data: proj, error: pErr } = await supabase.from("projects").insert({
        user_id: user.id,
        title,
        source_language: sourceLang,
        provider: resolvedProvider,
        compare_mode: false,
        media_path: path,
        status: "processing",
      }).select("id").single();
      if (pErr) throw pErr;
      createdIdRefs.current.set(id, proj.id);
      patch(id, { projectId: proj.id });

      const pending = targets.filter((t) => t !== sourceLang);
      if (pending.length) {
        try { localStorage.setItem(`targets:${proj.id}`, JSON.stringify(pending)); } catch {}
      }

      if (cancelledRef.current.has(id)) return;
      patch(id, { status: "queueing" });
      await invokeWithRetry("transcribe", { body: { project_id: proj.id, provider: resolvedProvider } }).catch(() => {});

      patch(id, { status: "processing" });
    } catch (err: any) {
      if (cancelledRef.current.has(id) || err?.cancelled) return;
      patch(id, { status: "failed", errorMessage: err?.message ?? "Failed" });
    } finally {
      xhrRefs.current.delete(id);
    }
  };

  const startBatch = async () => {
    if (!user || !session) {
      toast.error("Please sign in first");
      return;
    }
    const pending = items.filter((i) => i.status === "queued" || i.status === "failed" || i.status === "cancelled");
    if (!pending.length) {
      toast.message("Nothing to process");
      return;
    }
    // Reset any failed/cancelled to queued state
    setItems((list) =>
      list.map((it) =>
        pending.find((p) => p.id === it.id)
          ? { ...it, status: "queued", progress: 0, errorMessage: undefined }
          : it,
      ),
    );
    for (const p of pending) cancelledRef.current.delete(p.id);

    setRunning(true);

    const queue = [...pending];
    const workers = Array.from({ length: Math.min(MAX_PARALLEL, queue.length) }, async () => {
      while (queue.length) {
        const next = queue.shift();
        if (!next) break;
        await processOne(next);
      }
    });
    await Promise.all(workers);
    setRunning(false);
    toast.success("Batch uploaded — processing continues on the server");
  };

  const clearFinished = () => {
    setItems((list) => list.filter((i) => !["ready", "cancelled"].includes(i.status)));
  };

  // Poll server-side status for projects that are processing
  useEffect(() => {
    const active = items.filter((i) => i.projectId && (i.status === "processing" || i.status === "queueing"));
    if (!active.length) return;
    const ids = active.map((i) => i.projectId!);
    let stopped = false;

    const tick = async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id,status,error_message")
        .in("id", ids);
      if (stopped || error || !data) return;
      setItems((list) =>
        list.map((it) => {
          if (!it.projectId) return it;
          const row = data.find((r: any) => r.id === it.projectId);
          if (!row) return it;
          if (row.status === "ready") return { ...it, status: "ready", serverStatus: row.status };
          if (row.status === "failed") return { ...it, status: "failed", errorMessage: row.error_message ?? "Transcription failed", serverStatus: row.status };
          return { ...it, serverStatus: row.status };
        }),
      );
    };

    tick();
    const iv = setInterval(tick, 4000);
    return () => { stopped = true; clearInterval(iv); };
  }, [items]);

  const targetChips = targets.filter((t) => t !== sourceLang);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">Batch uploads</h1>
            <p className="mt-1 text-muted-foreground">
              Queue multiple audio/video files and process captions in bulk. Up to {MAX_PARALLEL} run in parallel.
            </p>
          </div>
          {items.length > 0 && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span><b className="text-foreground">{stats.total}</b> total</span>
              <span className="text-primary"><b>{stats.ready}</b> ready</span>
              {stats.active > 0 && <span><b className="text-foreground">{stats.active}</b> active</span>}
              {stats.failed > 0 && <span className="text-destructive"><b>{stats.failed}</b> failed</span>}
            </div>
          )}
        </header>

        {/* Settings */}
        <section className="grid gap-5 rounded-2xl border border-border bg-card/50 p-5 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Source language</label>
            <LanguagePicker value={sourceLang} onChange={setSourceLang} placeholder="Select language" />
            <p className="mt-1.5 text-xs text-muted-foreground">Applied to every file in this batch.</p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">AI provider</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              disabled={running}
              className="w-full rounded-lg border border-border bg-input/60 px-3.5 py-2.5 text-sm disabled:opacity-60"
            >
              <option value="auto">Auto-select (Sarvam AI for Indian, Deepgram for Foreign)</option>
              <option value="sarvam">Sarvam AI (Indian Languages & Vernaculars)</option>
              <option value="deepgram">Deepgram Nova-3 (Foreign & Multilingual)</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <div className="mb-1.5 flex items-center justify-between">
              <label className="block text-sm font-medium">Translate captions into</label>
              {targetChips.length > 0 && (
                <button
                  type="button"
                  disabled={running}
                  onClick={() => setTargets([])}
                  className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-60"
                >
                  Clear
                </button>
              )}
            </div>
            <LanguagePicker
              multi
              value={targetChips}
              onChange={(codes) => setTargets(codes)}
              placeholder="Search and pick target languages…"
            />
            {targetChips.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {targetChips.map((c) => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-[11px] text-foreground"
                  >
                    {langName(c)}
                    <button
                      type="button"
                      disabled={running}
                      onClick={() => setTargets((t) => t.filter((x) => x !== c))}
                      className="opacity-60 hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="mt-1.5 text-xs text-muted-foreground">
              Optional — every project in this batch will auto-translate into these languages once transcription is ready.
            </p>
          </div>
        </section>

        {/* Dropzone */}
        <section>
          <label
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
            }}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed p-10 text-center transition-colors ${
              dragOver ? "border-primary bg-primary/5" : "border-border bg-card/40 hover:border-primary/50"
            }`}
          >
            <UploadCloud className="mb-2 h-7 w-7 text-primary" />
            <span className="text-sm font-medium">Drop files or click to select</span>
            <span className="mt-1 text-xs text-muted-foreground">
              Audio or video, up to 200 MB each. Add as many as you like.
            </span>
            <input
              ref={inputRef}
              type="file"
              accept="audio/*,video/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) addFiles(e.target.files);
                if (inputRef.current) inputRef.current.value = "";
              }}
            />
          </label>
        </section>

        {/* Actions bar */}
        {items.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              {items.filter((i) => i.status === "queued").length} queued ·{" "}
              {items.filter((i) => i.status !== "queued" && i.status !== "ready" && i.status !== "failed" && i.status !== "cancelled").length} in progress
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearFinished}
                disabled={running || !items.some((i) => ["ready", "cancelled"].includes(i.status))}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                Clear finished
              </button>
              <button
                type="button"
                onClick={startBatch}
                disabled={running || !items.some((i) => ["queued", "failed", "cancelled"].includes(i.status))}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {running ? "Processing…" : "Start batch"}
              </button>
            </div>
          </div>
        )}

        {/* Items list */}
        {items.length > 0 && (
          <section className="overflow-hidden rounded-2xl border border-border bg-card/40">
            <ul className="divide-y divide-border">
              {items.map((it) => (
                <li key={it.id} className="flex items-center gap-4 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileVideo className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{it.file.name}</p>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {(it.file.size / (1024 * 1024)).toFixed(1)} MB
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_TONE[it.status]}`}
                      >
                        {it.status === "ready" ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : it.status === "failed" ? (
                          <AlertCircle className="h-3 w-3" />
                        ) : it.status === "cancelled" ? (
                          <Ban className="h-3 w-3" />
                        ) : it.status === "queued" ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
                        ) : (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        )}
                        {STATUS_LABEL[it.status]}
                        {it.status === "uploading" && <span>· {it.progress}%</span>}
                      </span>
                      {it.errorMessage && (
                        <span className="truncate text-[11px] text-destructive/80">{it.errorMessage}</span>
                      )}
                    </div>
                    {(it.status === "uploading" ||
                      it.status === "creating" ||
                      it.status === "queueing" ||
                      it.status === "processing") && (
                      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-border">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{
                            width:
                              it.status === "uploading"
                                ? `${Math.max(4, it.progress)}%`
                                : it.status === "creating"
                                ? "80%"
                                : it.status === "queueing"
                                ? "92%"
                                : "97%",
                          }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {it.status === "ready" && it.projectId && (
                      <Link
                        to={`/dashboard/project/${it.projectId}`}
                        className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20"
                      >
                        Open <ExternalLink className="h-3 w-3" />
                      </Link>
                    )}
                    {it.status === "processing" && it.projectId && (
                      <Link
                        to={`/dashboard/project/${it.projectId}`}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                      >
                        View
                      </Link>
                    )}
                    {(it.status === "failed" || it.status === "cancelled") && (
                      <button
                        type="button"
                        onClick={() => patch(it.id, { status: "queued", progress: 0, errorMessage: undefined })}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                        title="Retry"
                      >
                        <RefreshCw className="h-3 w-3" /> Retry
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeItem(it.id)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title={
                        ["uploading", "creating", "queueing", "processing"].includes(it.status)
                          ? "Cancel"
                          : "Remove"
                      }
                    >
                      {["uploading", "creating", "queueing", "processing"].includes(it.status) ? (
                        <Ban className="h-4 w-4" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {items.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border bg-card/30 p-8 text-center text-sm text-muted-foreground">
            No files added yet — drop some in above to get started.
          </p>
        )}
      </div>
    </DashboardLayout>
  );
};

export default BatchUploads;
