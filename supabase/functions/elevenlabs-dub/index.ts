// Generates an AI voiceover using ElevenLabs TTS from translated captions.
// Mirrors dub-video's job/quota/upload contract so the client (DubModal +
// useJob) can consume it identically.

import { createClient } from "@supabase/supabase-js";
import { enforceRateLimit, requireCredits, deductCredits, makeAdmin } from "../_shared/rate-limit.ts";
import { createJob, startJob, progressWriter, succeedJob, failJob } from "../_shared/jobs.ts";
import { consumeQuota, peekRemaining } from "../_shared/quota.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Curated ElevenLabs voice roster surfaced in the client picker.
const VOICES: Record<string, string> = {
  roger: "CwhRBWXzGAHq8TQ4Fs17",
  sarah: "EXAVITQu4vr4xnSDxMaL",
  laura: "FGY2WhTYpPnrIDTdsKH5",
  charlie: "IKne3meq5aSn9XLyUdCD",
  george: "JBFqnCBsd6RMkjVDRZzb",
  callum: "N2lVS1w4EtoT3dr4eOWO",
  river: "SAz9YHcvj6GT2YYXdXww",
  liam: "TX3LPaxmHKxFdv7VOQHJ",
  alice: "Xb7hH8MSUJpSbSDYk0k2",
  matilda: "XrExE9yKIg1WjnnlVkGX",
  will: "bIHbv24MWmeRgasZH58o",
  jessica: "cgSgspJ2msm6clMCkdW9",
  eric: "cjVigY5qzO86Huf0OWal",
  chris: "iP95p4xoKVk53GoZ742B",
  brian: "nPczCjzI2devNBz1zQrb",
  daniel: "onwK4e9ZLuTAKqWW03F9",
  lily: "pFZP5JQG7iQjIQuC4Bku",
  bill: "pqHfZKP75CvOlQylNhV4",
};

interface RunOpts {
  jobId: string;
  user_id: string;
  project_id: string;
  language: string;
  voiceId: string;
  voiceKey: string;
  stability: number;
  similarity: number;
  style: number;
  preview: boolean;
  durationSec: number;
}

