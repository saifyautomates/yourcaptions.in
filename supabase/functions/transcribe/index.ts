import { createClient } from "@supabase/supabase-js";
import { enforceRateLimit, makeAdmin, requireCredits, deductCredits, refundCredits } from "../_shared/rate-limit.ts";
import { createJob, startJob, progressWriter, succeedJob, failJob } from "../_shared/jobs.ts";
import { consumeQuota, peekRemaining, refundQuota } from "../_shared/quota.ts";
import { assemblyLang, deepgramLang } from "../_shared/lang-map.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") || "").replace("mqotnflwrgqppbhjkwyq", "mqotnlflwrgqpbhjkwyq");
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ASSEMBLYAI_KEY = Deno.env.get("ASSEMBLYAI_API_KEY");
const DEEPGRAM_KEY = Deno.env.get("DEEPGRAM_API_KEY");
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");
const SARVAM_KEY = Deno.env.get("SARVAM_API_KEY");
import { FFMPEG_API_URL, FFMPEG_API_AUTH, getFfmpegHeaders, uploadToFfmpegApi, processFfmpegJob, processFfmpegDirect, processVideoAudio } from "../_shared/ffmpeg-api.ts";

interface WordTiming { text: string; start: number; end: number; confidence?: number; speaker?: string }
interface Segment { start: number; end: number; text: string; words?: WordTiming[]; confidence?: number; speaker?: string }

const VIDEO_EXT_RE = /\.(mp4|mov|m4v|webm|mkv|avi|wmv|flv)$/i;

const SARVAM_LANG_MAP: Record<string, string> = {
  "hi": "hi-IN", "hindi": "hi-IN", "hi-in": "hi-IN", "hi-latn": "hi-IN",
  "bn": "bn-IN", "bengali": "bn-IN", "bn-in": "bn-IN",
  "kn": "kn-IN", "kannada": "kn-IN", "kn-in": "kn-IN",
  "ml": "ml-IN", "malayalam": "ml-IN", "ml-in": "ml-IN",
  "mr": "mr-IN", "marathi": "mr-IN", "mr-in": "mr-IN",
  "od": "od-IN", "odia": "od-IN", "or": "od-IN", "od-in": "od-IN",
  "pa": "pa-IN", "punjabi": "pa-IN", "pa-in": "pa-IN",
  "ta": "ta-IN", "tamil": "ta-IN", "ta-in": "ta-IN",
  "te": "te-IN", "telugu": "te-IN", "te-in": "te-IN",
  "gu": "gu-IN", "gujarati": "gu-IN", "gu-in": "gu-IN",
  "en-in": "en-IN",
  "ur": "ur-IN", "urdu": "ur-IN",
  "as": "as-IN", "assamese": "as-IN",
};

