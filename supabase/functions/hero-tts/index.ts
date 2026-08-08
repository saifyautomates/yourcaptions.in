// Hero showcase TTS: translates the real video transcript into any language,
// then synthesizes it via ElevenLabs (primary) → OpenAI (fallback).
// Returns { text, audio (base64), mime, words } where ElevenLabs words are
// generated from character timestamps so the hero captions lock to the voice.

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS" };

// Voice keys the client exposes → { elevenlabs voice id, openai voice name }
const VOICE_MAP: Record<string, { el: string; openai: string; label: string }> = {
  alloy:   { el: "EXAVITQu4vr4xnSDxMaL", openai: "alloy",   label: "Alloy"   }, // Sarah
  nova:    { el: "FGY2WhTYpPnrIDTdsKH5", openai: "nova",    label: "Nova"    }, // Laura
  echo:    { el: "JBFqnCBsd6RMkjVDRZzb", openai: "echo",    label: "Echo"    }, // George
  shimmer: { el: "XrExE9yKIg1WjnnlVkGX", openai: "shimmer", label: "Shimmer" }, // Matilda
  onyx:    { el: "nPczCjzI2devNBz1zQrb", openai: "onyx",    label: "Onyx"    }, // Brian
  fable:   { el: "IKne3meq5aSn9XLyUdCD", openai: "fable",   label: "Fable"   }, // Charlie
  sage:    { el: "cgSgspJ2msm6clMCkdW9", openai: "sage",    label: "Sage"    }, // Jessica
  ash:     { el: "cjVigY5qzO86Huf0OWal", openai: "ash",     label: "Ash"     }, // Eric
  coral:   { el: "pFZP5JQG7iQjIQuC4Bku", openai: "coral",   label: "Coral"   }, // Lily
};

function bytesToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk)) as unknown as number[],
    );
  }
  return btoa(binary);
}

type TTSWord = { text: string; start: number; end: number };
type ElevenAlignment = {
  characters?: string[];
  character_start_times_seconds?: number[];
  character_end_times_seconds?: number[];
};

function wordsFromAlignment(text: string, alignment?: ElevenAlignment): TTSWord[] {
  const chars = alignment?.characters?.length ? alignment.characters : Array.from(text);
  const starts = alignment?.character_start_times_seconds ?? [];
  const ends = alignment?.character_end_times_seconds ?? [];
  const words: TTSWord[] = [];
  let current = "";
  let start: number | null = null;
  let end = 0;

  const flush = () => {
    const clean = current.trim();
    if (clean && start !== null && end > start) words.push({ text: clean, start, end });
    current = "";
    start = null;
    end = 0;
  };

  chars.forEach((ch, i) => {
    if (/\s/u.test(ch)) {
      flush();
      return;
    }
    const s = Number(starts[i]);
    const e = Number(ends[i]);
    if (start === null && Number.isFinite(s)) start = s;
    if (Number.isFinite(e)) end = Math.max(end, e);
    current += ch;
  });
  flush();
  return words;
}

async function translate(text: string, langName: string): Promise<string> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key || langName.toLowerCase() === "english") return text;
  try {
    const j = await callAI({
          model: "google/gemini-3-flash-preview",
          messages: [
          { role: "system", content: `Translate to ${langName}. Keep it natural and conversational. Preserve "Yourcaptions.in" literally. Return ONLY the translation, no quotes, no extras.` },
          { role: "user", content: text },
        ]
        }).catch(() => null);
        if (!j) return text;
    const out = j.choices?.[0]?.message?.content?.trim();
    return out || text;
  } catch { return text; }
}

type TTSResult =
  | { ok: true; audioBase64: string; words: TTSWord[] }
  | { ok: false; status: number; code: string; message: string; retryable: boolean };

const TRANSIENT = new Set([408, 425, 429, 500, 502, 503, 504]);

function classify(status: number, body: string): { code: string; message: string; retryable: boolean } {
  const retryable = TRANSIENT.has(status);
  // ElevenLabs reports quota exhaustion as HTTP 401 with quota_exceeded in the body.
  // Detect that before generic auth handling so the client gets the right fallback reason.
  if (/quota_exceeded|exceeds your quota|credits remaining/i.test(body)) {
    return { code: "credits_exhausted", message: "Quota exceeded", retryable: false };
  }
  if (status === 401 || status === 403) return { code: "auth", message: "Provider auth failed", retryable: false };
  if (status === 402) return { code: "credits_exhausted", message: "Provider out of credits", retryable: false };
  if (status === 429) return { code: "rate_limited", message: "Rate limited", retryable: true };
  if (status >= 500) return { code: "upstream_error", message: `Upstream ${status}`, retryable: true };
  return { code: "provider_error", message: `HTTP ${status}`, retryable };
}

