// Transcribes the currently active hero video with ElevenLabs Scribe v2,
// caches the word-level timings, and returns them (plus optional translation).
// Public: safe to call from the marketing hero.
import { createClient } from "@supabase/supabase-js";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS" };

const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") || "").replace("mqotnflwrgqppbhjkwyq", "mqotnlflwrgqpbhjkwyq");
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const ELEVEN_KEY = Deno.env.get("ELEVENLABS_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

interface Word { text: string; start: number; end: number }

const PUBLIC_DEMO_VIDEO_URLS = new Set([
  "https://videos.pexels.com/video-files/4114797/4114797-hd_1080_1920_25fps.mp4",
  "https://videos.pexels.com/video-files/6774213/6774213-hd_1080_1920_25fps.mp4",
]);

const normalizeLangCode = (code?: string | null) => {
  const c = String(code ?? "").toLowerCase();
  if (c === "eng" || c.startsWith("en")) return "en";
  if (c === "hin" || c.startsWith("hi")) return "hi";
  return c;
};

const sameLanguage = (a?: string | null, b?: string | null) => {
  const aa = normalizeLangCode(a);
  const bb = normalizeLangCode(b);
  return aa === bb || aa.split("-")[0] === bb.split("-")[0];
};

function isStaleMarketingFallback(text?: string | null) {
  if (!text) return false;
  const compact = text.toLowerCase().replace(/\s+/g, " ").trim();
  const mentionsCaptions = /caption|subtitle|कैप्शन|सबटाइट|subtítulo|sous-titre|untertitel|ترجم|عنوان|ক্যাপশন|தலைப்பு|క్యాప్షన్|कॅप्शन|ਕੈਪਸ਼ਨ/u.test(compact);
  const mentionsGenericTiming = /word[- ]?(perfect|level)|perfect timing|timing|हर भाषा|every language|toutes les langues|todos los idiomas|jeder sprache|हर शब्द|शब्द-शब्द/u.test(compact);
  return mentionsCaptions && mentionsGenericTiming;
}

const isVideoFetchFailure = (e: unknown) => {
  const message = String((e as Error)?.message ?? e);
  return /^fetch video \d+/.test(message);
};

const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB
const FETCH_TIMEOUT_MS = 20_000;

async function readCapped(res: Response): Promise<Blob> {
  const ct = (res.headers.get("content-type") ?? "").toLowerCase();
  if (!ct.startsWith("video/") && !ct.startsWith("application/octet-stream")) {
    throw new Error("fetch video 415");
  }
  const cl = Number(res.headers.get("content-length") ?? "0");
  if (cl && cl > MAX_VIDEO_BYTES) throw new Error("fetch video 413");
  const reader = res.body?.getReader();
  if (!reader) throw new Error("fetch video 502");
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_VIDEO_BYTES) {
      try { await reader.cancel(); } catch { /* ignore */ }
      throw new Error("fetch video 413");
    }
    chunks.push(value);
  }
  return new Blob(chunks, { type: ct || "video/mp4" });
}

async function fetchVideoSafely(videoUrl: string, supabaseHost: string): Promise<Blob> {
  if (!isAllowedVideoUrl(videoUrl, supabaseHost)) throw new Error("fetch video 400");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  const headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept": "video/mp4,video/*;q=0.9,*/*;q=0.8",
    "Referer": "https://www.pexels.com/",
  };
  try {
    let res = await fetch(videoUrl, { headers, redirect: "manual", signal: ctrl.signal });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new Error(`fetch video ${res.status}`);
      const nextUrl = new URL(loc, videoUrl).toString();
      if (!isAllowedVideoUrl(nextUrl, supabaseHost)) throw new Error("fetch video 400");
      res = await fetch(nextUrl, { headers, redirect: "manual", signal: ctrl.signal });
    }
    if (!res.ok) throw new Error(`fetch video ${res.status}`);
    return await readCapped(res);
  } finally {
    clearTimeout(timer);
  }
}

function extractStoragePath(videoUrl: string, supabaseHost: string): string | null {
  try {
    const u = new URL(videoUrl);
    if (u.hostname.toLowerCase() !== supabaseHost) return null;
    const prefix = "/storage/v1/object/sign/hero-media/";
    if (!u.pathname.startsWith(prefix)) return null;
    return decodeURIComponent(u.pathname.slice(prefix.length));
  } catch {
    return null;
  }
}

async function transcribeWithElevenLabs(videoUrl: string): Promise<{
  text: string; words: Word[]; lang?: string; duration?: number;
}> {
  if (!ELEVEN_KEY) throw new Error("ElevenLabs not connected");
  const supabaseHost = new URL(SUPABASE_URL).hostname;
  const blob = await fetchVideoSafely(videoUrl, supabaseHost);

  const fd = new FormData();
  fd.append("file", blob, "hero.mp4");
  fd.append("model_id", "scribe_v2");
  fd.append("tag_audio_events", "false");
  fd.append("diarize", "false");

  const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": ELEVEN_KEY },
    body: fd,
  });
  if (!r.ok) throw new Error(`ElevenLabs STT ${r.status}: ${await r.text()}`);
  const j = await r.json();
  const rawWords: Array<{ text: string; type?: string; start: number; end: number }> = j.words ?? [];
  const words: Word[] = rawWords
    .filter((w) => (w.type ?? "word") === "word" && w.text?.trim())
    .map((w) => ({ text: w.text.trim(), start: Number(w.start) || 0, end: Number(w.end) || 0 }));
  const text: string = j.text ?? words.map((w) => w.text).join(" ");
  const duration = words.length ? words[words.length - 1].end : undefined;
  return { text, words, lang: j.language_code, duration };
}


