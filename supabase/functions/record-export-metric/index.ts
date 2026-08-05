// Records one performance-telemetry row into `public.export_metrics`.
//
// Called by the client after every export attempt — success, failure, or
// cancel. Runs with the caller's JWT so RLS assigns rows to the right user.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OUTCOMES = new Set(["success", "failure", "canceled"]);
const PATHS = new Set(["demux-decode", "realtime-playback", "mediarecorder-fallback", null]);
const ERR_CATS = new Set(["codec", "decode", "quota", "network", "abort", "unknown", null]);

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
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    if (!OUTCOMES.has(body.outcome)) {
      return new Response(JSON.stringify({ error: "invalid outcome" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!PATHS.has(body.path ?? null)) {
      return new Response(JSON.stringify({ error: "invalid path" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!ERR_CATS.has(body.error_category ?? null)) {
      return new Response(JSON.stringify({ error: "invalid error_category" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const row = {
      user_id: userData.user.id,
      outcome: String(body.outcome),
      path: body.path ?? null,
      browser: body.browser ? String(body.browser).slice(0, 32) : null,
      resolution: String(body.resolution ?? "unknown").slice(0, 16),
      codec: String(body.codec ?? "unknown").slice(0, 64),
      profile: body.profile ? String(body.profile).slice(0, 16) : null,
      level: body.level ? String(body.level).slice(0, 8) : null,
      bitrate: Number.isFinite(body.bitrate) ? Math.min(500_000_000, Math.max(0, Math.round(body.bitrate))) : 0,
      fps_target: Number.isFinite(body.fps_target) ? Math.min(240, Math.max(1, Math.round(body.fps_target))) : 30,
      encode_time_ms: Number.isFinite(body.encode_time_ms) ? Math.max(0, Math.round(body.encode_time_ms)) : 0,
      frames_encoded: Number.isFinite(body.frames_encoded) ? Math.max(0, Math.round(body.frames_encoded)) : null,
      effective_fps: Number.isFinite(body.effective_fps) ? body.effective_fps : null,
      realtime_multiplier: Number.isFinite(body.realtime_multiplier) ? body.realtime_multiplier : null,
      source_duration_sec: Number.isFinite(body.source_duration_sec) ? body.source_duration_sec : null,
      source_width: Number.isFinite(body.source_width) ? Math.round(body.source_width) : null,
      source_height: Number.isFinite(body.source_height) ? Math.round(body.source_height) : null,
      output_bytes: Number.isFinite(body.output_bytes) ? Math.max(0, Math.round(body.output_bytes)) : null,
      error_category: body.error_category ?? null,
      error_message: body.error_message ? String(body.error_message).slice(0, 500) : null,
    };

    const { error } = await supabase.from("export_metrics").insert(row);
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