async function withRetry(
  label: string,
  fn: () => Promise<TTSResult>,
  maxAttempts = 3,
): Promise<TTSResult> {
  let last: TTSResult = { ok: false, status: 0, code: "no_attempt", message: "no attempt", retryable: false };
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      last = await fn();
    } catch (e) {
      last = { ok: false, status: 0, code: "network", message: String(e), retryable: true };
    }
    if (last.ok) return last;
    console.error(`${label} attempt ${attempt}/${maxAttempts}`, last);
    if (!last.retryable || attempt === maxAttempts) return last;
    const backoff = Math.min(2000, 250 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 100);
    await new Promise((r) => setTimeout(r, backoff));
  }
  return last;
}

async function elevenlabsTTS(text: string, voiceId: string): Promise<TTSResult> {
  const key = Deno.env.get("ELEVENLABS_API_KEY");
  if (!key) return { ok: false, status: 0, code: "not_configured", message: "ELEVENLABS_API_KEY missing", retryable: false };
  return withRetry("elevenlabs", async () => {
    const r = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.42, similarity_boost: 0.9, style: 0.1, use_speaker_boost: true, speed: 1.0 },
        }),
      },
    );
    if (r.ok) {
      const j = await r.json();
      const alignment = (j.normalized_alignment ?? j.alignment) as ElevenAlignment | undefined;
      return {
        ok: true,
        audioBase64: String(j.audio_base64 ?? ""),
        words: wordsFromAlignment(text, alignment),
      };
    }
    const body = await r.text();
    return { ok: false, status: r.status, ...classify(r.status, body) };
  });
}

async function openaiTTS(text: string, voice: string): Promise<TTSResult> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) return { ok: false, status: 0, code: "not_configured", message: "OPENAI_API_KEY missing", retryable: false };
  return withRetry("openai", async () => {
    const r = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify({ model: "tts-1", input: text, voice, response_format: "mp3" }),
    });
    if (r.ok) return { ok: true, audioBase64: bytesToBase64(await r.arrayBuffer()), words: [] };
    const body = await r.text();
    return { ok: false, status: r.status, ...classify(r.status, body) };
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const langName = String(body.langName || "English");
    const voiceKey = String(body.voice || "alloy").toLowerCase();
    const v = VOICE_MAP[voiceKey] ?? VOICE_MAP.alloy;
    const sourceText = typeof body.text === "string" ? body.text.replace(/\s+/g, " ").trim().slice(0, 60) : "";
    if (!sourceText) {
      return new Response(JSON.stringify({ error: "text required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const text = await translate(sourceText, langName);

    // Try progressively shorter slices when providers are quota-limited.
    const attempts = [text, text.slice(0, 40), text.slice(0, 20)].filter(
      (t, i, arr) => t && arr.indexOf(t) === i,
    );

    let audioBase64 = "";
    let words: TTSWord[] = [];
    let provider = "none";
    let usedText = text;
    const errors: Array<{ provider: string; status: number; code: string; message: string }> = [];
    outer: for (const attempt of attempts) {
      for (const [name, fn, arg] of [
        ["elevenlabs", elevenlabsTTS, v.el],
        ["openai", openaiTTS, v.openai],
      ] as const) {
        const res = await fn(attempt, arg);
        if (res.ok && res.audioBase64) {
          audioBase64 = res.audioBase64;
          words = res.words;
          provider = name;
          usedText = attempt;
          break outer;
        }
        errors.push({ provider: name, status: res.status, code: res.code, message: res.message });
      }
    }

    if (!audioBase64) {
      // Graceful degradation: return 200 with silent flag so the UI plays the
      // original video audio instead of showing an error.
      const quotaHit = errors.some((e) => e.code === "credits_exhausted");
      return new Response(
        JSON.stringify({
          text,
          silent: true,
          reason: quotaHit ? "tts_quota_exhausted" : "tts_unavailable",
          errors,
          voice: voiceKey,
          voiceLabel: v.label,
          words: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" } },
      );
    }


    return new Response(
      JSON.stringify({
        text: usedText,
          audio: audioBase64,
        mime: "audio/mpeg",
        provider,
        voice: voiceKey,
        voiceLabel: v.label,
        truncated: usedText !== text,
          words,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=86400" } },
    );
  } catch (e) {
    console.error("hero-tts internal", e);
    return new Response(
      JSON.stringify({ error: "internal_error", code: "internal", message: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
