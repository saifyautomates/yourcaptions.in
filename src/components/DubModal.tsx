import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mic, X, Download, Loader2, Play, Pause, Wand2 } from "lucide-react";
import { detectRateLimit } from "@/lib/rateLimit";
import { invokeWithRetry } from "@/lib/invokeWithRetry";
import { useJob, useActiveJobs } from "@/hooks/useJob";
import { LanguagePicker } from "@/components/LanguagePicker";
import { langName } from "@/lib/languages";
import { useCredits } from "@/hooks/useCredits";
import UpgradeCTA from "@/components/UpgradeCTA";

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectTitle: string;
  languages: [string, string][];       // full LANG list
  availableLangs: string[];            // langs already translated
  onTranslate: (target: string) => Promise<void> | void;
  translating: boolean;
}

type Provider = "openai" | "elevenlabs";

const OPENAI_VOICES: { id: string; label: string; hint: string }[] = [
  { id: "alloy",   label: "Alloy",   hint: "Neutral, versatile" },
  { id: "nova",    label: "Nova",    hint: "Warm female" },
  { id: "shimmer", label: "Shimmer", hint: "Bright female" },
  { id: "coral",   label: "Coral",   hint: "Expressive female" },
  { id: "sage",    label: "Sage",    hint: "Calm female" },
  { id: "fable",   label: "Fable",   hint: "British storyteller" },
  { id: "echo",    label: "Echo",    hint: "Smooth male" },
  { id: "onyx",    label: "Onyx",    hint: "Deep male" },
  { id: "ash",     label: "Ash",     hint: "Confident male" },
];

const ELEVEN_VOICES: { id: string; label: string; hint: string }[] = [
  { id: "george",   label: "George",   hint: "Warm British male" },
  { id: "brian",    label: "Brian",    hint: "Deep narrator" },
  { id: "roger",    label: "Roger",    hint: "Confident male" },
  { id: "callum",   label: "Callum",   hint: "Youthful male" },
  { id: "liam",     label: "Liam",     hint: "Articulate male" },
  { id: "charlie",  label: "Charlie",  hint: "Casual male" },
  { id: "will",     label: "Will",     hint: "Friendly male" },
  { id: "chris",    label: "Chris",    hint: "American male" },
  { id: "eric",     label: "Eric",     hint: "Smooth male" },
  { id: "daniel",   label: "Daniel",   hint: "Authoritative male" },
  { id: "bill",     label: "Bill",     hint: "Mature male" },
  { id: "sarah",    label: "Sarah",    hint: "Soft female" },
  { id: "laura",    label: "Laura",    hint: "Bright female" },
  { id: "alice",    label: "Alice",    hint: "Clear female" },
  { id: "matilda",  label: "Matilda",  hint: "Expressive female" },
  { id: "jessica",  label: "Jessica",  hint: "Modern female" },
  { id: "lily",     label: "Lily",     hint: "Playful female" },
  { id: "river",    label: "River",    hint: "Non-binary" },
];

