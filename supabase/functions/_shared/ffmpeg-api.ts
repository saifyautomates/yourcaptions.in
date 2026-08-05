const FFMPEG_API_KEY_OR_URL = Deno.env.get("FFMPEG_API_KEY");
const FFMPEG_API_AUTH_OR_URL = Deno.env.get("FFMPEG_API_AUTH");

const cleanEnv = (value?: string | null) => (value ?? "").trim();
const extractUrl = (value?: string | null) => {
  const raw = cleanEnv(value);
  const markdown = raw.match(/\((https?:\/\/[^\s)]+)\)/i);
  if (markdown?.[1]) return markdown[1];
  const direct = raw.match(/https?:\/\/[^\s)\]]+/i);
  return direct?.[0] ?? raw;
};
const looksLikeUrl = (value?: string | null) => /^https?:\/\//i.test(extractUrl(value));

export const FFMPEG_API_URL =
  extractUrl(Deno.env.get("FFMPEG_API_URL")) ||
  extractUrl(Deno.env.get("FFMPEG_API_ENDPOINT")) ||
  (looksLikeUrl(FFMPEG_API_KEY_OR_URL) ? extractUrl(FFMPEG_API_KEY_OR_URL) : undefined) ||
  (looksLikeUrl(FFMPEG_API_AUTH_OR_URL) ? extractUrl(FFMPEG_API_AUTH_OR_URL) : undefined);

export const FFMPEG_API_AUTH =
  cleanEnv(Deno.env.get("FFMPEG_API_TOKEN")) ||
  (!looksLikeUrl(FFMPEG_API_AUTH_OR_URL) ? cleanEnv(FFMPEG_API_AUTH_OR_URL) : undefined) ||
  (!looksLikeUrl(FFMPEG_API_KEY_OR_URL) ? cleanEnv(FFMPEG_API_KEY_OR_URL) : undefined);

export function getFfmpegHeaders(): Record<string, string> {
  const authHeader = FFMPEG_API_AUTH
    ? /^(basic|bearer)\s+/i.test(FFMPEG_API_AUTH) ? FFMPEG_API_AUTH : `Basic ${FFMPEG_API_AUTH}`
    : undefined;
  
  const headers: Record<string, string> = {};
  if (authHeader) headers.Authorization = authHeader;
  return headers;
}

export interface FFMpegInput {
  file_path: string;
}

export interface FFMpegOutput {
  file: string;
  maps?: string[];
  options?: string[];
}

export async function processFfmpegDirect(blob: Blob, filename: string, command: string, outputExt: string): Promise<Blob> {
  if (!FFMPEG_API_URL) throw new Error("FFMPEG API is not configured");
  const headers = getFfmpegHeaders();
  
  if (/api\.ffmpeg-api\.com/i.test(FFMPEG_API_URL)) {
     // Use the new API for api.ffmpeg-api.com if we want, but wait, the FormData one is for the fallback.
     // Let's implement the fallback version exactly as repair-media did.
     throw new Error("Direct FormData not supported for api.ffmpeg-api.com here");
  }
  
  const fd = new FormData();
  fd.append("file", blob, filename);
  fd.append("command", command);
  fd.append("output", outputExt);
  
  const res = await fetch(FFMPEG_API_URL, { method: "POST", headers, body: fd });
  if (!res.ok) throw new Error(`FFMPEG API failed: ${res.status} ${await res.text()}`);
  
  const out = await res.blob();
  if (out.size < 2048) throw new Error("FFMPEG API failed: returned an empty file");
  return out;
}

