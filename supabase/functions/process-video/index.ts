import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { burnSubtitles, addAudioAndBurnSubtitles } from "../_shared/ffmpeg-api.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { project_id, operation, srt_text, audio_path } = body;
    if (!project_id) throw new Error("project_id required");

    const { data: project } = await userClient.from("projects").select("*").eq("id", project_id).single();
    if (!project || !project.media_path) throw new Error("project or media not found");

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    
    const { data: file, error: downloadErr } = await admin.storage.from("media").download(project.media_path);
    if (downloadErr || !file) throw new Error("Could not download original media");
    
    let processedBlob: Blob;
    
    if (operation === "burn_subtitles") {
       if (!srt_text) throw new Error("srt_text required for burning subtitles");
       processedBlob = await burnSubtitles(file, srt_text);
    } else if (operation === "dub_and_burn") {
       if (!srt_text) throw new Error("srt_text required for burning subtitles");
       if (!audio_path) throw new Error("audio_path required for dubbing");
       const { data: audioFile, error: audioErr } = await admin.storage.from("media").download(audio_path);
       if (audioErr || !audioFile) throw new Error("Could not download audio file");
       
       processedBlob = await addAudioAndBurnSubtitles(file, audioFile, srt_text);
    } else {
       throw new Error(`Unsupported operation: ${operation}`);
    }
    
    const outPath = `${userData.user.id}/processed-${crypto.randomUUID()}.mp4`;
    const { error: uploadErr } = await admin.storage.from("media").upload(outPath, processedBlob, { contentType: "video/mp4" });
    if (uploadErr) throw uploadErr;
    
    const { data: signed } = await admin.storage.from("media").createSignedUrl(outPath, 60 * 60 * 24);
    
    return new Response(JSON.stringify({ ok: true, media_path: outPath, url: signed?.signedUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    
  } catch (e: any) {
    console.error("process-video error:", e);
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
