// Generates a time-aligned AI voiceover for translated captions.
//
// Runs as a persistent background job: the request returns immediately with
// a jobId and the heavy work continues via EdgeRuntime.waitUntil, writing
// per-segment progress to public.jobs. Clients subscribe by jobId over
// Supabase Realtime and can safely reconnect at any time.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { enforceRateLimit, requireCredits, deductCredits, makeAdmin } from "../_shared/rate-limit.ts";
import { createJob, startJob, progressWriter, succeedJob, failJob } from "../_shared/jobs.ts";
import { consumeQuota, peekRemaining } from "../_shared/quota.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VOICES = new Set(["alloy","echo","fable","onyx","nova","shimmer","ash","sage","coral"]);

const SILENCE_FRAME_B64 =
  "//uQxAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAAcAAAASAAAeVQAUFBQUFBQUFCoqKioqKioqKj8/Pz8/Pz8/P1VVVVVVVVVVVWpqampqampqan9/f39/f39/f5WVlZWVlZWVlaqqqqqqqqqqqr+/v7+/v7+/v9XV1dXV1dXV1erq6urq6urq6v////////////8AAAA5TEFNRTMuMTAwAc0AAAAAAAAAABSAJAaqQgAAgAAAHlXtj+aFAAAAAAD/++DEAAAJfEc59BEAI8OttyM/kwAgIzFwPcQwAsMEBEQBiOgHy8H/E4f/y5///1B///B/////+H//8H/D4Pn8H/Fw+D5//8QBAEAxEAQBAEEwfB8HwfBAEAQBAEAQMBcuD4Pg+D4YCAIAgCH/E4fB8HwfB8Hz/BAEP8CAIB8HwfB8/BAEP//8H+D4Pn+D4Pn8Hwf/g+f/wfB//g+D9YPg+D5+CAIAgGAgCB//B85QEP///B///B8P//B///B///gg";

const silenceBytes = () => Uint8Array.from(atob(SILENCE_FRAME_B64), (c) => c.charCodeAt(0));
const SILENCE_FRAME_DURATION_S = 0.026;

interface RunOpts {
  jobId: string;
  user_id: string;
  project_id: string;
  language: string;
  voice: string;
  globalSpeed: number;
  instructions?: string;
  preview: boolean;
  durationSec: number;
}