async function translate(text: string, langName: string): Promise<string | null> {
  if (!OPENAI_API_KEY || !text) return null;
  const j = await callAI({
          model: "gpt-4o-mini",
          messages: [
        { role: "system", content: `Translate the user's text to ${langName}. Return only the translation, no quotes or notes.` },
        { role: "user", content: text },
      ]
        }).catch(() => null);
        if (!j) return null;
  return (j.choices?.[0]?.message?.content ?? "").trim() || null;
}

const ALLOWED_HOSTS = new Set<string>([
  "videos.pexels.com",
  "player.vimeo.com",
  "cdn.pixabay.com",
]);

function isAllowedVideoUrl(raw: string, supabaseHost: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    // Block IP literals (private/link-local/metadata addresses)
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) return false;
    if (host === "localhost") return false;
    if (host === supabaseHost) return true; // project's own storage
    if (ALLOWED_HOSTS.has(host)) return true;
    return false;
  } catch {
    return false;
  }
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { video_url, lang, lang_name } = await req.json();
    if (!video_url || typeof video_url !== "string") {
      return new Response(JSON.stringify({ error: "video_url required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseHost = new URL(SUPABASE_URL).hostname;
    if (!isAllowedVideoUrl(video_url, supabaseHost)) {
      return new Response(JSON.stringify({ error: "video_url host not allowed" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Authorization: owners may transcribe their uploaded hero video. Signed-out
    // visitors may only transcribe the public homepage demo video, never an
    // arbitrary URL. This keeps the marketing voice demo working without
    // reopening the old SSRF/vector risk.
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    let userId: string | null = null;
    if (token && token !== ANON_KEY) {
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: userData } = await userClient.auth.getUser();
      userId = userData?.user?.id ?? null;
    }
    const storagePath = extractStoragePath(video_url, supabaseHost);
    let mediaQuery = admin
      .from("hero_media")
      .select("uploaded_by, is_active, video_url, storage_path")
      .limit(1);
    mediaQuery = storagePath ? mediaQuery.eq("storage_path", storagePath) : mediaQuery.eq("video_url", video_url);
    const { data: mediaRows, error: mediaErr } = await mediaQuery;
    if (mediaErr) throw mediaErr;
    const media = Array.isArray(mediaRows) ? mediaRows[0] : null;
    const isOwner = Boolean(userId && media?.uploaded_by === userId);
    const isPublicDemo = PUBLIC_DEMO_VIDEO_URLS.has(video_url) || Boolean(media?.is_active);
    if (!isOwner && !isPublicDemo) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }



    // 1) Load or build the source transcript
    let { data: cached } = await admin
      .from("hero_transcripts")
      .select("source_text, source_lang, words, duration")
      .eq("video_url", media?.video_url ?? video_url)
      .maybeSingle();

    let transcript: { text: string; words: Word[]; lang?: string; duration?: number } | null = null;
    const cachedIsFake = Boolean(cached && isStaleMarketingFallback(cached.source_text));
    if (!cached || cachedIsFake) {
      try {
        transcript = await transcribeWithElevenLabs(video_url);
      } catch (e) {
        if (isVideoFetchFailure(e)) {
          const reason = String((e as Error)?.message ?? e);
          console.warn("hero-transcribe fallback:", reason);
          return new Response(JSON.stringify({
            source_text: "",
            source_lang: null,
            words: [],
            duration: 0,
            degraded: true,
            warning: reason,
            translated_text: null,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } else {
          throw e;
        }
      }
    }

    if (!cached || cachedIsFake) {
      const insert = {
        video_url: media?.video_url ?? video_url,
        source_lang: transcript?.lang ?? null,
        source_text: transcript?.text ?? "",
        words: transcript?.words ?? [],
        duration: transcript?.duration ?? null,
      };
      const { data: ins, error: insErr } = await admin
        .from("hero_transcripts")
        .upsert(insert, { onConflict: "video_url" })
        .select("source_text, source_lang, words, duration")
        .single();
      if (insErr) throw insErr;
      cached = ins;
    }

    // 2) Optional translation cache
    let translated: string | null = null;
    if (lang && lang_name && cached.source_lang && !sameLanguage(lang, cached.source_lang)) {
      const { data: tcache } = await admin
        .from("hero_transcript_translations")
        .select("text")
        .eq("video_url", media?.video_url ?? video_url)
        .eq("lang", lang)
        .maybeSingle();
      if (tcache && !isStaleMarketingFallback(tcache.text)) translated = tcache.text;
      else {
        translated = await translate(cached.source_text, lang_name);
        // If translation produced nothing useful, return null — never fall
        // back to unrelated marketing copy. The client will show the actual
        // source transcript instead so captions always match the spoken audio.
        if (!translated || translated.trim() === cached.source_text.trim() || isStaleMarketingFallback(translated)) {
          translated = null;
        }
        if (translated) {
          await admin
            .from("hero_transcript_translations")
            .upsert({ video_url: media?.video_url ?? video_url, lang, text: translated }, { onConflict: "video_url,lang" });
        }
      }
    }

    return new Response(JSON.stringify({
      source_text: cached.source_text,
      source_lang: cached.source_lang,
      words: cached.words,
      duration: cached.duration,
      degraded: cached.degraded ?? false,
      warning: cached.warning ?? undefined,
      translated_text: translated,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("hero-transcribe error:", e);
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
