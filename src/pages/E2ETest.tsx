import { useCallback, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, PlayCircle } from "lucide-react";

type Status = "idle" | "running" | "pass" | "fail";
type StepKey = "voice" | "transcribe" | "render";

interface StepState {
  status: Status;
  ms?: number;
  detail?: string;
  error?: string;
}

const DEFAULT_VIDEO =
  "https://videos.pexels.com/video-files/4114797/4114797-hd_1080_1920_25fps.mp4";

const INITIAL: Record<StepKey, StepState> = {
  voice: { status: "idle" },
  transcribe: { status: "idle" },
  render: { status: "idle" },
};

const LABEL: Record<StepKey, string> = {
  voice: "Voice change (TTS)",
  transcribe: "Transcription",
  render: "Caption rendering",
};

function StatusBadge({ s }: { s: Status }) {
  if (s === "running")
    return (
      <Badge variant="secondary" className="gap-1">
        <Loader2 className="h-3 w-3 animate-spin" /> Running
      </Badge>
    );
  if (s === "pass")
    return (
      <Badge className="gap-1 bg-green-600 hover:bg-green-600">
        <CheckCircle2 className="h-3 w-3" /> Pass
      </Badge>
    );
  if (s === "fail")
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="h-3 w-3" /> Fail
      </Badge>
    );
  return <Badge variant="outline">Idle</Badge>;
}