async function runDub(opts: RunOpts) {
  const url = (Deno.env.get("SUPABASE_URL") || "").replace("mqotnflwrgqppbhjkwyq", "mqotnlflwrgqpbhjkwyq");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, service);
  const setProgress = progressWriter(admin, opts.jobId);
  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");

  try {
    if (!apiKey) throw new Error("ElevenLabs is not connected to this project");
    await startJob(admin, opts.jobId, "Loading captions");

    if (!opts.preview) {
      const q = await consumeQuota(admin, opts.user_id, "dub_seconds", opts.durationSec);
      if (!q.ok) throw new Error(q.message);
    }

    const { data: caps, error: capErr } = await admin
      .from("captions").select("*")
      .eq("project_id", opts.project_id)
      .eq("language", opts.language)
      .maybeSingle();
    if (capErr) throw capErr;
    if (!caps) throw new Error(`No captions found for language "${opts.language}". Translate first.`);

    const rawSegs: Array<{ start?: number; end?: number; text: string }> = caps.segments ?? [];
    let segs = rawSegs
      .map((s) => ({ start: Number(s.start ?? 0), end: Number(s.end ?? 0), text: (s.text ?? "").trim() }))
      .filter((s) => s.text && s.end > s.start);
    if (!segs.length) throw new Error("Caption transcript is empty");
    if (opts.preview) segs = segs.slice(0, Math.min(5, segs.length));

    const parts: Uint8Array[] = [];
    let totalCharacters = 0;

    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      const prev = i > 0 ? segs[i - 1].text : undefined;
      const next = i < segs.length - 1 ? segs[i + 1].text : undefined;

      const pct = 5 + Math.floor(((i + 1) / segs.length) * 90);
      await setProgress(pct, `Synthesizing segment ${i + 1}/${segs.length}`);

      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${opts.voiceId}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            text: seg.text,
            model_id: "eleven_multilingual_v2",
            previous_text: prev,
            next_text: next,
            voice_settings: {
              stability: opts.stability,
              similarity_boost: opts.similarity,
              style: opts.style,
              use_speaker_boost: true,
            },
          }),
        },
      );
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`ElevenLabs ${res.status}: ${errText}`);
      }
      const bytes = new Uint8Array(await res.arrayBuffer());
      parts.push(bytes);
      totalCharacters += seg.text.length;
    }

    await setProgress(96, "Merging audio");
    const totalBytes = parts.reduce((n, p) => n + p.byteLength, 0);
    const merged = new Uint8Array(totalBytes);
    let off = 0;
    for (const p of parts) { merged.set(p, off); off += p.byteLength; }

    await setProgress(98, "Uploading");
    const storagePath = `${opts.user_id}/dubs/${opts.project_id}/el-${opts.language}-${opts.voiceKey}-${Date.now()}.mp3`;
    const up = await admin.storage.from("media").upload(storagePath, merged, {
      contentType: "audio/mpeg", upsert: true,
    });
    if (up.error) throw up.error;

    const signed = await admin.storage.from("media").createSignedUrl(storagePath, 60 * 60 * 24);
    if (signed.error) throw signed.error;

    if (!opts.preview) await deductCredits(admin, opts.user_id, opts.durationSec);

    await succeedJob(admin, opts.jobId, {
      url: signed.data.signedUrl,
      path: storagePath,
      mime: "audio/mpeg",
      segments: segs.length,
      characters: totalCharacters,
      bytes: totalBytes,
      voice: opts.voiceKey,
      provider: "elevenlabs",
      language: opts.language,
      preview: opts.preview,
      credits_charged: opts.preview ? 0 : opts.durationSec,
    }, opts.preview ? "Preview ready" : "Voiceover ready");
  } catch (e) {
    console.error("elevenlabs-dub error:", e);
    await failJob(admin, opts.jobId, e);
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

    const url = (Deno.env.get("SUPABASE_URL") || "").replace("mqotnflwrgqppbhjkwyq", "mqotnlflwrgqpbhjkwyq");
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const admin = makeAdmin();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const project_id: string = body.project_id;
    const language: string = body.language;
    const voiceKey: string = String(body.voice ?? "george").toLowerCase();
    const stability = Math.max(0, Math.min(1, Number(body.stability ?? 0.5)));
    const similarity = Math.max(0, Math.min(1, Number(body.similarity ?? 0.75)));
    const style = Math.max(0, Math.min(1, Number(body.style ?? 0.3)));
    const preview: boolean = !!body.preview;

    if (!project_id || !language) throw new Error("project_id and language are required");
    const voiceId = VOICES[voiceKey];
    if (!voiceId) throw new Error(`invalid voice: ${voiceKey}`);

    const rl = await enforceRateLimit(admin, userData.user.id, "dub-video");
    if (!rl.ok) {
      return new Response(JSON.stringify({ error: rl.message }), {
        status: rl.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: caps } = await supabase.from("captions").select("segments")
      .eq("project_id", project_id).eq("language", language).maybeSingle();
    const segs = ((caps?.segments as any[]) ?? [])
      .map((s: any) => ({ start: Number(s.start ?? 0), end: Number(s.end ?? 0) }))
      .filter((s: any) => s.end > s.start);
    if (!segs.length) throw new Error(`No captions found for language "${language}". Translate first.`);
    const previewSegs = preview ? segs.slice(0, Math.min(5, segs.length)) : segs;
    const durationSec = Math.max(1, Math.ceil((previewSegs[previewSegs.length - 1]?.end ?? 0) - (previewSegs[0]?.start ?? 0)));

    if (!preview) {
      const credit = await requireCredits(admin, userData.user.id, durationSec);
      if (!credit.ok) {
        return new Response(JSON.stringify({ error: credit.message }), {
          status: credit.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const remaining = await peekRemaining(admin, userData.user.id, "dub_seconds");
      if (remaining.remaining < durationSec) {
        return new Response(JSON.stringify({
          error: `Not enough voiceover quota this month (${remaining.remaining}s left, need ${durationSec}s). Upgrade your plan to continue.`,
          kind: "dub_seconds",
        }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const jobId = await createJob(admin, {
      user_id: userData.user.id,
      project_id,
      kind: "dub",
      input: { language, voice: voiceKey, provider: "elevenlabs", stability, similarity, style, preview },
      message: preview ? "Queued preview dub" : "Queued voiceover",
    });

    // @ts-ignore EdgeRuntime is available at runtime
    EdgeRuntime.waitUntil(runDub({
      jobId, user_id: userData.user.id, project_id, language,
      voiceId, voiceKey, stability, similarity, style, preview, durationSec,
    }));

    return new Response(JSON.stringify({ ok: true, queued: true, jobId }), {
      status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("elevenlabs-dub error:", e);
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
