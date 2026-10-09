import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { usePlanInfo } from "@/hooks/usePlanInfo";
import { getPlanCapabilities } from "@/lib/plans";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  UploadCloud, Search, Trash2, Copy, Download, Loader2, Type, Image as ImageIcon,
  Music, Video as VideoIcon, Sparkles, Layers, Pencil, Check, X,
} from "lucide-react";

type Category = "font" | "image" | "audio" | "video" | "logo" | "preset";

type Asset = {
  id: string;
  name: string;
  category: Category;
  storage_path: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

const MAX_BYTES = 50 * 1024 * 1024;

const CATS: { key: Category | "all"; label: string; Icon: any }[] = [
  { key: "all", label: "All", Icon: Layers },
  { key: "font", label: "Fonts", Icon: Type },
  { key: "image", label: "Images", Icon: ImageIcon },
  { key: "logo", label: "Logos", Icon: Sparkles },
  { key: "audio", label: "Audio", Icon: Music },
  { key: "video", label: "Video", Icon: VideoIcon },
  { key: "preset", label: "Presets", Icon: Sparkles },
];

const detectCategory = (file: File): Category => {
  const t = file.type;
  const name = file.name.toLowerCase();
  if (t.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|avif)$/.test(name)) {
    return /logo/i.test(name) ? "logo" : "image";
  }
  if (t.startsWith("audio/") || /\.(mp3|wav|ogg|m4a|aac|flac)$/.test(name)) return "audio";
  if (t.startsWith("video/") || /\.(mp4|mov|webm|mkv)$/.test(name)) return "video";
  if (/font|ttf|otf|woff/.test(t) || /\.(ttf|otf|woff2?|eot)$/.test(name)) return "font";
  if (/\.json$/.test(name)) return "preset";
  return "image";
};