export default function E2ETest() {
  const [videoUrl, setVideoUrl] = useState<string>(DEFAULT_VIDEO);
  const [lang, setLang] = useState("en");
  const [voice, setVoice] = useState("nova");
  const [steps, setSteps] = useState<Record<StepKey, StepState>>(INITIAL);
  const [running, setRunning] = useState(false);
  const [words, setWords] = useState<Array<{ text: string; start: number; end: number }>>([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [audioSrc, setAudioSrc] = useState<string | undefined>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number | null>(null);

  const overall: Status = useMemo(() => {
    const vals = Object.values(steps);
    if (vals.some((v) => v.status === "fail")) return "fail";
    if (vals.some((v) => v.status === "running")) return "running";
    if (vals.every((v) => v.status === "pass")) return "pass";
    return "idle";
  }, [steps]);

  const update = (k: StepKey, patch: Partial<StepState>) =>
    setSteps((prev) => ({ ...prev, [k]: { ...prev[k], ...patch } }));

  const runVoice = useCallback(async () => {
    update("voice", { status: "running" });
    const t0 = performance.now();
    try {
      const { data, error } = await supabase.functions.invoke("hero-tts", {
        body: { langCode: lang, langName: lang, voice },
      });
      if (error || !data?.audio) throw error ?? new Error("No audio returned");
      const bin = atob(data.audio as string);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: data.mime || "audio/mpeg" }));
      setAudioSrc(url);
      update("voice", {
        status: "pass",
        ms: Math.round(performance.now() - t0),
        detail: `${Math.round(bytes.length / 1024)} KB · voice=${voice}`,
      });
      return true;
    } catch (e: any) {
      update("voice", { status: "fail", ms: Math.round(performance.now() - t0), error: e?.message ?? String(e) });
      return false;
    }
  }, [lang, voice]);

  const runTranscribe = useCallback(async () => {
    update("transcribe", { status: "running" });
    const t0 = performance.now();
    try {
      const { data, error } = await supabase.functions.invoke("hero-transcribe", {
        body: { video_url: videoUrl, lang, lang_name: lang },
      });
      if (error) throw error;
      const ws = Array.isArray(data?.words) ? data.words : [];
      if (!ws.length) throw new Error("No words returned from transcription");
      setWords(ws);
      update("transcribe", {
        status: "pass",
        ms: Math.round(performance.now() - t0),
        detail: `${ws.length} words · ${ws[ws.length - 1]?.end?.toFixed(1)}s span`,
      });
      return ws;
    } catch (e: any) {
      update("transcribe", { status: "fail", ms: Math.round(performance.now() - t0), error: e?.message ?? String(e) });
      return null;
    }
  }, [videoUrl, lang]);

  const runRender = useCallback(
    async (ws: Array<{ text: string; start: number; end: number }>) => {
      update("render", { status: "running" });
      const t0 = performance.now();
      try {
        const v = videoRef.current;
        if (!v) throw new Error("Video element not mounted");
        v.muted = true;
        await v.play().catch(() => {});
        const targetSec = Math.min(3, ws[ws.length - 1]?.end ?? 3);
        let hits = 0;
        const seen = new Set<number>();
        await new Promise<void>((resolve, reject) => {
          const started = performance.now();
          const tick = () => {
            const t = v.currentTime;
            const idx = ws.findIndex((w) => t >= w.start && t <= w.end);
            if (idx !== activeIdx) setActiveIdx(idx);
            if (idx >= 0 && !seen.has(idx)) {
              seen.add(idx);
              hits++;
            }
            if (t >= targetSec || performance.now() - started > 8000) {
              v.pause();
              resolve();
              return;
            }
            rafRef.current = requestAnimationFrame(tick);
          };
          rafRef.current = requestAnimationFrame(tick);
          v.onerror = () => reject(new Error("Video playback error"));
        });
        if (hits < 1) throw new Error("No active word highlighted during playback window");
        update("render", {
          status: "pass",
          ms: Math.round(performance.now() - t0),
          detail: `${hits} word highlight${hits === 1 ? "" : "s"} in ${targetSec.toFixed(1)}s`,
        });
        return true;
      } catch (e: any) {
        update("render", { status: "fail", ms: Math.round(performance.now() - t0), error: e?.message ?? String(e) });
        return false;
      }
    },
    [activeIdx],
  );

  const runAll = useCallback(async () => {
    setRunning(true);
    setSteps(INITIAL);
    setWords([]);
    setActiveIdx(-1);
    try {
      await runVoice();
      const ws = await runTranscribe();
      if (ws) await runRender(ws);
    } finally {
      setRunning(false);
    }
  }, [runVoice, runTranscribe, runRender]);

  return (
    <div className="min-h-dvh bg-background text-foreground p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">End-to-end test flow</h1>
            <p className="text-sm text-muted-foreground">
              Runs voice change → transcription → caption rendering on one video and reports status.
            </p>
          </div>
          <StatusBadge s={overall} />
        </header>

        <Card className="p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <Input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="Video URL"
            />
            <Input
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="w-24"
              placeholder="lang"
            />
            <Input
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
              className="w-28"
              placeholder="voice"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={runAll} disabled={running} className="gap-2">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
              Run full test
            </Button>
            <span className="text-xs text-muted-foreground">
              Tests all three subsystems against the selected video.
            </span>
          </div>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          {(Object.keys(steps) as StepKey[]).map((k) => (
            <Card key={k} className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-medium">{LABEL[k]}</div>
                <StatusBadge s={steps[k].status} />
              </div>
              {steps[k].ms !== undefined && (
                <div className="text-xs text-muted-foreground">{steps[k].ms} ms</div>
              )}
              {steps[k].detail && <div className="text-xs">{steps[k].detail}</div>}
              {steps[k].error && (
                <div className="text-xs text-destructive break-words">{steps[k].error}</div>
              )}
            </Card>
          ))}
        </div>

        <Card className="p-4">
          <div className="relative mx-auto w-full max-w-sm aspect-[9/16] bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              src={videoUrl}
              key={videoUrl}
              className="absolute inset-0 h-full w-full object-cover"
              playsInline
              muted
              crossOrigin="anonymous"
            />
            {activeIdx >= 0 && words[activeIdx] && (
              <div className="absolute inset-x-0 bottom-8 flex justify-center pointer-events-none">
                <span className="px-3 py-1 rounded bg-black/70 text-white text-lg font-semibold">
                  {words[activeIdx].text}
                </span>
              </div>
            )}
          </div>
          {audioSrc && (
            <audio src={audioSrc} controls className="mt-3 w-full" />
          )}
        </Card>
      </div>
    </div>
  );
}
