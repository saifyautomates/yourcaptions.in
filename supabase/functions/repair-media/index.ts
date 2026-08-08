import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") || "").replace("mqotnflwrgqppbhjkwyq", "mqotnlflwrgqpbhjkwyq");
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
import { FFMPEG_API_URL, FFMPEG_API_AUTH, getFfmpegHeaders, uploadToFfmpegApi, processFfmpegJob, processFfmpegDirect } from "../_shared/ffmpeg-api.ts";
const VIDEO_EXT_RE = /\.(mp4|mov|m4v|webm|mkv|avi|wmv|flv)$/i;
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

async function convertToBrowserMp4(blob: Blob, filename: string): Promise<Blob> {
  if (!FFMPEG_API_URL) throw new Error("Media repair converter is not configured");

  if (/api\\.ffmpeg-api\\.com/i.test(FFMPEG_API_URL)) {
    const filePath = await uploadToFfmpegApi(filename, blob);
    const downloadUrl = await processFfmpegJob(
      [{ file_path: filePath }],
      [{
        file: "output.mp4",
        maps: ["0:v:0", "0:a?"],
        options: [
          "-c:v", "libx264", "-preset", "veryfast", "-crf", "22",
          "-pix_fmt", "yuv420p", "-profile:v", "baseline", "-level", "3.1",
          "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2",
          "-movflags", "+faststart",
        ],
      }]
    );
    const outRes = await fetch(downloadUrl);
    if (!outRes.ok) throw new Error(`Media repair download failed: ${outRes.status}`);
    const out = await outRes.blob();
    if (out.size < 2048) throw new Error("Media repair failed: converter returned an empty file");
    return new Blob([out], { type: "video/mp4" });
  }
  
  return await processFfmpegDirect(blob, filename, "-i input -map 0:v:0 -map 0:a? -c:v libx264 -preset veryfast -crf 22 -pix_fmt yuv420p -profile:v baseline -level 3.1 -c:a aac -b:a 128k -ar 44100 -ac 2 -movflags +faststart output.mp4", "mp4");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { project_id } = await req.json();
    if (!project_id) throw new Error("project_id required");

    // RLS-scoped read: owner/admin policies decide whether this user can repair this project.
    const { data: visibleProject, error: visibleErr } = await userClient
      .from("projects")
      .select("id, user_id, media_path")
      .eq("id", project_id)
      .maybeSingle();
    if (visibleErr || !visibleProject) {
      return new Response(JSON.stringify({ error: "project not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!visibleProject.media_path || !VIDEO_EXT_RE.test(visibleProject.media_path)) {
      return new Response(JSON.stringify({ error: "project has no repairable video" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: file, error: downloadErr } = await withTimeout(
      admin.storage.from("media").download(visibleProject.media_path),
      60_000,
      "Media download",
    );
    if (downloadErr || !file) throw new Error("Original media could not be downloaded");

    const originalName = visibleProject.media_path.split("/").pop() ?? "video.mp4";
    const fixed = await withTimeout(convertToBrowserMp4(file, originalName), 240_000, "Media repair");
    const repairedPath = `${visibleProject.user_id}/repaired-${crypto.randomUUID()}.mp4`;

    const { error: uploadErr } = await admin.storage.from("media").upload(repairedPath, fixed, {
      contentType: "video/mp4",
      upsert: false,
    });
    if (uploadErr) throw uploadErr;

    const { error: updateErr } = await admin
      .from("projects")
      .update({ media_path: repairedPath, error_message: null })
      .eq("id", project_id);
    if (updateErr) throw updateErr;

    try {
      await admin.storage.from("media").remove([visibleProject.media_path]);
    } catch (_) {
      // Non-blocking cleanup; repaired media is already active.
    }

    const { data: signed } = await admin.storage.from("media").createSignedUrl(repairedPath, 60 * 60);
    return new Response(JSON.stringify({ ok: true, media_path: repairedPath, signedUrl: signed?.signedUrl ?? null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("repair-media error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});