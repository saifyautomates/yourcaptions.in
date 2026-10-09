// "Prepare Your Media" upload flow — studio-grade video processing.
// Stage 1: Uploading overlay (progress %, "Did you know" card).
// Stage 2: Language Settings modal (spoken language + writing script + Translation + Audio Enhancement + Emojis).
// Stage 3: Redirects into the editor which shows the "Generating subtitles" state.

import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { usePlanInfo } from "@/hooks/usePlanInfo";
import { getPlanCapabilities } from "@/lib/plans";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, Volume2, Smile, Sparkles, Languages, Crown, Play, ChevronDown, Lock } from "lucide-react";
import { LanguagePicker } from "@/components/LanguagePicker";
import { isIndianLanguage, langName } from "@/lib/languages";
import { invokeWithRetry } from "@/lib/invokeWithRetry";

type Stage = "picking" | "uploading" | "prepare" | "queueing";

// Uploader with real byte-level progress.
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
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(xhr.responseText || `Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => reject(Object.assign(new Error("Upload cancelled"), { cancelled: true }));
    xhr.send(file);
  });

const SCRIPTS = [
  { code: "auto", label: "Auto-detect" },
  { code: "latin", label: "Roman / Latin" },
  { code: "devanagari", label: "Devanagari (Hindi/Marathi)" },
  { code: "arabic", label: "Arabic / Urdu" },
  { code: "bengali", label: "Bengali" },
  { code: "gurmukhi", label: "Gurmukhi (Punjabi)" },
  { code: "tamil", label: "Tamil" },
  { code: "telugu", label: "Telugu" },
  { code: "kannada", label: "Kannada" },
  { code: "malayalam", label: "Malayalam" },
  { code: "gujarati", label: "Gujarati" },
  { code: "oriya", label: "Odia" },
  { code: "cjk", label: "Chinese / Japanese / Korean" },
  { code: "cyrillic", label: "Cyrillic" },
];

const NewProject = () => {
  const { user, session } = useAuth();
  const { planId } = usePlanInfo();
  const caps = getPlanCapabilities(planId);
  const navigate = useNavigate();

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("picking");
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);

  const [lang, setLang] = useState("");
  const [script, setScript] = useState("auto");
  const [translation, setTranslation] = useState(false);
  const [audioClean, setAudioClean] = useState(false);
  const [emojis, setEmojis] = useState(false);

  const [selectedTemplate] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("applyTemplate");
    if (fromUrl) {
      localStorage.setItem("captions:appliedTemplate", fromUrl);
      return fromUrl;
    }
    return localStorage.getItem("captions:appliedTemplate");
  });

  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const cancelledRef = useRef(false);

  // Pick up a file dropped from the Dashboard.
  useEffect(() => {
    const pending = (window as any).__pendingUpload as File | undefined;
    if (pending) {
      (window as any).__pendingUpload = undefined;
      pickFile(pending);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!file) { setPreviewUrl(null); return; }
    const u = URL.createObjectURL(file);
    setPreviewUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const pickFile = async (f: File) => {
    if (!user || !session) { toast.error("Please sign in first"); return; }
    const maxBytes = caps.maxUploadBytes || 250 * 1024 * 1024;
    if (f.size > maxBytes) {
      const maxFormatted = maxBytes >= 1024 * 1024 * 1024
        ? `${Math.round(maxBytes / (1024 * 1024 * 1024))} GB`
        : `${Math.round(maxBytes / (1024 * 1024))} MB`;
      toast.error("File exceeds plan upload limit", {
        description: `Your ${planId.toUpperCase()} plan allows uploads up to ${maxFormatted}. Upgrade for larger files.`,
      });
      return;
    }
    setFile(f);
    setStage("uploading");
    setUploadPct(0);
    cancelledRef.current = false;

    try {
      const path = `${user.id}/${crypto.randomUUID()}-${f.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      await uploadWithProgress(
        `${supabaseUrl}/storage/v1/object/media/${path}`,
        session.access_token,
        f,
        setUploadPct,
        (xhr) => { xhrRef.current = xhr; },
      );
      if (cancelledRef.current) return;
      setUploadedPath(path);
      setStage("prepare");
    } catch (err: any) {
      if (cancelledRef.current || err?.cancelled) return;
      toast.error(err?.message ?? "Upload failed");
      setStage("picking");
    }
  };

  const cancel = async () => {
    cancelledRef.current = true;
    try { xhrRef.current?.abort(); } catch { /* noop */ }
    if (uploadedPath) { try { await supabase.storage.from("media").remove([uploadedPath]); } catch { /* noop */ } }
    setStage("picking");
    setFile(null);
    setUploadPct(0);
    setUploadedPath(null);
    navigate("/dashboard");
  };

  const startProcessing = async () => {
    if (!user || !file || !uploadedPath || !lang) return;
    setStage("queueing");
    try {
      // Sarvam AI for Indian languages, Deepgram for foreign languages
      const chosenProvider = isIndianLanguage(lang) ? "sarvam" : "deepgram";

      const { data: proj, error: pErr } = await supabase.from("projects").insert({
        user_id: user.id,
        title: file.name.replace(/\.[^.]+$/, ""),
        source_language: lang,
        provider: chosenProvider,
        media_path: uploadedPath,
        status: "processing",
      }).select("id").single();
      if (pErr) throw pErr;

      // Persist Prepare Your Media settings so the editor can honour them.
      try {
        localStorage.setItem(`prepare:${proj.id}`, JSON.stringify({ script, translation, audioClean, emojis }));
      } catch { /* noop */ }

      invokeWithRetry("transcribe", {
        body: {
          project_id: proj.id,
          provider: chosenProvider,
          script,
          translate_to_english: translation,
          audio_enhancement: audioClean,
          add_emojis: emojis,
        },
      }).catch(async (err: any) => {
        const msg = err?.context?.text ? await err.context.text().catch(() => err?.message) : (err?.message ?? "Transcription failed to start");
        console.error("[NewProject] transcribe invoke failed:", msg);
        toast.error("Transcription failed to start", { description: String(msg).slice(0, 240) });
        try { await supabase.from("projects").update({ status: "failed" }).eq("id", proj.id); } catch { /* noop */ }
      });
      toast.success("Transcription started");
      navigate(`/dashboard/project/${proj.id}`);

    } catch (err: any) {
      toast.error(err?.message ?? "Failed to start");
      setStage("prepare");
    }
  };

  /* ---------- Empty state (rare — user hit /dashboard/new directly) ---------- */
  if (stage === "picking") {
    const limitLabel = caps.maxUploadBytes >= 1024 * 1024 * 1024
      ? `${Math.round(caps.maxUploadBytes / (1024 * 1024 * 1024))} GB`
      : `${Math.round(caps.maxUploadBytes / (1024 * 1024))} MB`;

    return (
      <DashboardLayout>
        <div className="mx-auto max-w-xl">
          {selectedTemplate && (
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Style Pre-selected: <strong>"{selectedTemplate}"</strong></span>
            </div>
          )}
          <h1 className="text-2xl font-semibold">Upload a video</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pick a video file to caption.</p>
          <label className="mt-6 grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-border/60 bg-card/40 p-12 text-center hover:border-primary/40">
            <span className="text-sm">Click to select MP4 or MOV (up to {limitLabel})</span>
            <input type="file" accept="video/*,audio/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f); }} />
          </label>
        </div>
      </DashboardLayout>
    );
  }

  /* ---------- Uploading overlay ---------- */
  if (stage === "uploading") {
    return (
      <DashboardLayout>
        <BackdropModal title="Uploading..." subtitle="Uploading your media. Hang tight, this may take a moment." onClose={cancel}>
          <div className="mt-8 grid place-items-center">
            <MosqueSvg />
          </div>

          <div className="mt-8">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Uploading</span>
              <span className="font-semibold">{uploadPct}%</span>
              <span className="text-muted-foreground">0%</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary/60">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${uploadPct}%` }} />
            </div>
          </div>

          <p className="mt-6 text-center text-lg font-semibold">Uploading your video</p>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            This may take a minute, <span className="text-primary">Hang tight!</span>
          </p>

          <DidYouKnow />
        </BackdropModal>
      </DashboardLayout>
    );
  }

  /* ---------- Prepare Your Media ---------- */
  return (
    <DashboardLayout>
      <BackdropModal title="Prepare Your Media" subtitle="Select a language to transcribe your media." onClose={cancel}>
        {selectedTemplate && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Preset: <strong>"{selectedTemplate}"</strong> (will be auto-applied in editor)</span>
          </div>
        )}
        {/* Video preview */}
        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-black">
          <div className="relative aspect-video">
            {previewUrl ? (
              <video src={previewUrl} className="h-full w-full object-cover" playsInline muted controls={false} />
            ) : (
              <div className="absolute inset-0 bg-secondary/40" />
            )}
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-background/60 backdrop-blur">
                <Play className="h-5 w-5 translate-x-[1px] fill-foreground text-foreground" />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center gap-1.5 py-1.5 text-[11px] text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Ready for processing
          </div>
        </div>

        {/* Language settings */}
        <div className="mt-6 flex items-center gap-3">
          <div className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-primary/15 text-primary">
            <Languages className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">Language Settings</p>
            <p className="text-xs text-muted-foreground">Configure the source language and writing system</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Volume2 className="h-3.5 w-3.5" /> What language is spoken?
            </label>
            <LanguagePicker value={lang} onChange={setLang} placeholder="Choose spoken language" />
          </div>
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" /> Writing system used?
            </label>
            <div className="relative">
              <select
                value={script}
                onChange={(e) => setScript(e.target.value)}
                className="w-full appearance-none rounded-lg border border-border bg-input/40 px-3 py-2.5 pr-9 text-sm outline-none focus:border-primary"
              >
                {SCRIPTS.map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
        </div>

        {/* Feature toggles */}
        <div className="mt-5 space-y-2.5">
          <FeatureCard
            icon={<Sparkles className="h-4 w-4" />}
            iconWrap="bg-primary/15 text-primary"
            title="Translation"
            subtitle="Automatically translate captions to English"
            right={
              !caps.canTranslate ? (
                <Link to="/pricing" className="inline-flex items-center gap-1.5 rounded-full bg-secondary/80 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                  <Lock className="h-3 w-3" /> Upgrade
                </Link>
              ) : undefined
            }
            checked={caps.canTranslate && translation}
            onChange={(v) => {
              if (!caps.canTranslate) return;
              setTranslation(v);
            }}
          />
          <FeatureCard
            icon={<Volume2 className="h-4 w-4" />}
            iconWrap="bg-primary/15 text-primary"
            title="Audio Enhancement"
            subtitle="Clean up audio quality for better transcription accuracy"
            checked={audioClean}
            onChange={setAudioClean}
          />
          <FeatureCard
            icon={<Smile className="h-4 w-4" />}
            iconWrap="bg-primary/15 text-primary"
            title="Emojis"
            subtitle="Add engaging emojis to your captions automatically"
            checked={emojis}
            onChange={setEmojis}
          />
        </div>

        {/* Optional target languages */}
        {lang && (
          <div className="mt-5 rounded-xl border border-border bg-card/40 p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Detected · {langName(lang)}</p>
          </div>
        )}

        <button
          type="button"
          disabled={!lang || stage === "queueing"}
          onClick={startProcessing}
          className="mt-6 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-50"
        >
          {stage === "queueing" ? "Starting…" : "Start Processing"}
        </button>
      </BackdropModal>
    </DashboardLayout>
  );
};

