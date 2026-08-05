import { useRef, useState } from "react";
import {
  Music2, Upload, Link2, Play, Pause, Trash2, VolumeX, Volume2,
  Repeat, Waves, Download, Plus, Search,
} from "lucide-react";
import { toast } from "sonner";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MUSIC_LIBRARY } from "@/lib/musicLibrary";
import {
  addTrack, removeTrack, setMusicState, updateTrack, useMusicState, DEFAULT_TRACK,
  type MusicTrack,
} from "@/lib/musicStore";
import { musicEngine } from "@/lib/musicEngine";

type Props = {
  projectId: string;
  videoRef: React.RefObject<HTMLVideoElement>;
};

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export const MusicTab = ({ projectId, videoRef }: Props) => {
  const state = useMusicState(projectId);
  const [search, setSearch] = useState("");
  const [url, setUrl] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const previewRef = useRef<HTMLAudioElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = MUSIC_LIBRARY.filter(
    (t) => !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.mood.toLowerCase().includes(search.toLowerCase()),
  );

  const preview = (id: string, src: string) => {
    if (previewRef.current) { previewRef.current.pause(); previewRef.current = null; }
    if (previewId === id) { setPreviewId(null); return; }
    const a = new Audio(src);
    a.volume = 0.5;
    a.play().catch(() => toast.error("Couldn't preview track"));
    previewRef.current = a;
    setPreviewId(id);
    a.onended = () => setPreviewId(null);
  };

  const addFromLibrary = (name: string, src: string) => {
    const startAt = videoRef.current?.currentTime ?? 0;
    addTrack(projectId, { ...DEFAULT_TRACK, name, src, startAt });
    toast.success(`Added "${name}"`);
  };

  const addFromUrl = () => {
    if (!url.trim()) return;
    try {
      const u = new URL(url);
      addTrack(projectId, { ...DEFAULT_TRACK, name: u.pathname.split("/").pop() || "Track", src: url, startAt: videoRef.current?.currentTime ?? 0 });
      setUrl("");
      toast.success("Track added from URL");
    } catch { toast.error("Please enter a valid URL"); }
  };

  const onUpload = (f: File) => {
    const src = URL.createObjectURL(f);
    addTrack(projectId, { ...DEFAULT_TRACK, name: f.name, src, startAt: videoRef.current?.currentTime ?? 0 });
    toast.success("Track uploaded");
  };

  const doExport = async () => {
    const v = videoRef.current;
    if (!v) return;
    if (!(v as any).captureStream) {
      toast.error("Export not supported in this browser");
      return;
    }
    if (state.tracks.length === 0) {
      toast.error("Add at least one music track first");
      return;
    }
    const videoStream: MediaStream = (v as any).captureStream();
    const audioStream = musicEngine.getExportAudioStream(true);
    if (!audioStream) { toast.error("Audio engine not ready — press play first"); return; }
    const mixed = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...audioStream.getAudioTracks(),
    ]);
    const mime = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m));
    if (!mime) { toast.error("MediaRecorder not supported"); return; }
    const rec = new MediaRecorder(mixed, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
    const chunks: BlobPart[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `video-with-music-${Date.now()}.webm`;
      a.click();
      toast.success("Export ready — file downloaded");
    };
    v.currentTime = 0;
    await v.play().catch(() => {});
    rec.start();
    const stop = () => { try { rec.state === "recording" && rec.stop(); } catch {} v.removeEventListener("ended", stop); };
    v.addEventListener("ended", stop);
    toast("Baking music into video…", { description: "Playing through once to record. Please wait." });
  };

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary"><Music2 className="h-4 w-4" /></span>
          <div>
            <div className="text-sm font-semibold">Background Music</div>
            <div className="text-[10px] text-muted-foreground">{state.tracks.length} track{state.tracks.length !== 1 ? "s" : ""} on timeline</div>
          </div>
        </div>
        <Button size="sm" variant="secondary" onClick={doExport} className="h-8 gap-1.5 text-xs">
          <Download className="h-3.5 w-3.5" /> Bake &amp; Export
        </Button>
      </div>

      {/* Master */}
      <div className="rounded-xl border border-border/70 bg-card/40 p-3 space-y-3">
        <div>
          <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Master music volume</span>
            <span>{Math.round(state.masterVolume * 100)}%</span>
          </div>
          <Slider value={[state.masterVolume * 100]} min={0} max={100} step={1}
            onValueChange={(v) => setMusicState(projectId, (s) => ({ ...s, masterVolume: v[0] / 100 }))} />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><Waves className="h-3 w-3" /> Ducking amount (under speech)</span>
            <span>{Math.round(state.duckAmount * 100)}%</span>
          </div>
          <Slider value={[state.duckAmount * 100]} min={0} max={95} step={1}
            onValueChange={(v) => setMusicState(projectId, (s) => ({ ...s, duckAmount: v[0] / 100 }))} />
        </div>
      </div>

      {/* Active tracks */}
      {state.tracks.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">On Timeline</div>
          {state.tracks.map((t) => (
            <TrackCard key={t.id} track={t} projectId={projectId} />
          ))}
        </div>
      )}

      {/* Add from URL / upload */}
      <div className="rounded-xl border border-dashed border-border/60 p-3 space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Add your own</div>
        <div className="flex gap-2">
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste MP3/WAV URL" className="h-8 text-xs" />
          <Button size="sm" onClick={addFromUrl} className="h-8"><Link2 className="h-3.5 w-3.5" /></Button>
        </div>
        <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="w-full h-8 gap-1.5 text-xs">
          <Upload className="h-3.5 w-3.5" /> Upload from device
        </Button>
      </div>

      {/* Library */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Royalty-free Library</div>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search mood or name…" className="h-8 pl-7 text-xs" />
        </div>
        <div className="max-h-[280px] space-y-1.5 overflow-y-auto pr-1">
          {filtered.map((t) => (
            <div key={t.id} className="group flex items-center gap-2 rounded-lg border border-border/50 bg-card/30 px-2 py-1.5 hover:border-primary/40">
              <button onClick={() => preview(t.id, t.src)} className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary hover:bg-primary/20">
                {previewId === t.id ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium">{t.name}</div>
                <div className="text-[10px] text-muted-foreground">{t.mood} • {fmt(t.duration)}</div>
              </div>
              <button onClick={() => addFromLibrary(t.name, t.src)} className="grid h-7 w-7 place-items-center rounded-md border border-border/60 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-primary hover:border-primary/40" title="Add to timeline">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* -------- Per-track editor card -------- */

const TrackCard = ({ track: t, projectId }: { track: MusicTrack; projectId: string }) => {
  const [open, setOpen] = useState(false);
  const patch = (p: Partial<MusicTrack>) => updateTrack(projectId, t.id, p);
  return (
    <div className="rounded-lg border border-border/60 bg-card/40">
      <div className="flex items-center gap-2 px-2.5 py-2">
        <button onClick={() => patch({ muted: !t.muted })} className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary hover:bg-primary/20" title={t.muted ? "Unmute" : "Mute"}>
          {t.muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
        </button>
        <button onClick={() => setOpen((o) => !o)} className="min-w-0 flex-1 text-left">
          <div className="truncate text-xs font-medium">{t.name}</div>
          <div className="text-[10px] text-muted-foreground">
            vol {Math.round(t.volume * 100)}% • fade {t.fadeIn.toFixed(1)}s/{t.fadeOut.toFixed(1)}s
            {t.loop && " • loop"}{t.duck && " • duck"}
          </div>
        </button>
        <button onClick={() => removeTrack(projectId, t.id)} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:text-destructive" title="Remove">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {open && (
        <div className="space-y-2.5 border-t border-border/60 px-3 py-3">
          <Row label="Volume" value={`${Math.round(t.volume * 100)}%`}>
            <Slider value={[t.volume * 100]} min={0} max={150} step={1} onValueChange={(v) => patch({ volume: v[0] / 100 })} />
          </Row>
          <Row label="Fade in" value={`${t.fadeIn.toFixed(1)}s`}>
            <Slider value={[t.fadeIn * 10]} min={0} max={80} step={1} onValueChange={(v) => patch({ fadeIn: v[0] / 10 })} />
          </Row>
          <Row label="Fade out" value={`${t.fadeOut.toFixed(1)}s`}>
            <Slider value={[t.fadeOut * 10]} min={0} max={80} step={1} onValueChange={(v) => patch({ fadeOut: v[0] / 10 })} />
          </Row>
          <Row label="Start at (video)" value={`${t.startAt.toFixed(1)}s`}>
            <Slider value={[t.startAt * 10]} min={0} max={6000} step={1} onValueChange={(v) => patch({ startAt: v[0] / 10 })} />
          </Row>
          <Row label="Trim start (song)" value={`${t.offset.toFixed(1)}s`}>
            <Slider value={[t.offset * 10]} min={0} max={3000} step={1} onValueChange={(v) => patch({ offset: v[0] / 10 })} />
          </Row>
          <div className="flex items-center justify-between gap-3 pt-1">
            <label className="flex items-center gap-2 text-[11px] text-foreground/80">
              <Switch checked={t.loop} onCheckedChange={(v) => patch({ loop: v })} />
              <Repeat className="h-3 w-3" /> Loop
            </label>
            <label className="flex items-center gap-2 text-[11px] text-foreground/80">
              <Switch checked={t.duck} onCheckedChange={(v) => patch({ duck: v })} />
              <Waves className="h-3 w-3" /> Duck
            </label>
          </div>
        </div>
      )}
    </div>
  );
};

const Row = ({ label, value, children }: { label: string; value: string; children: React.ReactNode }) => (
  <div>
    <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
      <span>{label}</span><span>{value}</span>
    </div>
    {children}
  </div>
);

export default MusicTab;