export function isIndianLanguage(lang: string | null | undefined): boolean {
  if (!lang) return false;
  const l = lang.toLowerCase().trim();
  const base = l.split("-")[0];
  const indianCodes = new Set([
    "hi", "bn", "kn", "ml", "mr", "od", "pa", "ta", "te", "gu",
    "ur", "as", "sa", "bho", "mai", "awa", "raj", "kok", "sd", "ks", "ne",
    "hinglish", "tanglish", "teluglish", "minglish", "gujlish", "kanglish", "manglish", "punglish"
  ]);
  return indianCodes.has(l) || indianCodes.has(base) || l.endsWith("-in");
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: number | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const fmtSrt = (segs: Segment[]) =>
  segs.map((s, i) => {
    const f = (t: number) => {
      const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = Math.floor(t % 60), ms = Math.floor((t % 1) * 1000);
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
    };
    return `${i + 1}\n${f(s.start)} --> ${f(s.end)}\n${s.text}\n`;
  }).join("\n");

// Group word-level timestamps into readable segments (sentence-ish, capped word count / duration).
// Retains the per-word timings on each segment so the client can drive
// accurate per-word highlight animation and speaker diarization.
function groupWords(words: WordTiming[]): Segment[] {
  const MAX_WORDS = 10;
  const MAX_DURATION = 6; // seconds
  const out: Segment[] = [];
  let cur: WordTiming[] = [];
  const flush = () => {
    if (!cur.length) return;
    const withConf = cur.filter((w) => typeof w.confidence === "number");
    const segConf = withConf.length ? withConf.reduce((a, b) => a + (b.confidence ?? 0), 0) / withConf.length : undefined;
    const speaker = cur[0]?.speaker;
    out.push({
      start: cur[0].start,
      end: cur[cur.length - 1].end,
      text: cur.map((w) => w.text).join(" ").replace(/\s+([,.!?।])/g, "$1"),
      words: cur.map((w) => ({ text: w.text, start: w.start, end: w.end, confidence: w.confidence, speaker: w.speaker })),
      confidence: segConf,
      speaker,
    });
    cur = [];
  };
  for (const w of words) {
    if (cur.length && cur[0].speaker && w.speaker && cur[0].speaker !== w.speaker) {
      flush();
    }
    cur.push(w);
    const dur = w.end - cur[0].start;
    const endsSentence = /[.!?।]$/.test(w.text);
    if (endsSentence || cur.length >= MAX_WORDS || dur >= MAX_DURATION) flush();
  }
  flush();
  return out;
}


async function transcribeAssemblyAI(input: { blob?: Blob; url?: string }, lang: string): Promise<Segment[]> {
  if (!ASSEMBLYAI_KEY) throw new Error("ASSEMBLYAI_API_KEY not configured");
  let upload_url = input.url;
  if (!upload_url) {
    if (!input.blob) throw new Error("no audio input");
    const up = await fetch("https://api.assemblyai.com/v2/upload", {
      method: "POST",
      headers: { authorization: ASSEMBLYAI_KEY },
      body: input.blob,
    });
    if (!up.ok) throw new Error(`AssemblyAI upload: ${up.status} ${await up.text()}`);
    upload_url = (await up.json()).upload_url;
  }

  const mapped = assemblyLang(lang);
  const body: Record<string, unknown> = {
    audio_url: upload_url,
    speech_models: ["universal-3-5-pro", "universal-2"],
    punctuate: true,
    format_text: true,
    disfluencies: false,
  };
  if (mapped) body.language_code = mapped;
  else body.language_detection = true;

  const trans = await fetch("https://api.assemblyai.com/v2/transcript", {
    method: "POST",
    headers: { authorization: ASSEMBLYAI_KEY, "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!trans.ok) throw new Error(`AssemblyAI submit: ${trans.status} ${await trans.text()}`);
  const { id } = await trans.json();

  // Poll faster (1.5s) — AssemblyAI usually finishes in a few polls.
  for (let i = 0; i < 400; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const poll = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
      headers: { authorization: ASSEMBLYAI_KEY },
    });
    const d = await poll.json();
    if (d.status === "completed") {
      const words = (d.words ?? []).map((w: any) => ({
        start: (w.start ?? 0) / 1000,
        end: (w.end ?? 0) / 1000,
        text: String(w.text ?? ""),
        confidence: typeof w.confidence === "number" ? w.confidence : undefined,
      }));
      return words.length ? groupWords(words) : [{ start: 0, end: 1, text: d.text ?? "" }];
    }
    if (d.status === "error") throw new Error(d.error ?? "AssemblyAI failed");
  }
  throw new Error("AssemblyAI timeout");
}

async function transcribeDeepgram(input: { blob?: Blob; url?: string }, lang: string): Promise<Segment[]> {
  if (!DEEPGRAM_KEY) throw new Error("DEEPGRAM_API_KEY not configured");
  const mapped = deepgramLang(lang);
  const params = new URLSearchParams({
    model: "nova-3",
    punctuate: "true",
    paragraphs: "true",
    smart_format: "true",
    diarize: "true",
    utterances: "true",
  });
  if (mapped) params.set("language", mapped);
  else params.set("detect_language", "true");

  const doFetch = async (p: URLSearchParams) => {
    if (input.url) {
      return fetch(`https://api.deepgram.com/v1/listen?${p.toString()}`, {
        method: "POST",
        headers: { Authorization: `Token ${DEEPGRAM_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url: input.url }),
      });
    }
    return fetch(`https://api.deepgram.com/v1/listen?${p.toString()}`, {
      method: "POST",
      headers: { Authorization: `Token ${DEEPGRAM_KEY}`, "Content-Type": input.blob!.type || "audio/mpeg" },
      body: input.blob!,
    });
  };

  const res = await doFetch(params);
  if (!res.ok) {
    if (res.status === 400 && mapped) {
      const p2 = new URLSearchParams(params); p2.set("model", "nova-2");
      const r2 = await doFetch(p2);
      if (!r2.ok) throw new Error(`Deepgram: ${r2.status} ${await r2.text()}`);
      return parseDeepgramJson(await r2.json());
    }
    throw new Error(`Deepgram: ${res.status} ${await res.text()}`);
  }
  return parseDeepgramJson(await res.json());
}

function parseDeepgramJson(j: any): Segment[] {
  const alt = j.results?.channels?.[0]?.alternatives?.[0];
  const rawWords: WordTiming[] = (alt?.words ?? []).map((w: any) => ({
    start: Number(w.start ?? 0),
    end: Number(w.end ?? 0),
    text: String(w.punctuated_word ?? w.word ?? "").trim(),
    confidence: typeof w.confidence === "number" ? w.confidence : undefined,
    speaker: w.speaker !== undefined ? `Speaker ${Number(w.speaker) + 1}` : undefined,
  })).filter((w: WordTiming) => w.text);
  if (rawWords.length) return groupWords(rawWords);
  const paras = alt?.paragraphs?.paragraphs ?? [];
  return paras.flatMap((p: any) =>
    (p.sentences ?? []).map((s: any) => ({
      start: Number(s.start ?? 0),
      end: Number(s.end ?? 0),
      text: String(s.text ?? "").trim(),
      speaker: s.speaker !== undefined ? `Speaker ${Number(s.speaker) + 1}` : undefined,
    })),
  );
}

async function transcribeSarvam(blob: Blob, filename: string, lang: string): Promise<Segment[]> {
  if (!SARVAM_KEY) throw new Error("SARVAM_API_KEY not configured");
  const norm = (lang || "").toLowerCase().trim();
  const langCode = SARVAM_LANG_MAP[norm] || SARVAM_LANG_MAP[norm.split("-")[0]] || "hi-IN";

  const fd = new FormData();
  fd.append("file", blob, filename || "audio.mp3");
  fd.append("model", "saaras:v2");
  fd.append("language_code", langCode);
  fd.append("with_timestamps", "true");

  const res = await fetch("https://api.sarvam.ai/speech-to-text", {
    method: "POST",
    headers: {
      "api-subscription-key": SARVAM_KEY,
    },
    body: fd,
  });

  if (!res.ok) {
    const errText = await res.text();
    console.warn(`Sarvam v2 failed (${res.status}): ${errText}, attempting v1 fallback`);
    const fd2 = new FormData();
    fd2.append("file", blob, filename || "audio.mp3");
    fd2.append("model", "saaras:v1");
    fd2.append("language_code", langCode);
    fd2.append("with_timestamps", "true");
    const res2 = await fetch("https://api.sarvam.ai/speech-to-text", {
      method: "POST",
      headers: { "api-subscription-key": SARVAM_KEY },
      body: fd2,
    });
    if (!res2.ok) {
      throw new Error(`Sarvam STT failed: ${res2.status} ${await res2.text()}`);
    }
    return parseSarvamJson(await res2.json());
  }

  const data = await res.json();
  return parseSarvamJson(data);
}

function parseSarvamJson(j: any): Segment[] {
  const wordsList = j.timestamps?.words ?? j.words ?? [];
  const rawWords: WordTiming[] = wordsList.map((w: any) => ({
    start: typeof w.start_time_seconds === "number" ? w.start_time_seconds : Number(w.start ?? 0),
    end: typeof w.end_time_seconds === "number" ? w.end_time_seconds : Number(w.end ?? 0),
    text: String(w.word ?? w.text ?? "").trim(),
    speaker: w.speaker_id || (w.speaker !== undefined ? `Speaker ${w.speaker}` : undefined),
    confidence: typeof w.confidence === "number" ? w.confidence : undefined,
  })).filter((w: WordTiming) => w.text);

  if (rawWords.length) return groupWords(rawWords);

  const transcript = String(j.transcript || j.text || "").trim();
  if (transcript) {
    return [{ start: 0, end: 1, text: transcript }];
  }
  return [];
}

// OpenAI Whisper v3 (whisper-1 endpoint, uses large-v3 backing model).
// Returns verbose_json with word-level timestamps — excellent for Hindi/Urdu/Punjabi.
async function transcribeWhisper(blob: Blob, filename: string, lang: string): Promise<Segment[]> {
  if (!OPENAI_KEY) throw new Error("OPENAI_API_KEY not configured");
  const fd = new FormData();
  fd.append("file", blob, filename);
  fd.append("model", "whisper-1");
  fd.append("response_format", "verbose_json");
  fd.append("timestamp_granularities[]", "word");
  fd.append("timestamp_granularities[]", "segment");
  // Map to ISO-639-1 when we have a hint; otherwise let Whisper auto-detect.
  const iso = (lang || "").split("-")[0].toLowerCase();
  if (iso && iso.length === 2) fd.append("language", iso);
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}` },
    body: fd,
  });
  if (!res.ok) throw new Error(`Whisper: ${res.status} ${await res.text()}`);
  const j = await res.json();
  const words: WordTiming[] = (j.words ?? []).map((w: any) => ({
    text: String(w.word ?? "").trim(),
    start: Number(w.start ?? 0),
    end: Number(w.end ?? 0),
  })).filter((w: WordTiming) => w.text);
  if (words.length) return groupWords(words);
  // Fall back to segment-level output.
  return (j.segments ?? []).map((s: any) => ({
    start: Number(s.start ?? 0), end: Number(s.end ?? 0), text: String(s.text ?? "").trim(),
  }));
}

// Optional: extract MP3 audio track from a video via a hosted FFmpeg REST API
// before sending to the transcription provider. Faster + cheaper than
// uploading full video. If FFMPEG_API is not configured or the call fails,
// we return the original blob and let the STT provider handle the video.
async function extractAudioMp3(blob: Blob, filename: string): Promise<{ blob: Blob; filename: string }> {
  if (!FFMPEG_API_URL || !blob.type.startsWith("video/")) {
    return { blob, filename };
  }
  try {
    if (/api\.ffmpeg-api\.com/i.test(FFMPEG_API_URL)) {
      const videoPath = await uploadToFfmpegApi("video.mp4", blob);
      const downloadUrl = await processFfmpegJob(
        [{ file_path: videoPath }],
        [{
          file: "output.mp3",
          maps: ["0:a:0?"],
          options: ["-vn", "-acodec", "libmp3lame", "-ab", "128k", "-ar", "16000", "-ac", "1"]
        }]
      );
      const outRes = await fetch(downloadUrl);
      if (!outRes.ok) throw new Error(`FFmpeg MP3 download failed: ${outRes.status}`);
      const audio = await outRes.blob();
      if (audio.size >= 512) {
        return { blob: new Blob([audio], { type: "audio/mpeg" }), filename: filename.replace(/\.[^.]+$/, "") + ".mp3" };
      }
    }

    const fd = new FormData();
    fd.append("file", blob, filename);
    fd.append("command", "-i input -vn -acodec libmp3lame -ab 128k -ar 16000 -ac 1 output.mp3");
    fd.append("output", "mp3");
    const headers: Record<string, string> = {};
    if (FFMPEG_API_AUTH) headers.Authorization = FFMPEG_API_AUTH.startsWith("Bearer ") ? FFMPEG_API_AUTH : `Bearer ${FFMPEG_API_AUTH}`;
    const res = await fetch(FFMPEG_API_URL, { method: "POST", headers, body: fd });
    if (!res.ok) throw new Error(`ffmpeg ${res.status}`);
    const audio = await res.blob();
    if (audio.size < 1024) throw new Error("ffmpeg returned empty");
    return { blob: new Blob([audio], { type: "audio/mpeg" }), filename: filename.replace(/\.[^.]+$/, "") + ".mp3" };
  } catch (e) {
    console.warn("FFmpeg extraction failed, using original blob:", e);
    return { blob, filename };
  }
}

async function runTranscription(project_id: string, providerOverride: string | undefined, jobId: string) {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const admin = makeAdmin();
  const setProgress = progressWriter(supabase, jobId);
  try {
    await startJob(supabase, jobId, "Loading media");
    const { data: project, error: prjErr } = await supabase.from("projects").select("*").eq("id", project_id).single();
    if (prjErr || !project) throw new Error("project not found");

    // Fast path: sign a URL so cloud STT providers can fetch directly
    // (skips the download → re-upload roundtrip through our edge function).
    await setProgress(12, "Preparing media");
    const { data: signed, error: signErr } = await supabase.storage.from("media").createSignedUrl(project.media_path, 60 * 60);
    if (signErr) console.warn("transcribe: createSignedUrl failed", signErr.message);
    const mediaUrl = signed?.signedUrl;

    const isIndian = isIndianLanguage(project.source_language);
    let requestedProvider = providerOverride ?? project.provider;
    if (!requestedProvider || requestedProvider === "auto" || requestedProvider === "assemblyai") {
      requestedProvider = isIndian ? "sarvam" : "deepgram";
    }

    const origName = project.media_path.split("/").pop() ?? "audio.mp3";
    const isVideoFile = VIDEO_EXT_RE.test(origName);

    // Only download + FFmpeg-extract if we'll fall through to Whisper or Sarvam
    let lazyAudio: { blob: Blob; filename: string } | null = null;
    const ensureAudio = async () => {
      if (lazyAudio) return lazyAudio;
      if (isVideoFile && !mediaUrl) {
        throw new Error("Could not create signed media URL for video file — check storage bucket permissions.");
      }
      await setProgress(20, "Downloading media");
      const { data: file, error: dErr } = await withTimeout(
        supabase.storage.from("media").download(project.media_path),
        45_000,
        "Media download",
      );
      if (dErr || !file) throw new Error("media not found");
      await setProgress(26, "Extracting audio track");
      lazyAudio = await withTimeout(extractAudioMp3(file, origName), 60_000, "Audio extraction");
      return lazyAudio;
    };

    await setProgress(30, `Transcribing with ${requestedProvider}`);

    // Intelligent fallback chain:
    // Indian languages: Sarvam (primary) -> Deepgram -> Whisper -> AssemblyAI
    // Foreign languages: Deepgram (primary) -> AssemblyAI -> Whisper -> Sarvam
    const chain: string[] = [requestedProvider];
    const preferredOrder = isIndian
      ? ["sarvam", "deepgram", "whisper", "assemblyai"]
      : ["deepgram", "assemblyai", "whisper", "sarvam"];
    for (const p of preferredOrder) {
      if (!chain.includes(p)) chain.push(p);
    }

    let segments: Segment[] = [];
    let usedProvider = requestedProvider;
    let lastErr: unknown = null;
    for (const p of chain) {
      try {
        await setProgress(
          p === "sarvam" ? 34 : p === "deepgram" ? 44 : p === "assemblyai" ? 54 : p === "whisper" ? 64 : 70,
          `Transcribing with ${p}`
        );
        if (p === "sarvam" && SARVAM_KEY) {
          const a = await ensureAudio();
          segments = await withTimeout(
            transcribeSarvam(a.blob, a.filename, project.source_language),
            240_000,
            "Sarvam transcription"
          );
        } else if (p === "deepgram" && DEEPGRAM_KEY) {
          segments = mediaUrl
            ? await withTimeout(transcribeDeepgram({ url: mediaUrl }, project.source_language), 240_000, "Deepgram transcription")
            : await withTimeout(transcribeDeepgram({ blob: (await ensureAudio()).blob }, project.source_language), 240_000, "Deepgram transcription");
        } else if (p === "assemblyai" && ASSEMBLYAI_KEY) {
          segments = mediaUrl
            ? await withTimeout(transcribeAssemblyAI({ url: mediaUrl }, project.source_language), 600_000, "AssemblyAI transcription")
            : await withTimeout(transcribeAssemblyAI({ blob: (await ensureAudio()).blob }, project.source_language), 600_000, "AssemblyAI transcription");
        } else if (p === "whisper" && OPENAI_KEY) {
          const a = await ensureAudio();
          segments = await withTimeout(transcribeWhisper(a.blob, a.filename, project.source_language), 180_000, "Whisper transcription");
        }
        if (segments.length) { usedProvider = p; break; }
      } catch (err) {
        console.warn(`Provider ${p} failed:`, err);
        lastErr = err;
        await setProgress(55, `Retrying with next provider…`);
      }
    }
    if (!segments.length) throw new Error(`All providers failed: ${lastErr}`);



    // Meter against the caller's monthly caption quota. In compare_mode we
    // only bill once (the first provider that finishes) so a compare run
    // doesn't double-count.
    const duration = Math.ceil(segments[segments.length - 1].end);
    if (!project.compare_mode) {
      const q = await consumeQuota(supabase, project.user_id, "caption_seconds", duration);
      if (!q.ok) throw new Error(q.message);
      await deductCredits(admin, project.user_id, duration);
    } else {
      const { count } = await supabase.from("captions").select("id", { count: "exact", head: true })
        .eq("project_id", project_id).eq("language", project.source_language);
      if (!count) {
        const q = await consumeQuota(supabase, project.user_id, "caption_seconds", duration);
        if (!q.ok) throw new Error(q.message);
        await deductCredits(admin, project.user_id, duration);
      }
    }

    await setProgress(85, "Saving captions");
    const srt = fmtSrt(segments);
    await supabase.from("captions").insert({
      project_id, language: project.source_language, provider: usedProvider, segments, srt_text: srt,
    });

    if (project.compare_mode) {
      const { data: rows } = await supabase.from("captions").select("provider")
        .eq("project_id", project_id).eq("language", project.source_language);
      const provs = new Set((rows ?? []).map((r: any) => r.provider));
      if (provs.has("deepgram") && provs.has("assemblyai")) {
        await supabase.from("projects").update({ status: "ready", duration_seconds: duration }).eq("id", project_id);
      } else {
        await supabase.from("projects").update({ duration_seconds: duration }).eq("id", project_id);
      }
    } else {
      await supabase.from("projects").update({ status: "ready", duration_seconds: duration }).eq("id", project_id);
    }

    if (duration && !project.compare_mode) {
      const { data: prof } = await supabase.from("profiles").select("credits_seconds").eq("id", project.user_id).single();
      if (prof) {
        await supabase.from("profiles").update({
          credits_seconds: Math.max(0, prof.credits_seconds - duration),
        }).eq("id", project.user_id);
      }
    }

    await succeedJob(supabase, jobId, {
      project_id, provider, language: project.source_language,
      segments: segments.length, duration_seconds: duration,
    }, `Transcribed ${segments.length} segments`);
  } catch (e: any) {
    console.error("transcribe error:", e);
    await supabase.from("projects").update({
      status: "failed", error_message: String(e.message ?? e),
    }).eq("id", project_id);
    await failJob(supabase, jobId, e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { project_id, provider } = await req.json();
    if (!project_id) throw new Error("project_id required");

    // Ownership check via RLS-scoped client — prevents any signed-in user
    // from triggering paid transcription against another user's project.
    const { data: ownedProject, error: ownErr } = await userClient
      .from("projects")
      .select("id")
      .eq("id", project_id)
      .maybeSingle();
    if (ownErr || !ownedProject) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }



    const admin = makeAdmin();
    const rl = await enforceRateLimit(admin, userData.user.id, "transcribe");
    if (!rl.ok) {
      const { trackRateLimitServer } = await import("../_shared/observability.ts");
      trackRateLimitServer(userData.user.id, { fn: "transcribe", status: rl.status, message: rl.message });
      return new Response(JSON.stringify({ error: rl.message }), {
        status: rl.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pre-check quota so we don't burn provider credits when the user has
    // no caption seconds left this month. Actual amount is consumed after
    // the transcription finishes and the true duration is known.
    const remaining = await peekRemaining(admin, userData.user.id, "caption_seconds");
    if (remaining.remaining <= 0) {
      const { trackQuotaExceededServer } = await import("../_shared/observability.ts");
      trackQuotaExceededServer(userData.user.id, { fn: "transcribe", kind: "caption_seconds", used: remaining.used, quota: remaining.quota });
      return new Response(JSON.stringify({
        error: `You've reached your monthly caption limit (${Math.floor(remaining.quota/60)} min). Upgrade your plan to continue.`,
        kind: "caption_seconds",
      }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Credit gate: block users who ran out of credit-seconds. Admins bypass.
    const cred = await requireCredits(admin, userData.user.id, 1);
    if (!cred.ok) {
      return new Response(JSON.stringify({ error: cred.message, kind: "credits_seconds" }), {
        status: cred.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }




    const jobId = await createJob(admin, {
      user_id: userData.user.id,
      project_id,
      kind: "transcribe",
      input: { provider: provider ?? null },
      message: "Queued for transcription",
    });

    // Run in background so long transcriptions don't block the client.
    // @ts-ignore EdgeRuntime is available at runtime
    EdgeRuntime.waitUntil(runTranscription(project_id, provider, jobId));

    return new Response(JSON.stringify({ ok: true, queued: true, jobId }), {
      status: 202,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message ?? String(e) }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
