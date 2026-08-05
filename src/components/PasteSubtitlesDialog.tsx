import { useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { parseSubtitles, detectFormat, type ParsedSegment } from "@/lib/subtitleParser";
import { ClipboardPaste, Upload, X, FileText } from "lucide-react";

// 200 KB cap prevents someone dumping a novel and locking the editor while it
// parses.  A feature-length film's SRT is ~120 KB.
const MAX_LEN = 200_000;

const inputSchema = z.object({
  raw: z.string().trim().min(1, "Paste some text first").max(MAX_LEN, `Keep under ${MAX_LEN / 1000}KB`),
  language: z.string().trim().min(2, "Language code is required").max(10),
});

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  defaultLanguage: string;
  videoDuration: number;
  onImported: () => Promise<void> | void;
}

export default function PasteSubtitlesDialog({
  open, onClose, projectId, defaultLanguage, videoDuration, onImported,
}: Props) {
  const [raw, setRaw] = useState("");
  const [language, setLanguage] = useState(defaultLanguage || "en");
  const [busy, setBusy] = useState(false);

  const format = useMemo(() => detectFormat(raw), [raw]);
  const preview: ParsedSegment[] = useMemo(
    () => (raw ? parseSubtitles(raw, videoDuration) : []),
    [raw, videoDuration],
  );
  const previewSummary = useMemo(() => {
    if (!preview.length) return null;
    const total = preview[preview.length - 1].end - preview[0].start;
    return { count: preview.length, seconds: total };
  }, [preview]);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setRaw(text.slice(0, MAX_LEN));
    } catch {
      toast.error("Clipboard access denied — paste manually with Ctrl/Cmd+V");
    }
  };

  const handleFile = async (file: File) => {
    if (file.size > MAX_LEN * 2) return toast.error("File too large");
    const text = await file.text();
    setRaw(text.slice(0, MAX_LEN));
  };

  const handleImport = async () => {
    const parsed = inputSchema.safeParse({ raw, language });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    if (!preview.length) return toast.error("No cues detected — check the format");
    setBusy(true);
    try {
      // Build an SRT snapshot for consistency with transcribed captions.
      const srtText = preview.map((s, i) => {
        const fmt = (t: number) => {
          const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = Math.floor(t % 60);
          const ms = Math.floor((t % 1) * 1000);
          return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
        };
        return `${i + 1}\n${fmt(s.start)} --> ${fmt(s.end)}\n${s.text}\n`;
      }).join("\n");

      // Replace any existing caption row for this language so the pasted set is
      // authoritative.  Deleting first keeps the (project_id, language) surface
      // clean without needing a unique constraint.
      await supabase.from("captions").delete().eq("project_id", projectId).eq("language", parsed.data.language);
      const { error } = await supabase.from("captions").insert({
        project_id: projectId,
        language: parsed.data.language,
        provider: "pasted",
        segments: preview as any,
        srt_text: srtText,
      });
      if (error) throw error;
      toast.success(`Imported ${preview.length} cues (${format.toUpperCase()})`);
      await onImported();
      setRaw("");
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Import failed");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <ClipboardPaste className="h-4 w-4 text-primary" />
          <div>
            <div className="text-sm font-semibold">Paste subtitles</div>
            <div className="text-[11px] text-muted-foreground">SRT, WebVTT, or plain text — we'll parse timings automatically.</div>
          </div>
          <button onClick={onClose} aria-label="Close dialog" className="ml-auto rounded-md p-1 hover:bg-muted"><X className="h-4 w-4" aria-hidden="true" /></button>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={handlePaste} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted">
              <ClipboardPaste className="h-3.5 w-3.5" /> Paste from clipboard
            </button>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted">
              <Upload className="h-3.5 w-3.5" /> Load .srt/.vtt/.txt
              <input
                type="file"
                accept=".srt,.vtt,.txt,text/plain,application/x-subrip"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </label>
            <div className="ml-auto flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">Language</span>
              <input
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-16 rounded-md border border-border bg-input/40 px-2 py-1 outline-none focus:border-primary"
                maxLength={10}
              />
            </div>
          </div>

          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value.slice(0, MAX_LEN))}
            placeholder="1&#10;00:00:00,500 --> 00:00:03,000&#10;Welcome to the show...&#10;&#10;— or just paste plain text; we'll spread it evenly across the video."
            className="min-h-[220px] w-full rounded-md border border-border bg-input/40 p-3 font-mono text-[11px] outline-none focus:border-primary"
          />

          <div className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2 text-xs">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Detected:</span>
            <span className="font-semibold uppercase">{format}</span>
            {previewSummary && (
              <>
                <span className="mx-1 text-border">·</span>
                <span className="text-muted-foreground">Cues:</span>
                <span className="font-semibold">{previewSummary.count}</span>
                <span className="mx-1 text-border">·</span>
                <span className="text-muted-foreground">Span:</span>
                <span className="font-semibold">{previewSummary.seconds.toFixed(1)}s</span>
              </>
            )}
            <span className="ml-auto text-muted-foreground">{raw.length}/{MAX_LEN}</span>
          </div>

          {preview.length > 0 && (
            <div className="max-h-40 overflow-auto rounded-md border border-border">
              <table className="w-full text-[11px]">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr><th className="px-2 py-1 text-left">#</th><th className="px-2 py-1 text-left">Start</th><th className="px-2 py-1 text-left">End</th><th className="px-2 py-1 text-left">Text</th></tr>
                </thead>
                <tbody>
                  {preview.slice(0, 20).map((s, i) => (
                    <tr key={i} className="border-t border-border/60">
                      <td className="px-2 py-1 text-muted-foreground">{i + 1}</td>
                      <td className="px-2 py-1 font-mono">{s.start.toFixed(2)}</td>
                      <td className="px-2 py-1 font-mono">{s.end.toFixed(2)}</td>
                      <td className="px-2 py-1 truncate">{s.text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.length > 20 && (
                <div className="border-t border-border bg-muted/20 px-2 py-1 text-[10px] text-muted-foreground">
                  …and {preview.length - 20} more
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-border px-4 py-3">
          <div className="text-[11px] text-muted-foreground">
            This replaces existing captions for <span className="font-mono">{language}</span>.
          </div>
          <button onClick={onClose} className="ml-auto rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted">Cancel</button>
          <button
            onClick={handleImport}
            disabled={busy || !preview.length}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Importing…" : `Import ${preview.length} cues`}
          </button>
        </div>
      </div>
    </div>
  );
}