export default function DubModal({ open, onClose, projectId, projectTitle, languages, availableLangs, onTranslate, translating }: Props) {
  const [provider, setProvider] = useState<Provider>("elevenlabs");
  const [lang, setLang] = useState<string>(availableLangs[0] ?? "en");
  const [voice, setVoice] = useState<string>("george");
  const [speed, setSpeed] = useState<number>(1);
  const [stability, setStability] = useState<number>(0.5);
  const [similarity, setSimilarity] = useState<number>(0.75);
  const [instructions, setInstructions] = useState<string>("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const VOICES = provider === "elevenlabs" ? ELEVEN_VOICES : OPENAI_VOICES;
  const { blocked: creditsBlocked } = useCredits();

  // Snap voice to a valid one when switching provider.
  useEffect(() => {
    if (!VOICES.some((v) => v.id === voice)) setVoice(VOICES[0].id);
  }, [provider, VOICES, voice]);

  // Resume any in-flight dub jobs for this project on open/reconnect.
  const { jobs: activeDubJobs } = useActiveJobs({ projectId, kind: "dub" });
  useEffect(() => {
    if (!jobId && activeDubJobs.length) setJobId(activeDubJobs[0].id);
  }, [activeDubJobs, jobId]);

  const { job } = useJob(jobId);
  const busy = starting || (!!job && (job.status === "queued" || job.status === "running"));
  const progress = job?.progress ?? 0;
  const progressMsg = job?.message ?? "";

  useEffect(() => {
    if (!job) return;
    if (job.status === "succeeded") {
      const url = (job.result as any)?.url as string | undefined;
      const segments = (job.result as any)?.segments as number | undefined;
      const stats = (job.result as any)?.speed_stats;
      const preview = (job.input as any)?.preview;
      if (url) setAudioUrl(url);
      const clampedNote = stats && (stats.clamped_hi || stats.clamped_lo) && segments
        ? ` · ${stats.clamped_hi + stats.clamped_lo}/${segments} segs hit speed limit` : "";
      toast.success(`${preview ? "Preview" : "Voiceover"} ready · ${segments ?? 0} segs${clampedNote}`);
      setJobId(null);
    } else if (job.status === "failed") {
      toast.error(job.error ?? "Dub failed");
      setJobId(null);
    }
  }, [job]);

  useEffect(() => {
    if (open && availableLangs.length && !availableLangs.includes(lang)) setLang(availableLangs[0]);
  }, [open, availableLangs, lang]);

  useEffect(() => {
    if (!open) {
      setAudioUrl(null);
      setPlaying(false);
      audioRef.current?.pause();
    }
  }, [open]);

  const availableSet = useMemo(() => new Set(availableLangs), [availableLangs]);

  if (!open) return null;

  const generate = async (preview = false) => {
    if (creditsBlocked) { toast.error("You're out of credits — upgrade your plan to dub."); return; }
    setStarting(true);
    try {
      if (!availableSet.has(lang)) {
        toast.message("Translating captions first…");
        await onTranslate(lang);
      }
      const fn = provider === "elevenlabs" ? "elevenlabs-dub" : "dub-video";
      const body: Record<string, unknown> = {
        project_id: projectId, language: lang, voice, preview,
      };
      if (provider === "elevenlabs") {
        body.stability = stability;
        body.similarity = similarity;
      } else {
        body.speed = speed;
        if (instructions.trim()) body.instructions = instructions.trim();
      }
      const { data, error } = await invokeWithRetry<{ jobId: string }>(fn, { body }, {
        onRetry: (attempt, ms) => toast.message(`Rate limited — retrying (${attempt}) in ${Math.ceil(ms / 1000)}s`),
      });
      if (error) throw error;
      if (!data?.jobId) throw new Error("Job could not be started");
      setJobId(data.jobId as string);
      setAudioUrl(null);
      toast.message(preview ? "Preview queued" : "Dub queued — you can close this and come back");
    } catch (e: any) {
      if (detectRateLimit(e, "dub-video")) return;
      toast.error(e?.message ?? "Dub failed");
    } finally {
      setStarting(false);
    }
  };


  const togglePlay = () => {
    const a = audioRef.current; if (!a) return;
    if (a.paused) { a.play(); setPlaying(true); } else { a.pause(); setPlaying(false); }
  };

  const download = () => {
    if (!audioUrl) return;
    const a = document.createElement("a");
    a.href = audioUrl;
    a.download = `${(projectTitle || "voiceover").replace(/[^\w\-]+/g, "_")}-${lang}-${voice}.mp3`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Mic className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">AI Voiceover · Dub in another language</h3>
          </div>
          <button onClick={() => !busy && onClose()} className="rounded-md p-1 text-muted-foreground hover:bg-muted disabled:opacity-40" disabled={busy}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Voice engine</p>
            <div className="inline-flex w-full rounded-lg bg-input/50 p-0.5">
              <button
                onClick={() => setProvider("elevenlabs")}
                disabled={busy}
                className={`flex-1 rounded-[6px] py-1.5 text-xs font-semibold transition ${provider === "elevenlabs" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                ElevenLabs · Studio
              </button>
              <button
                onClick={() => setProvider("openai")}
                disabled={busy}
                className={`flex-1 rounded-[6px] py-1.5 text-xs font-semibold transition ${provider === "openai" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                OpenAI · Fast
              </button>
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Language</p>
            <LanguagePicker value={lang} onChange={setLang} placeholder="Search language…" />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {availableSet.has(lang)
                ? `${langName(lang)} captions ready · voiceover will render directly.`
                : `${langName(lang)} will be translated first, then voiced.`}
            </p>
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Voice</p>
            <div className="grid max-h-56 grid-cols-3 gap-1.5 overflow-y-auto pr-1">
              {VOICES.map((v) => (
                <button key={v.id} onClick={() => setVoice(v.id)} disabled={busy}
                  className={`flex flex-col items-start rounded-lg border px-2.5 py-1.5 text-left text-xs transition ${
                    voice === v.id ? "border-primary bg-primary/10" : "border-border bg-input/30 hover:border-primary/50"
                  }`}>
                  <span className="font-semibold">{v.label}</span>
                  <span className="text-[10px] text-muted-foreground">{v.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {provider === "elevenlabs" ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Stability <span className="text-foreground">{stability.toFixed(2)}</span></p>
                <input type="range" min={0} max={1} step={0.05} value={stability} onChange={(e) => setStability(Number(e.target.value))} className="w-full accent-primary" />
                <p className="mt-1 text-[10px] text-muted-foreground">Lower = more expressive · higher = more consistent</p>
              </div>
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Similarity <span className="text-foreground">{similarity.toFixed(2)}</span></p>
                <input type="range" min={0} max={1} step={0.05} value={similarity} onChange={(e) => setSimilarity(Number(e.target.value))} className="w-full accent-primary" />
                <p className="mt-1 text-[10px] text-muted-foreground">How closely to match the original voice</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Speed <span className="text-foreground">{speed.toFixed(2)}×</span></p>
                <input type="range" min={0.7} max={1.3} step={0.05} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="w-full accent-primary" />
              </div>
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Style (optional)</p>
                <input value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="e.g. cheerful, formal news anchor"
                  className="w-full rounded-md border border-border bg-input/50 px-2.5 py-1.5 text-xs outline-none" />
              </div>
            </div>
          )}

          {audioUrl && (
            <div className="rounded-lg border border-border/60 bg-input/30 p-3">
              <audio ref={audioRef} src={audioUrl} onEnded={() => setPlaying(false)} className="hidden" />
              <div className="flex items-center gap-2">
                <button onClick={togglePlay} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground hover:opacity-90">
                  {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 pl-0.5" />}
                </button>
                <span className="text-xs text-muted-foreground">Preview generated voiceover</span>
                <button onClick={download} className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-primary/20 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/30">
                  <Download className="h-3.5 w-3.5" /> Download MP3
                </button>
              </div>
            </div>
          )}

          {busy && (
            <div className="rounded-lg border border-border/60 bg-input/30 p-3">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">{progressMsg || "Working…"}</span>
                <span className="tabular-nums text-muted-foreground">{progress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-border/60">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(2, progress)}%` }} />
              </div>
              <p className="mt-1.5 text-[10.5px] text-muted-foreground">Runs in the background — safe to close this dialog or refresh.</p>
            </div>
          )}


          {creditsBlocked && (
            <UpgradeCTA
              hint="Dubbing needs credits. Your balance is 0 — voiceover generation is paused."
              action="Dubbing"
            />
          )}
          <div className="flex gap-2">
            <button
              onClick={() => generate(true)}
              disabled={busy || translating || creditsBlocked}
              title={creditsBlocked ? "Credits reached 0 — upgrade your plan to preview dubs. After upgrading, this button unlocks instantly." : undefined}
              aria-describedby={creditsBlocked ? "dub-credit-msg" : undefined}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-input/30 px-3 py-2.5 text-sm font-semibold hover:border-primary/60 disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Preview (5 segs)
            </button>
            <button
              onClick={() => generate(false)}
              disabled={busy || translating || creditsBlocked}
              title={creditsBlocked ? "Credits reached 0 — upgrade your plan to generate dubs. After upgrading, new plan credits are added to your wallet and this button unlocks instantly." : undefined}
              aria-describedby={creditsBlocked ? "dub-credit-msg" : undefined}
              className="inline-flex flex-[2] items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-50">
              {busy || translating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {translating ? "Translating captions…" : busy ? "Generating voice…" : audioUrl ? "Regenerate full dub" : "Generate full dub"}
            </button>
          </div>
          {creditsBlocked && (
            <p id="dub-credit-msg" className="text-[10.5px] text-primary/90">
              Credits reached 0. Upgrading instantly restores dubbing and adds fresh plan credits to your wallet.
            </p>
          )}
          <p className="text-[10.5px] text-muted-foreground">
            The voiceover is synthesized from the translated captions using AI. If the target language isn't translated yet, it will be translated first.
          </p>
        </div>
      </div>
    </div>
  );
}
