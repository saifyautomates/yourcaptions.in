import { useEffect, useMemo, useState } from "react";
import { useLibrary, type LibraryCategory, type LibraryItem } from "@/hooks/useLibrary";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useFreeTemplates } from "@/hooks/useFreeTemplates";
import { CAP_PRESETS } from "@/lib/captionStyle";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pencil, Plus, Trash2, Shield, Search, Lock, Unlock } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const CATEGORIES: { key: LibraryCategory; label: string; sample: Record<string, any> }[] = [
  { key: "text", label: "Text", sample: { fontFamily: "Inter", weight: 700, size: 48, color: "#ffffff" } },
  { key: "template", label: "Templates", sample: { base: "#ffffff", accent: "#ef4444", weight: 800, tracking: "0.02em", glow: "0 0 20px rgba(239,68,68,.6)" } },
  { key: "transition", label: "Transitions", sample: { type: "fade", durationMs: 300, easing: "ease-out" } },
  { key: "ai_voice", label: "AI Voices", sample: { provider: "elevenlabs", voice_id: "", language: "en" } },
  { key: "audio", label: "Audio", sample: { url: "", tags: [] } },
];

function CategoryEditor({ category, sample }: { category: LibraryCategory; sample: Record<string, any> }) {
  const { items, loading, create, update, remove } = useLibrary(category);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LibraryItem | null>(null);
  const [name, setName] = useState("");
  const [payload, setPayload] = useState(JSON.stringify(sample, null, 2));
  const [previewUrl, setPreviewUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  const openNew = () => {
    setEditing(null);
    setName("");
    setPayload(JSON.stringify(sample, null, 2));
    setPreviewUrl("");
    setOpen(true);
  };
  const openEdit = (it: LibraryItem) => {
    setEditing(it);
    setName(it.name);
    setPayload(JSON.stringify(it.payload, null, 2));
    setPreviewUrl(it.preview_url ?? "");
    setOpen(true);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const path = `library/${category}/${crypto.randomUUID()}-${file.name}`;
      const { error } = await supabase.storage.from("assets").upload(path, file, { upsert: false });
      if (error) throw error;
      const { data } = await supabase.storage.from("assets").createSignedUrl(path, 60 * 60 * 24 * 365);
      const url = data?.signedUrl ?? path;
      setPreviewUrl(url);
      if (category === "audio") {
        try {
          const p = JSON.parse(payload || "{}");
          p.url = url;
          setPayload(JSON.stringify(p, null, 2));
        } catch {}
      }
      toast({ title: "Uploaded" });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    let parsed: Record<string, any> = {};
    try { parsed = JSON.parse(payload); } catch (e: any) {
      toast({ title: "Invalid JSON", description: e.message, variant: "destructive" });
      return;
    }
    if (!name.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    try {
      if (editing) await update(editing.id, { name, payload: parsed, preview_url: previewUrl || null });
      else await create(name, parsed, previewUrl || undefined);
      toast({ title: editing ? "Updated" : "Added" });
      setOpen(false);
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    }
  };

  const del = async (it: LibraryItem) => {
    if (!confirm(`Delete "${it.name}"?`)) return;
    try { await remove(it.id); toast({ title: "Deleted" }); }
    catch (e: any) { toast({ title: "Delete failed", description: e.message, variant: "destructive" }); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{loading ? "Loading..." : `${items.length} item${items.length === 1 ? "" : "s"}`}</div>
        <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" />Add</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto pr-1">
        {items.map((it) => (
          <div key={it.id} className="group relative rounded-md border bg-card px-3 py-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{it.name}</div>
              <div className="text-[10px] text-muted-foreground truncate font-mono">
                {Object.keys(it.payload || {}).slice(0, 4).join(", ")}
              </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(it)}><Pencil className="w-3.5 h-3.5" /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => del(it)}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
          </div>
        ))}
        {items.length === 0 && !loading && (
          <div className="col-span-full text-center text-xs text-muted-foreground py-8 border border-dashed rounded-md">
            No items yet. Click <b>Add</b> to create one.
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit" : "Add"} {category}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Display name" />
            </div>
            <div>
              <Label>Payload (JSON)</Label>
              <Textarea value={payload} onChange={(e) => setPayload(e.target.value)} rows={8} className="font-mono text-xs" />
            </div>
            {(category === "audio" || category === "ai_voice" || category === "template") && (
              <div>
                <Label>{category === "audio" ? "Audio file" : "Preview asset"}</Label>
                <Input
                  type="file"
                  accept={category === "audio" ? "audio/*" : category === "ai_voice" ? "audio/*" : "image/*"}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
                  disabled={uploading}
                />
                {previewUrl && <div className="mt-1 text-[10px] text-muted-foreground truncate">{previewUrl}</div>}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={uploading}>{editing ? "Save changes" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Admin picker: toggle exactly which templates are free vs premium. */
function FreeTemplatesEditor() {
  const { names, loading, save } = useFreeTemplates();
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDraft(new Set(names.map((n) => n.toLowerCase()))); }, [names]);

  const all = useMemo(
    () => CAP_PRESETS.map((p) => p.name).sort((a, b) => a.localeCompare(b)),
    []
  );
  const filtered = useMemo(
    () => all.filter((n) => n.toLowerCase().includes(query.trim().toLowerCase())),
    [all, query]
  );

  const toggle = (name: string) => {
    setDraft((prev) => {
      const next = new Set(prev);
      const key = name.toLowerCase();
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const validNameSet = useMemo(
    () => new Set(all.map((n) => n.toLowerCase())),
    [all]
  );

  const validate = (finalNames: string[]): string | null => {
    if (finalNames.length < 5) return `Select at least 5 templates (currently ${finalNames.length}).`;
    if (finalNames.length > 6) return `Select at most 6 templates (currently ${finalNames.length}).`;
    const seen = new Set<string>();
    for (const n of finalNames) {
      const key = n.toLowerCase();
      if (!validNameSet.has(key)) return `"${n}" is not a valid template name.`;
      if (seen.has(key)) return `Duplicate entry: "${n}".`;
      seen.add(key);
    }
    return null;
  };

  const commit = async () => {
    const finalNames = all.filter((n) => draft.has(n.toLowerCase()));
    const err = validate(finalNames);
    if (err) {
      toast({ title: "Invalid selection", description: err, variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await save(finalNames);
      toast({ title: "Free templates updated", description: `${finalNames.length} free · ${all.length - finalNames.length} premium` });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const count = draft.size;
  const overLimit = count > 6;
  const underLimit = count < 5;
  const invalid = overLimit || underLimit;
  const helper = overLimit
    ? `Remove ${count - 6} to save.`
    : underLimit
      ? `Add ${5 - count} more to save.`
      : "Ready to save.";

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2">
        <div className="text-xs text-muted-foreground">
          Pick which templates are free for everyone. All other templates require a paid plan.
          Must be <b>5–6</b> free templates.
        </div>
        <div className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
          invalid ? "bg-destructive/20 text-destructive" : "bg-primary/15 text-primary"
        }`}>
          {count} / 5–6
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-md border bg-input/40 px-2.5 py-1.5">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find template"
            className="w-full bg-transparent text-xs outline-none"
          />
        </div>
        <Button size="sm" variant="ghost" onClick={() => setDraft(new Set())}>Clear</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[46vh] overflow-y-auto pr-1">
        {filtered.map((n) => {
          const on = draft.has(n.toLowerCase());
          return (
            <button
              key={n}
              type="button"
              onClick={() => toggle(n)}
              className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-xs transition ${
                on
                  ? "border-primary/60 bg-primary/10 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              <span className="truncate font-medium">{n}</span>
              <span className={`inline-flex h-5 items-center gap-1 rounded-full px-1.5 text-[9px] font-bold uppercase ${
                on ? "bg-primary/20 text-primary" : "bg-warning/15 text-warning"
              }`}>
                {on ? <><Unlock className="h-2.5 w-2.5" /> Free</> : <><Lock className="h-2.5 w-2.5" /> Pro</>}
              </span>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full py-8 text-center text-xs text-muted-foreground border border-dashed rounded-md">
            No templates match "{query}".
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className={`text-[11px] ${invalid ? "text-destructive" : "text-muted-foreground"}`}>
          {loading ? "Loading current setting…" : helper}
        </div>
        <Button size="sm" onClick={commit} disabled={saving || invalid}>
          {saving ? "Saving…" : "Save free tier"}
        </Button>
      </div>
    </div>
  );
}

/**
 * Floating admin-only button that opens a tabbed manager for all editor libraries.
 * Non-admins see nothing.
 */
export function AdminLibraryManager({ defaultCategory }: { defaultCategory?: LibraryCategory } = {}) {
  const { isAdmin, loading } = useIsAdmin();
  const [open, setOpen] = useState(false);
  const initial = useMemo<string>(() => defaultCategory ?? "template", [defaultCategory]);
  if (loading || !isAdmin) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Shield className="w-3.5 h-3.5" /> Manage Library
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Admin · Editor Library</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue={initial}>
          <TabsList className="grid grid-cols-6 w-full">
            {CATEGORIES.map((c) => (
              <TabsTrigger key={c.key} value={c.key}>{c.label}</TabsTrigger>
            ))}
            <TabsTrigger value="free">Free Tier</TabsTrigger>
          </TabsList>
          {CATEGORIES.map((c) => (
            <TabsContent key={c.key} value={c.key} className="pt-3">
              <CategoryEditor category={c.key} sample={c.sample} />
            </TabsContent>
          ))}
          <TabsContent value="free" className="pt-3">
            <FreeTemplatesEditor />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export default AdminLibraryManager;
