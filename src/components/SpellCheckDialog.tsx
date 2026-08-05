import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Wand2, Loader2, SpellCheck } from "lucide-react";

export type SpellIssue = {
  id: string;
  original: string;
  suggestion: string;
  reason?: string;
  segIdx: number;
  accepted?: boolean;
  rejected?: boolean;
};

type Segment = { start: number; end: number; text: string; words?: any };

export function SpellCheckDialog({
  open, onOpenChange, segments, language, onApply,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  segments: Segment[];
  language?: string;
  onApply: (newSegs: Segment[]) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [issues, setIssues] = useState<SpellIssue[]>([]);
  const [ran, setRan] = useState(false);

  const fullText = useMemo(
    () => segments.map((s, i) => `[${i}] ${s.text}`).join("\n"),
    [segments]
  );

  const runCheck = async () => {
    setLoading(true); setIssues([]); setRan(false);
    try {
      const { data, error } = await supabase.functions.invoke("spellcheck-captions", {
        body: { text: fullText, language },
      });
      if (error) throw error;
      const raw: any[] = data?.issues ?? [];
      const list: SpellIssue[] = raw
        .map((it, i) => {
          // Find which segment the "original" appears in (first match).
          let segIdx = -1;
          for (let k = 0; k < segments.length; k++) {
            if (segments[k].text.includes(it.original)) { segIdx = k; break; }
          }
          if (segIdx < 0) return null;
          return {
            id: `sp-${i}-${segIdx}`,
            original: String(it.original ?? ""),
            suggestion: String(it.suggestion ?? ""),
            reason: it.reason ? String(it.reason) : undefined,
            segIdx,
          };
        })
        .filter(Boolean) as SpellIssue[];
      setIssues(list);
      setRan(true);
      if (list.length === 0) toast.success("No spelling issues found");
    } catch (e: any) {
      toast.error(e?.message ?? "Spell check failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    if (open) void runCheck(); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const setStatus = (id: string, key: "accepted" | "rejected") => {
    setIssues((xs) => xs.map((x) => x.id === id ? { ...x, accepted: key === "accepted", rejected: key === "rejected" } : x));
  };

  const acceptAll = () => setIssues((xs) => xs.map((x) => x.rejected ? x : { ...x, accepted: true }));

  const apply = () => {
    const accepted = issues.filter((i) => i.accepted);
    if (accepted.length === 0) { onOpenChange(false); return; }
    const next = segments.map((s) => ({ ...s }));
    for (const iss of accepted) {
      const seg = next[iss.segIdx]; if (!seg) continue;
      // Replace first occurrence only, preserving surrounding text.
      const idx = seg.text.indexOf(iss.original);
      if (idx < 0) continue;
      seg.text = seg.text.slice(0, idx) + iss.suggestion + seg.text.slice(idx + iss.original.length);
    }
    onApply(next);
    toast.success(`Applied ${accepted.length} fix${accepted.length === 1 ? "" : "es"}`);
    onOpenChange(false);
  };

  const acceptedCount = issues.filter((i) => i.accepted).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SpellCheck className="h-4 w-4" /> Spelling review
          </DialogTitle>
          <DialogDescription>
            Review AI-detected typos before rendering. Accept the ones you want, reject the rest.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div>
            {loading ? "Scanning captions…" : ran ? `${issues.length} issue${issues.length === 1 ? "" : "s"} found` : "Ready"}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={runCheck} disabled={loading}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              <span className="ml-1">Re-scan</span>
            </Button>
            <Button size="sm" variant="ghost" onClick={acceptAll} disabled={loading || issues.length === 0}>
              Accept all
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[360px] pr-3">
          <AnimatePresence initial={false}>
            {loading && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center justify-center py-12 text-sm text-muted-foreground"
              >
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Analyzing…
              </motion.div>
            )}

            {!loading && ran && issues.length === 0 && (
              <motion.div
                key="clean"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-14 text-sm text-muted-foreground"
              >
                <CheckCircle2 className="h-8 w-8 text-green-500 mb-2" />
                Captions look clean.
              </motion.div>
            )}

            {!loading && issues.map((it, idx) => (
              <motion.div
                key={it.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: idx * 0.03 }}
                className={`mb-2 rounded-md border p-3 ${
                  it.accepted ? "border-green-500/40 bg-green-500/5" :
                  it.rejected ? "border-muted opacity-60" : "border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <Badge variant="secondary" className="text-[10px]">Line {it.segIdx + 1}</Badge>
                      {it.reason && <span className="truncate">{it.reason}</span>}
                    </div>
                    <div className="text-sm">
                      <span className="line-through text-red-400">{it.original}</span>
                      <span className="mx-2 text-muted-foreground">→</span>
                      <span className="font-medium text-green-400">{it.suggestion}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm" variant={it.accepted ? "default" : "outline"}
                      className="h-7 px-2"
                      onClick={() => setStatus(it.id, "accepted")}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm" variant={it.rejected ? "secondary" : "outline"}
                      className="h-7 px-2"
                      onClick={() => setStatus(it.id, "rejected")}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </ScrollArea>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={apply} disabled={acceptedCount === 0}>
            Apply {acceptedCount > 0 ? `${acceptedCount} fix${acceptedCount === 1 ? "" : "es"}` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