const humanSize = (bytes?: number | null) => {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const AssetLibrary = () => {
  const { user } = useAuth();
  const { planId } = usePlanInfo();
  const caps = getPlanCapabilities(planId);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [filter, setFilter] = useState<Category | "all">("all");
  const [query, setQuery] = useState("");
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("user_assets")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setAssets((data as Asset[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [user?.id, load]);

  // Generate signed URLs for image/logo thumbnails
  useEffect(() => {
    const need = assets.filter(
      (a) => (a.category === "image" || a.category === "logo") && a.storage_path && !previews[a.id],
    );
    if (!need.length) return;
    let cancelled = false;
    (async () => {
      const entries: [string, string][] = [];
      for (const a of need) {
        const { data } = await supabase.storage.from("assets").createSignedUrl(a.storage_path!, 3600);
        if (data?.signedUrl) entries.push([a.id, data.signedUrl]);
      }
      if (!cancelled && entries.length) {
        setPreviews((p) => ({ ...p, ...Object.fromEntries(entries) }));
      }
    })();
    return () => { cancelled = true; };
  }, [assets, previews]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter((a) => {
      if (filter !== "all" && a.category !== filter) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        (a.mime_type ?? "").toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q)
      );
    });
  }, [assets, filter, query]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: assets.length };
    for (const a of assets) c[a.category] = (c[a.category] ?? 0) + 1;
    return c;
  }, [assets]);

  const uploadOne = async (file: File) => {
    if (!user) return;
    if (file.size > MAX_BYTES) {
      toast.error(`${file.name}: exceeds 50 MB`);
      return;
    }
    const category = detectCategory(file);

    // Feature gating strictly matching pricing tiers
    if (category === "font" && planId === "starter") {
      toast.error("Custom fonts require the Editor plan or higher", {
        description: "Upgrade your plan to upload and burn custom brand fonts.",
      });
      return;
    }

    if ((category === "logo" || category === "preset") && !caps.canCustomBrand) {
      toast.error("Brand Kits require the Creator or Studio plan", {
        description: "Upgrade to Creator to create and manage reusable Brand Kits.",
      });
      return;
    }

    if (category === "logo" || category === "preset") {
      const currentBrandKits = assets.filter((a) => a.category === "logo" || a.category === "preset").length;
      if (currentBrandKits >= caps.maxBrandKits) {
        toast.error(`Brand Kit limit reached (${caps.maxBrandKits})`, {
          description: `Your ${planId.toUpperCase()} plan allows up to ${caps.maxBrandKits} brand kit assets. Upgrade to Studio for unlimited brand kits.`,
        });
        return;
      }
    }

    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${user.id}/${crypto.randomUUID()}-${safe}`;
    const { error: upErr } = await supabase.storage.from("assets").upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (upErr) {
      toast.error(`${file.name}: ${upErr.message}`);
      return;
    }
    const { data: row, error: insErr } = await supabase
      .from("user_assets")
      .insert({
        user_id: user.id,
        name: file.name,
        category,
        storage_path: path,
        mime_type: file.type || null,
        size_bytes: file.size,
        metadata: {},
      })
      .select("*")
      .single();
    if (insErr) {
      await supabase.storage.from("assets").remove([path]);
      toast.error(`${file.name}: ${insErr.message}`);
      return;
    }
    setAssets((list) => [row as Asset, ...list]);
  };

  const onFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (!arr.length) return;
    setUploading(arr.length);
    setUploadProgress(0);
    try {
      // Sequential upload keeps UI + errors sane
      for (let i = 0; i < arr.length; i++) {
        const fileProgressStart = (i / arr.length) * 100;
        const fileProgressEnd = ((i + 1) / arr.length) * 100;
        
        // Simulating upload progress
        const progressInterval = setInterval(() => {
          setUploadProgress(p => {
            const max = fileProgressEnd - 5;
            return p < max ? p + (max - p) * 0.1 : p;
          });
        }, 200);

        await uploadOne(arr[i]);
        
        clearInterval(progressInterval);
        setUploadProgress(fileProgressEnd);
      }
      toast.success(`${arr.length} asset${arr.length === 1 ? "" : "s"} uploaded`);
    } finally {
      setTimeout(() => {
        setUploading(0);
        setUploadProgress(0);
      }, 500);
    }
  };

  const deleteAsset = async (a: Asset) => {
    if (!confirm(`Delete "${a.name}"? This cannot be undone.`)) return;
    const prev = assets;
    setAssets((list) => list.filter((x) => x.id !== a.id));
    try {
      if (a.storage_path) {
        await supabase.storage.from("assets").remove([a.storage_path]);
      }
      const { error } = await supabase.from("user_assets").delete().eq("id", a.id);
      if (error) throw error;
      toast.success("Deleted");
    } catch (err: any) {
      setAssets(prev);
      toast.error(err?.message ?? "Delete failed");
    }
  };

  const copyLink = async (a: Asset) => {
    if (!a.storage_path) return;
    const { data, error } = await supabase.storage
      .from("assets")
      .createSignedUrl(a.storage_path, 60 * 60 * 24 * 7);
    if (error || !data?.signedUrl) {
      toast.error("Could not create link");
      return;
    }
    try {
      await navigator.clipboard.writeText(data.signedUrl);
      toast.success("Link copied · valid 7 days");
    } catch {
      toast.message(data.signedUrl);
    }
  };

  const downloadAsset = async (a: Asset) => {
    if (!a.storage_path) return;
    const { data, error } = await supabase.storage.from("assets").download(a.storage_path);
    if (error || !data) {
      toast.error("Download failed");
      return;
    }
    const url = URL.createObjectURL(data);
    const link = document.createElement("a");
    link.href = url;
    link.download = a.name;
    link.click();
    URL.revokeObjectURL(url);
  };

  const startRename = (a: Asset) => {
    setRenamingId(a.id);
    setRenameValue(a.name);
  };

  const commitRename = async (a: Asset) => {
    const next = renameValue.trim();
    setRenamingId(null);
    if (!next || next === a.name) return;
    const prev = assets;
    setAssets((list) => list.map((x) => (x.id === a.id ? { ...x, name: next } : x)));
    const { error } = await supabase.from("user_assets").update({ name: next }).eq("id", a.id);
    if (error) {
      setAssets(prev);
      toast.error(error.message);
    }
  };

  const CatIcon = ({ c }: { c: Category }) => {
    const entry = CATS.find((x) => x.key === c);
    const I = entry?.Icon ?? Layers;
    return <I className="h-4 w-4" />;
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-3xl font-semibold">Brand Kits & Asset Library</h1>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary uppercase tracking-wide">
                {planId}
              </span>
            </div>
            <p className="mt-1 text-muted-foreground">
              Upload fonts, logos, watermarks, and caption presets — apply them seamlessly across all projects.
            </p>
          </div>
          <div className="flex items-center gap-4">
            {!caps.canCustomBrand && (
              <Link
                to="/pricing"
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20"
              >
                <Sparkles className="h-3.5 w-3.5" /> Upgrade for Brand Kits
              </Link>
            )}
            <div className="text-xs text-muted-foreground">
              <b className="text-foreground">{assets.length}</b> asset{assets.length === 1 ? "" : "s"} ·{" "}
              {humanSize(assets.reduce((s, a) => s + (a.size_bytes ?? 0), 0))}
            </div>
          </div>
        </header>

        {/* Uploader */}
        <label
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed p-8 text-center transition-colors ${
            dragOver ? "border-primary bg-primary/5" : "border-border bg-card/40 hover:border-primary/50"
          }`}
        >
          {uploading > 0 ? (
            <div className="flex w-full max-w-xs flex-col items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-sm font-medium">Uploading {uploading} file{uploading === 1 ? "" : "s"}…</span>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div 
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${Math.round(uploadProgress)}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">{Math.round(uploadProgress)}%</span>
            </div>
          ) : (
            <>
              <UploadCloud className="mb-2 h-6 w-6 text-primary" />
              <span className="text-sm font-medium">Drop files or click to upload</span>
              <span className="mt-1 text-xs text-muted-foreground">
                Fonts, images, logos, audio, video, or JSON presets · up to 50 MB each
              </span>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) onFiles(e.target.files);
              if (inputRef.current) inputRef.current.value = "";
            }}
          />
        </label>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1.5">
            {CATS.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                {counts[key] > 0 && (
                  <span className={`ml-0.5 rounded-full px-1.5 text-[12px] ${filter === key ? "bg-primary-foreground/20" : "bg-muted/60"}`}>
                    {counts[key]}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2 rounded-full border border-border bg-card/40 px-3 py-1.5 text-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search assets…"
              className="w-40 bg-transparent text-sm outline-none placeholder:text-muted-foreground sm:w-56"
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/30 p-12 text-center text-sm text-muted-foreground">
            {assets.length === 0
              ? "No assets yet — upload your first file above."
              : "No assets match your filters."}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {filtered.map((a) => {
              const preview = previews[a.id];
              const isImage = a.category === "image" || a.category === "logo";
              return (
                <div
                  key={a.id}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card/50 transition-colors hover:border-primary/40"
                >
                  <div className="relative aspect-square w-full bg-gradient-to-br from-muted/40 to-muted/10">
                    {isImage && preview ? (
                      <img
                        src={preview}
                        alt={a.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <CatIcon c={a.category} />
                      </div>
                    )}
                    <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/80 px-2 py-0.5 text-[12px] font-medium capitalize backdrop-blur">
                      <CatIcon c={a.category} />
                      {a.category}
                    </span>
                  </div>
                  <div className="flex min-h-0 flex-col gap-1 p-3">
                    {renamingId === a.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitRename(a);
                            if (e.key === "Escape") setRenamingId(null);
                          }}
                          className="min-w-0 flex-1 rounded border border-border bg-input/60 px-2 py-1 text-xs outline-none focus:border-primary"
                        />
                        <button onClick={() => commitRename(a)} className="rounded p-1 text-primary hover:bg-primary/10">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setRenamingId(null)} className="rounded p-1 text-muted-foreground hover:bg-muted">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startRename(a)}
                        title="Rename"
                        className="truncate text-left text-sm font-medium hover:text-primary"
                      >
                        {a.name}
                      </button>
                    )}
                    <div className="flex items-center justify-between text-[12px] text-muted-foreground">
                      <span>{humanSize(a.size_bytes)}</span>
                      <span>{new Date(a.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => copyLink(a)}
                        title="Copy link"
                        className="flex-1 rounded-md border border-border bg-card px-2 py-1 text-[12px] font-medium text-muted-foreground hover:text-foreground"
                      >
                        <Copy className="mx-auto h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => downloadAsset(a)}
                        title="Download"
                        className="flex-1 rounded-md border border-border bg-card px-2 py-1 text-[12px] font-medium text-muted-foreground hover:text-foreground"
                      >
                        <Download className="mx-auto h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => startRename(a)}
                        title="Rename"
                        className="flex-1 rounded-md border border-border bg-card px-2 py-1 text-[12px] font-medium text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="mx-auto h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => deleteAsset(a)}
                        title="Delete"
                        className="flex-1 rounded-md border border-border bg-card px-2 py-1 text-[12px] font-medium text-muted-foreground hover:border-destructive/50 hover:text-destructive"
                      >
                        <Trash2 className="mx-auto h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AssetLibrary;