export async function uploadToFfmpegApi(filename: string, blob: Blob | Uint8Array | string): Promise<string> {
  if (!FFMPEG_API_URL) throw new Error("FFMPEG API is not configured");
  
  const headers = getFfmpegHeaders();
  headers["Content-Type"] = "application/json";
  const origin = new URL(FFMPEG_API_URL).origin;
  
  const fileRes = await fetch(`${origin}/file`, {
    method: "POST",
    headers,
    body: JSON.stringify({ file_name: filename }),
  });
  
  if (!fileRes.ok) throw new Error(`FFMPEG API upload init failed: ${fileRes.status} ${await fileRes.text()}`);
  const fileJson = await fileRes.json();
  const filePath = fileJson?.file?.file_path;
  const uploadUrl = fileJson?.upload?.url;
  
  if (!filePath || !uploadUrl) throw new Error("FFMPEG API upload init returned an invalid response");
  
  const uploadRes = await fetch(uploadUrl, { method: "PUT", body: blob });
  if (!uploadRes.ok) throw new Error(`FFMPEG API upload failed: ${uploadRes.status}`);
  
  return filePath;
}

export async function processFfmpegJob(inputs: FFMpegInput[], outputs: FFMpegOutput[]): Promise<string> {
  if (!FFMPEG_API_URL) throw new Error("FFMPEG API is not configured");
  const headers = getFfmpegHeaders();
  headers["Content-Type"] = "application/json";
  const origin = new URL(FFMPEG_API_URL).origin;

  const processRes = await fetch(`${origin}/ffmpeg/process`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      task: { inputs, outputs },
    }),
  });

  if (!processRes.ok) throw new Error(`FFMPEG API processing failed: ${processRes.status} ${await processRes.text()}`);
  const result = await processRes.json();
  
  const findDownloadUrl = (v: any): string | undefined => {
    if (!v) return undefined;
    if (typeof v === "string") return /^https?:\/\//i.test(v) ? v : undefined;
    if (Array.isArray(v)) {
      for (const x of v) { const u = findDownloadUrl(x); if (u) return u; }
      return undefined;
    }
    if (typeof v === "object") {
      for (const k of ["download_url", "url", "output_url", "file_url", "href", "signed_url", "public_url"]) {
        const val = (v as any)[k];
        if (typeof val === "string" && /^https?:\/\//i.test(val)) return val;
      }
      for (const k of ["output", "outputs", "file", "files", "result", "results", "data", "urls", "task"]) {
        const u = findDownloadUrl((v as any)[k]); if (u) return u;
      }
    }
    return undefined;
  };
  
  const downloadUrl = findDownloadUrl(result);
  if (!downloadUrl) throw new Error("Could not find download URL in FFMPEG API response");
  return downloadUrl;
}

export async function burnSubtitles(videoBlob: Blob, subtitlesText: string): Promise<Blob> {
  if (!/api\.ffmpeg-api\.com/i.test(FFMPEG_API_URL!)) {
     // use fallback
     return processFfmpegDirect(videoBlob, "video.mp4", "-i input -map 0:v:0 -map 0:a? -vf subtitles=subtitles.srt -c:v libx264 -preset veryfast -crf 22 -c:a copy -movflags +faststart output.mp4", "mp4");
  }

  const videoPath = await uploadToFfmpegApi("video.mp4", videoBlob);
  const subtitlesPath = await uploadToFfmpegApi("subtitles.srt", subtitlesText);
  
  const downloadUrl = await processFfmpegJob(
    [
      { file_path: videoPath }
    ],
    [
      {
        file: "output.mp4",
        maps: ["0:v", "0:a?"],
        options: [
          "-vf", `subtitles=${subtitlesPath}`,
          "-c:a", "copy",
          "-c:v", "libx264", "-preset", "veryfast", "-crf", "22",
          "-movflags", "+faststart"
        ],
      }
    ]
  );
  
  const outRes = await fetch(downloadUrl);
  if (!outRes.ok) throw new Error(`Media processing download failed: ${outRes.status}`);
  return await outRes.blob();
}

export async function processVideoAudio(videoBlob: Blob, command: string, outputExt: string): Promise<Blob> {
    if (!/api\.ffmpeg-api\.com/i.test(FFMPEG_API_URL!)) {
       return processFfmpegDirect(videoBlob, "input.mp4", command, outputExt);
    }
    
    // We can't do arbitrary commands easily via inputs/outputs array if it's very custom,
    // but we can parse simple ones or just throw.
    throw new Error("processVideoAudio via api.ffmpeg-api.com needs explicit maps and options");
}