/* ============ subcomponents ============ */

const BackdropModal = ({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) => (
  <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm">
    <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-secondary/60 hover:text-foreground" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const FeatureCard = ({
  icon,
  iconWrap,
  title,
  subtitle,
  right,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  iconWrap: string;
  title: string;
  subtitle: string;
  right?: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
}) => (
  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card/50 px-3.5 py-3 transition-colors hover:border-primary/40">
    <div className={`grid h-9 w-9 flex-none place-items-center rounded-lg ${iconWrap}`}>{icon}</div>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
    </div>
    {right ?? (
      <span className={`relative inline-block h-5 w-9 flex-none rounded-full transition-colors ${checked ? "bg-primary" : "bg-secondary/70"}`}>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-background transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
      </span>
    )}
  </label>
);

const MosqueSvg = () => (
  <div className="relative">
    <div className="absolute inset-0 grid place-items-center">
      <div className="h-32 w-32 rounded-full bg-primary/15 blur-2xl" />
    </div>
    <svg viewBox="0 0 100 100" className="relative h-28 w-28 text-primary">
      <path d="M50 15 L52 22 L48 22 Z" fill="currentColor" />
      <path
        d="M20 70 Q20 55 30 55 Q30 40 40 40 Q40 30 50 28 Q60 30 60 40 Q70 40 70 55 Q80 55 80 70 L80 80 L20 80 Z"
        fill="none" stroke="currentColor" strokeWidth="1.4"
      />
      <path d="M45 80 L45 65 Q50 60 55 65 L55 80" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
    {/* Decorative dots */}
    <span className="absolute -top-2 right-2 h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
    <span className="absolute -left-4 top-6 h-1 w-1 rounded-full bg-muted-foreground/40" />
    <span className="absolute -bottom-1 -right-6 h-2 w-2 rotate-45 border border-muted-foreground/40" />
  </div>
);

const DidYouKnow = () => (
  <div className="mt-8 rounded-xl border border-border bg-card/60 p-4">
    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">
      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
      Did you know?
    </div>
    <p className="mt-2 text-center text-sm text-foreground/90">
      Yourcaptions.in is the most accurate captioning tool for South Asian languages.
    </p>
  </div>
);

export default NewProject;