async function runDub(opts: RunOpts) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, service);
  const setProgress = progressWriter(admin, opts.jobId);

  try {
    await startJob(admin, opts.jobId, "Loading captions");

    // Meter against the caller's monthly dub quota. Previews are free.
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

    const key = Deno.env.get("OPENAI_API_KEY");
    if (!key) throw new Error("OPENAI_API_KEY missing");

    const isCJK = /^(zh|ja|ko)/i.test(opts.language);
    const baseWps = /^(hi|ur|pa|bn|ta|te|mr|gu|kn|ml|or|as|ne)/i.test(opts.language) ? 2.2
                  : /^(ar|fa|he)/i.test(opts.language) ? 2.3
                  : 2.5;

    const parts: Uint8Array[] = [];
    let cursor = 0;
    const perSegSpeeds: number[] = [];
    let totalCharacters = 0;

    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      if (seg.start > cursor) {
        const gap = seg.start - cursor;
        const framesNeeded = Math.max(0, Math.floor(gap / SILENCE_FRAME_DURATION_S));
        const frame = silenceBytes();
        for (let k = 0; k < framesNeeded; k++) parts.push(frame);
        cursor += framesNeeded * SILENCE_FRAME_DURATION_S;
      }

      const dur = Math.max(0.2, seg.end - seg.start);
      const load = isCJK ? seg.text.replace(/\s+/g, "").length / 4.5
                         : (seg.text.match(/\S+/g)?.length ?? 1);
      const naturalSecs = isCJK ? load : load / baseWps;
      let speed = naturalSecs / dur * opts.globalSpeed;
      speed = Math.max(0.7, Math.min(1.3, isFinite(speed) && speed > 0 ? speed : opts.globalSpeed));
      perSegSpeeds.push(Number(speed.toFixed(2)));
      totalCharacters += seg.text.length;

      // 5% baseline for setup + 90% spread across segments + 5% for upload.
      const pct = 5 + Math.floor(((i + 1) / segs.length) * 90);
      await setProgress(pct, `Synthesizing segment ${i + 1}/${segs.length}`);

      const endpoint = "https://api.openai.com/v1/audio/speech";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "tts-1",
          voice: opts.voice,
          input: seg.text,
          response_format: "mp3",
          speed,
          ...(opts.instructions ? { instructions: opts.instructions } : {}),
        }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`TTS ${res.status}: ${errText}`);
      }
      const bytes = new Uint8Array(await res.arrayBuffer());
      parts.push(bytes);
      cursor = Math.max(cursor, seg.end);
    }

    await setProgress(96, "Merging audio");
    const totalBytes = parts.reduce((n, p) => n + p.byteLength, 0);
    const merged = new Uint8Array(totalBytes);
    let off = 0;
    for (const p of parts) { merged.set(p, off); off += p.byteLength; }

    await setProgress(98, "Uploading");
    const storagePath = `${opts.user_id}/dubs/${opts.project_id}/${opts.language}-${opts.voice}-${Date.now()}.mp3`;
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
      voice: opts.voice,
      language: opts.language,
      preview: opts.preview,
      credits_charged: opts.preview ? 0 : opts.durationSec,
      speed_stats: {
        min: Math.min(...perSegSpeeds),
        max: Math.max(...perSegSpeeds),
        avg: Number((perSegSpeeds.reduce((a, b) => a + b, 0) / perSegSpeeds.length).toFixed(2)),
        clamped_hi: perSegSpeeds.filter((s) => s >= 1.3).length,
        clamped_lo: perSegSpeeds.filter((s) => s <= 0.7).length,
      },
    }, opts.preview ? "Preview ready" : "Voiceover ready");
  } catch (e) {
    console.error("dub-video error:", e);
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

    const url = Deno.env.get("SUPABASE_URL")!;
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
    const voice: string = (body.voice ?? "alloy").toLowerCase();
    const globalSpeed: number = Math.max(0.7, Math.min(1.3, Number(body.speed ?? 1.0)));
    const instructions: string | undefined = body.instructions;
    const preview: boolean = !!body.preview;

    if (!project_id || !language) throw new Error("project_id and language are required");
    if (!VOICES.has(voice)) throw new Error(`invalid voice: ${voice}`);

    const rl = await enforceRateLimit(admin, userData.user.id, "dub-video");
    if (!rl.ok) {
      const { trackRateLimitServer } = await import("../_shared/observability.ts");
      trackRateLimitServer(userData.user.id, { fn: "dub-video", status: rl.status, message: rl.message });
      return new Response(JSON.stringify({ error: rl.message }), {
        status: rl.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pre-check credits + estimate duration cost from captions.
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
        const { trackQuotaExceededServer } = await import("../_shared/observability.ts");
        trackQuotaExceededServer(userData.user.id, { fn: "dub-video", kind: "credits_seconds", needed: durationSec, message: credit.message });
        return new Response(JSON.stringify({ error: credit.message }), {
          status: credit.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const remaining = await peekRemaining(admin, userData.user.id, "dub_seconds");
      if (remaining.remaining < durationSec) {
        const { trackQuotaExceededServer } = await import("../_shared/observability.ts");
        trackQuotaExceededServer(userData.user.id, { fn: "dub-video", kind: "dub_seconds", needed: durationSec, remaining: remaining.remaining, quota: remaining.quota });
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
      input: { language, voice, speed: globalSpeed, preview, instructions: instructions ?? null },
      message: preview ? "Queued preview dub" : "Queued voiceover",
    });

    // @ts-ignore EdgeRuntime is available at runtime
    EdgeRuntime.waitUntil(runDub({
      jobId, user_id: userData.user.id, project_id, language, voice, globalSpeed,
      instructions, preview, durationSec,
    }));

    return new Response(JSON.stringify({ ok: true, queued: true, jobId }), {
      status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("dub-video error:", e);
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
