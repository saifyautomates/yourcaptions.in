import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { Upload, CheckCircle2, Trash2, Loader2, Video } from "lucide-react";
import { supabase as sb } from "@/integrations/supabase/client";
const supabase = sb as any;
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { DashboardLayout } from "@/components/DashboardLayout";
import { LoadingOverlay } from "@/components/LoadingOverlay";

type Orientation = "portrait" | "landscape";
type Row = {
  id: string;
  video_url: string;
  storage_path: string | null;
  label: string | null;
  orientation: Orientation;
  is_active: boolean;
  created_at: string;
};

const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10; // ~10 years

export default function AdminHero() {
  const { isAdmin, loading } = useIsAdmin();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [label, setLabel] = useState("");
  const [orientation, setOrientation] = useState<Orientation>("portrait");

  const load = async () => {
    setBusy(true);
    const { data, error } = await supabase
      .from("hero_media")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setRows((data ?? []) as Row[]);
    setBusy(false);
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  if (loading) return <LoadingOverlay />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const onUpload = async (file: File) => {
    if (!file.type.startsWith("video/")) return toast.error("Please choose a video file");
    if (file.size > 500 * 1024 * 1024) return toast.error("Max 500 MB");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "mp4";
      const path = `hero/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("hero-media")
        .upload(path, file, { contentType: file.type, cacheControl: "31536000" });
      if (upErr) throw upErr;
      const { data: signed, error: sErr } = await supabase.storage
        .from("hero-media")
        .createSignedUrl(path, SIGNED_URL_TTL);
      if (sErr || !signed?.signedUrl) throw sErr ?? new Error("Failed to sign URL");

      const { data: user } = await supabase.auth.getUser();
      const { error: insErr } = await supabase.from("hero_media").insert({
        video_url: signed.signedUrl,
        storage_path: path,
        label: label || file.name,
        orientation,
        is_active: true,
        uploaded_by: user.user?.id ?? null,
      });
      if (insErr) throw insErr;
      toast.success("Hero video uploaded & activated");
      setLabel("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const activate = async (id: string) => {
    const { error } = await supabase.from("hero_media").update({ is_active: true }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Activated");
    load();
  };

  const remove = async (row: Row) => {
    if (!confirm("Delete this hero video?")) return;
    if (row.storage_path) {
      await supabase.storage.from("hero-media").remove([row.storage_path]);
    }
    const { error } = await supabase.from("hero_media").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-8 p-6">
        <header>
          <h1 className="font-display text-3xl font-bold tracking-tight">Homepage hero video</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Upload a vertical video (9:16 works best). The active clip becomes the phone showcase on
            the homepage, and visitors can try every caption template on it in real time.
          </p>
        </header>

        <section className="rounded-2xl border border-border/60 bg-card/60 p-6">
          <div className="flex items-center gap-3">
            <Video className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-semibold">Upload new video</h2>
          </div>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (optional)"
            className="mt-4 w-full rounded-md border border-border bg-background/60 px-3 py-2 text-sm"
          />
          <div className="mt-3 flex gap-2">
            {(["portrait", "landscape"] as Orientation[]).map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setOrientation(o)}
                className={`flex-1 rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                  orientation === o
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background/60 text-muted-foreground hover:border-primary/60"
                }`}
              >
                {o === "portrait" ? "Portrait 9:16" : "Landscape 16:9"}
              </button>
            ))}
          </div>
          <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-primary/[0.03] px-6 py-10 text-sm font-medium text-primary transition hover:border-primary/70 hover:bg-primary/[0.06]">
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" /> Choose video (mp4/webm, ≤500 MB)
              </>
            )}
            <input
              type="file"
              accept="video/*"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
                e.currentTarget.value = "";
              }}
            />
          </label>
        </section>

        <section>
          <h2 className="mb-3 font-display text-lg font-semibold">Library</h2>
          {busy && !rows.length ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hero videos yet.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((r) => (
                <div
                  key={r.id}
                  className={`overflow-hidden rounded-xl border bg-card/60 ${
                    r.is_active ? "border-primary/70 shadow-[0_0_0_1px_hsl(var(--primary)/0.4)]" : "border-border/60"
                  }`}
                >
                  <video
                    src={r.video_url}
                    className={`${r.orientation === "landscape" ? "aspect-video" : "aspect-[9/16]"} w-full bg-black object-cover`}
                    controls
                    muted
                    playsInline
                    preload="metadata"
                  />
                  <div className="space-y-2 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{r.label || "Untitled"}</p>
                      {r.is_active && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                          <CheckCircle2 className="h-3 w-3" /> Active
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                    </p>
                    <div className="flex gap-2">
                      {!r.is_active && (
                        <button
                          onClick={() => activate(r.id)}
                          className="flex-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
                        >
                          Make active
                        </button>
                      )}
                      <button
                        onClick={() => remove(r)}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-destructive/60 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
