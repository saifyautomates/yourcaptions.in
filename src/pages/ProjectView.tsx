import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Download, Play, Pause, Save, Loader2, CheckCircle2, AlertCircle, RefreshCw, Music2, Ban,
  Search, ChevronDown, Volume2, Maximize2, Minimize2, Replace, Sparkles, Zap, Scissors, ArrowLeft, ArrowRight,
  Trash2, ZoomIn, ZoomOut, Type as TypeIcon, Captions as CapIcon, Waves, Home, ChevronRight, ChevronLeft, ChevronUp, Plus, Wand2, Focus, GripVertical,
  Volume1, Settings2, Settings, LayoutGrid, SquareDashed, ClipboardPaste, SpellCheck as SpellCheckIcon, X, RotateCcw, Eraser, Pencil,
} from "lucide-react";
// Heavy panels — lazy-loaded so the initial editor bundle stays small.
// Style panel pulls in every caption template + font preview; music mixer
// pulls in the WebAudio engine; history panel only renders when opened.
const CaptionRightPanel = lazy(() => import("@/components/CaptionRightPanel").then(m => ({ default: m.CaptionRightPanel })));
const MusicMixer = lazy(() => import("@/components/MusicMixer").then(m => ({ default: m.MusicMixer })));
const CaptionHistoryPanel = lazy(() => import("@/components/CaptionHistoryPanel").then(m => ({ default: m.CaptionHistoryPanel })));
import { CAP_PRESETS, CapStyle, DEFAULT_CAP_STYLE, applyTextCase, captionSpanStyle, getVisibleChunk, getVisibleWords, matchImpactTier, normalizeCapStyle, parseImpactWords } from "@/lib/captionStyle";
import { describeCapDiff } from "@/lib/capStyleDiff";
import { getEmojiForWord } from "@/lib/emojiTags";
// runQuickExport is dynamically imported on demand — it pulls in mp4box +
// the WebCodecs export pipeline (~hundreds of KB) which we don't want on
// the initial ProjectView bundle. Load it only when the user hits Export.
const loadQuickExport = () => import("@/lib/quickExport").then((m) => m.runQuickExport);
import { FuturisticLoader } from "@/components/FuturisticLoader";
import { emitAnimSample } from "@/lib/captionAnimMetrics";
import { useAuth } from "@/hooks/useAuth";
import { useHotkeys } from "@/hooks/useHotkeys";
import { CreditsBanner } from "@/components/CreditsBanner";
import { detectRateLimit } from "@/lib/rateLimit";
import { invokeWithRetry } from "@/lib/invokeWithRetry";
import { createRunLog, failWithLog } from "@/lib/runLog";
import { logEditorControlError } from "@/lib/editorControlErrors";
import { logPlaybackError } from "@/lib/playbackErrors";
import { EditorErrorInspector } from "@/components/EditorErrorInspector";
import { startPerfMonitor } from "@/lib/perfMonitor";

// Lazy-load heavy modals/panels — they only mount when the user opens them.
// Keeps initial ProjectView TTI low on mobile / low-end devices.
const SpellCheckDialog = lazy(() => import("@/components/SpellCheckDialog").then(m => ({ default: m.SpellCheckDialog })));
const CaptionReviewPanel = lazy(() => import("@/components/CaptionReviewPanel").then(m => ({ default: m.CaptionReviewPanel })));
const TranscribeCompare = lazy(() => import("@/components/TranscribeCompare").then(m => ({ default: m.TranscribeCompare })));
const ExportModal = lazy(() => import("@/components/ExportModal"));
const DubModal = lazy(() => import("@/components/DubModal"));
const PerfHUD = lazy(() => import("@/components/PerfHUD"));

const WordTimingPreview = lazy(() => import("@/components/WordTimingPreview").then(m => ({ default: m.WordTimingPreview })));
const ShortcutsModal = lazy(() => import("@/components/ShortcutsModal").then(m => ({ default: m.ShortcutsModal })));
const PasteSubtitlesDialog = lazy(() => import("@/components/PasteSubtitlesDialog"));
const ProcessingStatusPanel = lazy(() => import("@/components/ProcessingStatusPanel"));


interface WordTiming { text: string; start: number; end: number; confidence?: number; speaker?: string }
interface Segment { start: number; end: number; text: string; confidence?: number; words?: WordTiming[]; speaker?: string }
interface Caption { id: string; language: string; provider: string | null; segments: Segment[]; srt_text: string | null; }
interface Project { id: string; title: string; status: string; source_language: string; media_path: string | null; error_message: string | null; provider: string; compare_mode: boolean; chosen_provider: string | null; }

import { LANGUAGES_TUPLE as LANGS } from "@/lib/languages";
import { useCredits } from "@/hooks/useCredits";
import UpgradeCTA from "@/components/UpgradeCTA";
import { usePlanInfo } from "@/hooks/usePlanInfo";
import { getPlanCapabilities } from "@/lib/plans";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useFreeTemplates } from "@/hooks/useFreeTemplates";
import { canUseTemplate } from "@/lib/templateGating";
import { useToast } from "@/hooks/use-toast";

const pad2 = (n: number) => String(n).padStart(2, "0");
const pad3 = (n: number) => String(n).padStart(3, "0");
const fmtTime = (s: number, sep: "," | ".", withMs: boolean) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60), ms = Math.floor((s % 1) * 1000);
  return withMs ? `${pad2(h)}:${pad2(m)}:${pad2(sec)}${sep}${pad3(ms)}` : `${pad2(h)}:${pad2(m)}:${pad2(sec)}`;
};
const fmtHMS = (s: number) => fmtTime(s, ".", false);
const fmtRuler = (s: number) => `${pad2(Math.floor(s / 60))}:${pad2(Math.floor(s % 60))}.${String(Math.floor((s%1)*1000)).padStart(3,"0")}`;
const fmtShort = (s: number) => `${Math.floor(s / 60)}:${pad2(Math.floor(s % 60))}`;

const buildCaptions = (segs: Segment[], kind: "srt" | "vtt") => {
  const sep = kind === "srt" ? "," : ".";
  const header = kind === "vtt" ? "WEBVTT\n\n" : "";
  const body = segs.map((s, i) =>
    `${i + 1}\n${fmtTime(s.start, sep, true)} --> ${fmtTime(s.end, sep, true)}\n${s.text}\n`
  ).join("\n");
  return header + body;
};

/* ---------- low-confidence detection & filtering ---------- */
type LowConfMode = "off" | "flag" | "hide";
const wordConf = (w: WordTiming | undefined): number | undefined =>
  w && typeof w.confidence === "number" ? w.confidence : undefined;
const segIsLowConf = (s: Segment, threshold: number): boolean => {
  if (typeof s.confidence === "number" && s.confidence < threshold) return true;
  if (s.words && s.words.length) {
    return s.words.some((w) => {
      const c = wordConf(w);
      return typeof c === "number" && c < threshold;
    });
  }
  return false;
};
const computeLowConf = (segs: Segment[], threshold: number) => {
  const segIdxs = new Set<number>();
  const wordKeys = new Set<string>();
  segs.forEach((s, i) => {
    let flagged = false;
    if (s.words && s.words.length) {
      s.words.forEach((w, wi) => {
        const c = wordConf(w);
        if (typeof c === "number" && c < threshold) { wordKeys.add(`${i}:${wi}`); flagged = true; }
      });
    }
    if (typeof s.confidence === "number" && s.confidence < threshold) flagged = true;
    if (flagged) segIdxs.add(i);
  });
  return { segIdxs, wordKeys };
};
/** Return segs with low-confidence words stripped (or segments dropped entirely). */
const filterLowConf = (segs: Segment[], threshold: number): Segment[] => {
  const out: Segment[] = [];
  for (const s of segs) {
    if (s.words && s.words.length) {
      const keep = s.words.filter((w) => {
        const c = wordConf(w);
        return typeof c !== "number" || c >= threshold;
      });
      if (!keep.length) continue;
      if (typeof s.confidence === "number" && s.confidence < threshold && keep.length === s.words.length) continue;
      out.push({
        ...s,
        start: keep[0].start,
        end: keep[keep.length - 1].end,
        text: keep.map((w) => w.text).join(" "),
        words: keep,
      });
    } else {
      if (typeof s.confidence === "number" && s.confidence < threshold) continue;
      out.push(s);
    }
  }
  return out;
};

/* ---------- fake but consistent waveform based on segments ---------- */
const useWaveform = (segs: Segment[], totalDur: number, bars = 200) => {
  return useMemo(() => {
    if (!totalDur) return [] as number[];
    const arr: number[] = [];
    for (let i = 0; i < bars; i++) {
      const t = (i / bars) * totalDur;
      const inSeg = segs.some((s) => t >= s.start && t <= s.end);
      const base = inSeg ? 0.5 : 0.12;
      const jitter = (Math.sin(i * 12.9898 + 78.233) * 43758.5453) % 1;
      const j = Math.abs(jitter);
      arr.push(Math.max(0.08, Math.min(1, base + (j - 0.5) * (inSeg ? 0.9 : 0.15))));
    }
    return arr;
  }, [segs, totalDur, bars]);
};

/* -------------------------- Top bar -------------------------- */
const EditableTitle = ({ title, onRename }: { title: string; onRename: (t: string) => void }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!editing) setDraft(title); }, [title, editing]);
  useEffect(() => { if (editing) { inputRef.current?.focus(); inputRef.current?.select(); } }, [editing]);
  const commit = () => {
    const t = draft.trim();
    if (t && t !== title) onRename(t);
    setEditing(false);
  };
  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(title); setEditing(false); } }}
        className="min-w-0 max-w-[60vw] rounded-md border border-primary/50 bg-background px-2 py-1.5 text-sm sm:text-lg font-semibold tracking-tight text-foreground outline-none focus:border-primary"
      />
    );
  }
  return (
    <button
      onClick={() => setEditing(true)}
      onDoubleClick={() => setEditing(true)}
      title="Click to rename"
      className="group inline-flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 hover:bg-muted/40"
    >
      <h1 className="truncate text-sm sm:text-lg font-semibold tracking-tight text-foreground">{title || "Untitled"}</h1>
      <Pencil className="h-3 w-3 opacity-0 text-muted-foreground group-hover:opacity-100" />
    </button>
  );
};

const TopBar = ({ title, onRename, onExport, onQuickExport, quickBusy, dirty, saving, onSave, onDelete, deleting, onRerun, rerunning, onPasteSubtitles, onSpellCheck, onResync, resyncing, onResetLayout, creditsBlocked }: {
  title: string;
  onRename: (newTitle: string) => void;
  onExport: () => void;
  onQuickExport: (res: "1080p" | "4k" | "720p" | "1440p") => void;
  quickBusy: boolean;
  dirty: boolean; saving: boolean; onSave: () => void; onDelete: () => void; deleting: boolean;
  onRerun: () => void; rerunning: boolean;
  onPasteSubtitles: () => void;
  onSpellCheck: () => void;
  onResync: () => void; resyncing: boolean;
  onResetLayout: () => void;
  creditsBlocked: boolean;
}) => {
  const { user, signOut } = useAuth();
  const { loading: creditsLoading, balance, planCredits, topupCredits, legacySeconds, isAdmin } = useCredits();
  const initial = (user?.email ?? "U")[0].toUpperCase();
  const name = user?.email?.split("@")[0] ?? "You";
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menuOpen]);

  // Transcription costs 1 credit / minute (see credit_rates). Legacy seconds
  // bucket is still respected for older accounts, so we surface both.
  const transcribeMin = balance + Math.floor(legacySeconds / 60);
  const lowFuel = !isAdmin && !creditsLoading && transcribeMin <= 5;
  const outOfFuel = !isAdmin && !creditsLoading && transcribeMin <= 0;
  const badgeTitle = isAdmin
    ? "Admin — unlimited credits"
    : `Plan: ${planCredits} · Top-up: ${topupCredits}${legacySeconds ? ` · Legacy: ${Math.floor(legacySeconds / 60)} min` : ""}\nTranscription costs 1 credit per minute.`;

  return (
    <header className="flex h-14 sm:h-16 shrink-0 items-center justify-between gap-2 border-b border-border/60 bg-background px-2 sm:px-5">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <Link to="/dashboard" className="inline-flex shrink-0 items-center rounded-xl px-2.5 sm:px-3 py-1.5 text-primary hover:bg-primary/10 transition">
          <span className="text-sm sm:text-base font-bold tracking-tight whitespace-nowrap">Dashboard</span>
        </Link>
        <EditableTitle title={title} onRename={onRename} />
        {dirty && (
          <button onClick={onSave} disabled={saving}
            className="ml-1 sm:ml-2 inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2 sm:px-2.5 py-1.5 text-[13px] font-semibold text-primary disabled:opacity-60">
            <Save className="h-3 w-3" /><span className="hidden sm:inline">{saving ? "Saving…" : "Save"}</span>
          </button>
        )}
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <Link
          to="/pricing"
          title={badgeTitle}
          aria-label={isAdmin ? "Unlimited credits" : `${transcribeMin} transcription minutes remaining`}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[13px] font-semibold tabular-nums transition ${
            isAdmin
              ? "border-warning/60 bg-warning/10 text-warning-foreground"
              : outOfFuel
                ? "border-destructive/60 bg-destructive/15 text-destructive animate-pulse"
                : lowFuel
                  ? "border-warning/60 bg-warning/10 text-warning-foreground"
                  : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
          }`}
        >
          <Sparkles className="h-3 w-3" />
          {creditsLoading ? "…" : isAdmin ? (
            <span>∞ credits</span>
          ) : (
            <>
              <span>{transcribeMin.toLocaleString()}</span>
              <span className="hidden sm:inline text-[14px] font-medium opacity-80">min transcribe</span>
              <span className="sm:hidden text-[14px] font-medium opacity-80">min</span>
            </>
          )}
        </Link>
        <a
          href="/pricing"
          className="hidden sm:inline-flex items-center gap-1 rounded-full border border-primary/50 bg-primary/5 px-2.5 py-1.5 text-[13px] font-semibold text-primary hover:bg-primary/15 transition"
        >
          Upgrade <ArrowRight className="h-3 w-3 -rotate-45" />
        </a>
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/70 pl-0.5 pr-2 py-0.5 hover:border-primary/40 transition"
          >
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-warning/90 text-[13px] font-bold text-foreground">{initial}</span>
            <span className="hidden sm:inline max-w-[100px] truncate text-[13px] font-medium text-foreground">{name}</span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-11 z-50 w-64 overflow-hidden rounded-xl border border-border bg-card p-1 text-[13px] shadow-2xl">
              <div className="px-3 py-2 text-[14px] font-semibold uppercase tracking-wider text-muted-foreground">Export</div>
              <MenuItem icon={<Download className="h-3.5 w-3.5" />} label="Download 1080p" hint="Full HD"
                onClick={() => { setMenuOpen(false); onQuickExport("1080p"); }} disabled={quickBusy} />
              <MenuItem icon={<Download className="h-3.5 w-3.5" />} label="Download 4K" hint="Ultra HD"
                onClick={() => { setMenuOpen(false); onQuickExport("4k"); }} disabled={quickBusy} />
              <MenuItem icon={<Download className="h-3.5 w-3.5" />} label="Download 720p" hint="HD"
                onClick={() => { setMenuOpen(false); onQuickExport("720p"); }} disabled={quickBusy} />
              <MenuItem icon={<Settings2 className="h-3.5 w-3.5" />} label="Advanced export…"
                onClick={() => { setMenuOpen(false); onExport(); }} />
              <div className="my-1 h-px bg-border" />
              <div className="px-3 py-2 text-[14px] font-semibold uppercase tracking-wider text-muted-foreground">Project</div>
              <MenuItem icon={<RefreshCw className={`h-3.5 w-3.5 ${rerunning ? "animate-spin" : ""}`} />} label="Re-run transcription"
                onClick={() => { setMenuOpen(false); onRerun(); }} disabled={rerunning || creditsBlocked}
                hint={creditsBlocked ? "0 credits" : undefined}
                title={creditsBlocked ? "Credits reached 0 — upgrade your plan to re-run transcription. After upgrading, new plan credits are added to your wallet and this action unlocks instantly." : undefined} />
              {creditsBlocked && (
                <div className="px-2 py-1.5">
                  <UpgradeCTA
                    hint="Credits reached 0 — transcription is paused."
                    action="Transcription"
                    compact
                  />
                </div>
              )}
              <MenuItem icon={<Wand2 className={`h-3.5 w-3.5 ${resyncing ? "animate-spin" : ""}`} />} label="Re-sync captions" hint="from timestamps"
                onClick={() => { setMenuOpen(false); onResync(); }} disabled={resyncing} />
              <MenuItem icon={<ClipboardPaste className="h-3.5 w-3.5" />} label="Paste subtitles…"
                onClick={() => { setMenuOpen(false); onPasteSubtitles(); }} />
              <MenuItem icon={<SpellCheckIcon className="h-3.5 w-3.5" />} label="Check spelling…" hint="AI"
                onClick={() => { setMenuOpen(false); onSpellCheck(); }} />
              <MenuItem icon={<LayoutGrid className="h-3.5 w-3.5" />} label="Reset layout" hint="defaults"
                onClick={() => { setMenuOpen(false); onResetLayout(); }} />
              <MenuItem icon={<Trash2 className="h-3.5 w-3.5 text-destructive" />} label={deleting ? "Deleting…" : "Delete project"} destructive
                onClick={() => { setMenuOpen(false); onDelete(); }} disabled={deleting} />
              <div className="my-1 h-px bg-border" />
              <MenuItem icon={<ArrowLeft className="h-3.5 w-3.5" />} label="Sign out"
                onClick={() => { setMenuOpen(false); signOut(); }} />
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

const MenuItem = ({ icon, label, hint, onClick, disabled, destructive, title }: {
  icon: React.ReactNode; label: string; hint?: string;
  onClick: () => void; disabled?: boolean; destructive?: boolean; title?: string;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition hover:bg-muted/50 disabled:opacity-50 ${destructive ? "text-destructive" : ""}`}
  >
    {icon}
    <span className="flex-1 font-medium">{label}</span>
    {hint && <span className="text-[14px] text-muted-foreground">{hint}</span>}
  </button>
);


/* --------------------- Left editor rail --------------------- */
const EditorRail = ({ onCaptions, onFonts, onAudio }: {
  onCaptions?: () => void; onFonts?: () => void; onAudio?: () => void;
}) => (
  <nav className="hidden md:flex w-[68px] shrink-0 flex-col items-center gap-1 border-r border-border/60 bg-background/70 py-3">
    <RailItem icon={CapIcon} label="Captions" active onClick={onCaptions} />
    <RailItem icon={TypeIcon} label="Custom Fonts" onClick={onFonts} />
    <RailItem icon={Music2} label="Audio" soon onClick={onAudio} />
  </nav>
);
const RailItem = ({ icon: Icon, label, active, soon, onClick }: { icon: any; label: string; active?: boolean; soon?: boolean; onClick?: () => void }) => (
  <button
    onClick={onClick}
    className={`relative flex w-14 flex-col items-center gap-1 rounded-lg py-2 text-[14px] font-medium transition ${
      active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
    }`}
  >
    <Icon className="h-4 w-4" />
    <span className="leading-none">{label}</span>
    {soon && <span className="absolute -top-0.5 right-2 rounded-sm bg-warning/20 px-1 text-[14px] font-semibold uppercase text-warning">Soon</span>}
  </button>
);


/* --------------------- Captions loading state --------------------- */
const CaptionsLoadingState = ({ status }: { status: string }) => {
  const isProcessing = status === "processing" || status === "uploading";
  const isFailed = status === "failed";

  // Skeleton rows mirroring the real caption chunk layout (numbered + short text).
  const rows = [4, 3, 5, 4, 3, 4, 5, 4, 3, 4];

  return (
    <div className="relative flex min-h-0 flex-col overflow-hidden border-r border-border/60 bg-background/60">
      {/* Header skeleton to match the real column */}
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">Captions</h2>
          {isProcessing && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[14px] font-semibold text-primary">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              Transcribing
            </span>
          )}
        </div>
        <div className="h-6 w-24 rounded-full bg-muted/40" />
      </div>

      {/* Animated waveform ribbon */}
      {isProcessing && (
        <div className="relative flex h-12 items-end gap-[3px] overflow-hidden border-b border-border/60 bg-gradient-to-b from-primary/[0.04] to-transparent px-4 py-2">
          {Array.from({ length: 56 }).map((_, i) => (
            <span
              key={i}
              className="w-[3px] rounded-full bg-gradient-to-t from-primary/20 via-primary/70 to-primary"
              style={{
                height: `${20 + Math.abs(Math.sin(i * 0.55)) * 70}%`,
                animation: `wavepulse 1.4s ease-in-out ${i * 45}ms infinite`,
              }}
            />
          ))}
          {/* Scanning highlight sweeping over the bars */}
          <span
            className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-primary/25 to-transparent"
            style={{ animation: "captionScan 2.4s linear infinite" }}
          />
        </div>
      )}

      {/* Skeleton rows */}
      <div className="relative min-h-0 flex-1 overflow-hidden px-2 py-2">
        {rows.map((words, i) => (
          <div
            key={i}
            className="mb-1 grid grid-cols-[28px_1fr_20px] items-center gap-2 rounded-lg px-2 py-2"
            style={{ opacity: 1 - i * 0.07 }}
          >
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted/50 text-[13px] font-semibold text-muted-foreground/60">
              {i + 1}
            </span>
            <div className="flex items-center gap-1.5">
              {Array.from({ length: words }).map((_, j) => (
                <span
                  key={j}
                  className="h-3 rounded-md bg-muted/60"
                  style={{
                    width: `${28 + ((i * 7 + j * 13) % 34)}px`,
                    animation: `captionShimmer 1.6s ease-in-out ${(i * 90 + j * 60) % 1400}ms infinite`,
                  }}
                />
              ))}
            </div>
            <span />
          </div>
        ))}

        {/* Bottom fade so long lists feel infinite */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background/95 to-transparent" />
      </div>

      {/* Status footer */}
      <div className="border-t border-border/60 px-4 py-3">
        {isProcessing ? (
          <div className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
            <FuturisticLoader size="sm" inline />
            <span>Transcribing your video…</span>
          </div>
        ) : isFailed ? (
          <div className="flex items-center gap-2 text-[13px] text-destructive">
            <AlertCircle className="h-3.5 w-3.5" /> Transcription failed.
          </div>
        ) : (
          <div className="text-[13px] text-muted-foreground">No captions yet.</div>
        )}
      </div>

      <style>{`
        @keyframes captionShimmer {
          0%, 100% { background-color: hsl(var(--muted) / 0.5); }
          50% { background-color: hsl(var(--primary) / 0.35); }
        }
        @keyframes captionScan {
          0% { transform: translateX(0); }
          100% { transform: translateX(500%); }
        }
        @keyframes wavepulse {
          0%, 100% { transform: scaleY(0.4); opacity: 0.6; }
          50% { transform: scaleY(1); opacity: 1; }
        }
        @keyframes dot {
          0%, 60%, 100% { opacity: 0.25; }
          30% { opacity: 1; }
        }
      `}</style>

    </div>
  );
};

/* --------------------- Captions column --------------------- */
const ModToggle = ({ icon, label, desc, on, onClick, onLabel, onDesc }: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  on?: boolean;
  onClick: () => void;
  onLabel?: string;
  onDesc?: string;
}) => (
  <button
    onClick={onClick}
    className={`mb-1.5 flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
      on ? "border-primary/50 bg-primary/5" : "border-border/60 bg-card/40 hover:border-border hover:bg-muted/30"
    }`}
  >
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${on ? "bg-primary/15 text-primary" : "bg-muted/40 text-muted-foreground"}`}>
      {icon}
    </span>
    <div className="flex-1 min-w-0">
      <div className="text-[14px] font-semibold leading-tight">{on && onLabel ? onLabel : label}</div>
      <div className="text-[10.5px] leading-tight text-muted-foreground truncate">{on && onDesc ? onDesc : desc}</div>
    </div>
    <span
      aria-hidden
      className={`relative inline-flex h-[18px] w-8 shrink-0 items-center rounded-full transition ${on ? "bg-primary" : "bg-muted/60"}`}
    >
      <span className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-background shadow transition-all ${on ? "left-[16px]" : "left-[2px]"}`} />
    </span>
  </button>
);

const WordMenuItem = ({ icon, label, desc, onClick, destructive }: { icon: React.ReactNode; label: string; desc?: string; onClick: () => void; destructive?: boolean }) => (
  <button
    onClick={onClick}
    className={`flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition ${destructive ? "text-destructive hover:bg-destructive/10" : "hover:bg-muted/50"}`}
  >
    <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${destructive ? "bg-destructive/10 text-destructive" : "bg-muted/40 text-primary"}`}>
      {icon}
    </span>
    <span className="flex-1 min-w-0">
      <span className="block text-[14px] font-semibold leading-tight">{label}</span>
      {desc && <span className="block text-[10.5px] leading-tight text-muted-foreground/80">{desc}</span>}
    </span>
  </button>
);


// Templates shown in the Line Styling drawer — subset of CAP_PRESETS matching the reference.
const LINE_STYLE_TEMPLATES = [
  "Kinetic · Viral Flow",
  "Kinetic · 3D Depth Cutout",
  "Reels · 1-Click Karaoke",
  "Reels · Hormozi Punch",
  "Dynamic · Classic Pill",
  "Dynamic · Kinetic Pop",
  "Desi · Karaoke Flow",
  "Desi · Bollywood Hit",
  "Creator · Hormozi Viral",
  "Creator · Raj Shamani Podcast",
  "Ali Abdaal", "Clean Motion", "Double Trouble", "Bubble Style",
  "Hormozi Style", "Editing Skool", "Mr Beast Style 1", "Mr Beast Style 2",
];

const LineStylingDrawer = ({ segIdx, capStyle, setCapStyle, onClose }: {
  segIdx: number;
  capStyle: CapStyle;
  setCapStyle: React.Dispatch<React.SetStateAction<CapStyle>>;
  onClose: () => void;
}) => {
  const [query, setQuery] = useState("");
  const tpls = useMemo(() => {
    const wanted = new Set(LINE_STYLE_TEMPLATES);
    const list = CAP_PRESETS.filter((p) => wanted.has(p.name));
    // Preserve reference order.
    return LINE_STYLE_TEMPLATES.map((n) => list.find((p) => p.name === n)).filter(Boolean) as typeof CAP_PRESETS;
 
  }, []);
  const filteredTpls = query ? tpls.filter((t) => t.name.toLowerCase().includes(query.toLowerCase())) : tpls;

  return (
    <div className="absolute inset-y-0 left-0 z-40 w-[320px] overflow-y-auto border-r border-border bg-background shadow-2xl animate-slide-in-right">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold uppercase tracking-wider">Line Styling</h3>
          <span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-[14px] font-semibold text-primary">Line {segIdx + 1}</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close line styling">
          <Ban className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* Typography — Background toggle */}
      <div className="border-b border-border/60 px-4 py-3">
        <div className="mb-2 text-[14px] font-bold uppercase tracking-wider text-muted-foreground">Typography</div>
        <label className="flex cursor-pointer items-center justify-between rounded-md border border-border bg-card/50 px-3 py-2">
          <span className="text-[13px] font-semibold">BACKGROUND</span>
          <button
            type="button"
            role="switch"
            aria-checked={capStyle.bgOn}
            onClick={() => setCapStyle((s) => ({ ...s, bgOn: !s.bgOn }))}
            className={`relative h-5 w-9 rounded-full transition ${capStyle.bgOn ? "bg-primary" : "bg-muted"}`}
          >
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-background transition ${capStyle.bgOn ? "left-4" : "left-0.5"}`} />
          </button>
        </label>
      </div>

      {/* Position */}
      <div className="border-b border-border/60 px-4 py-3">
        <div className="mb-2 text-[14px] font-bold uppercase tracking-wider text-muted-foreground">Position</div>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center gap-2 rounded-md border border-border bg-input/50 px-2 py-1.5">
            <span className="text-[14px] font-semibold text-muted-foreground">X</span>
            <input
              type="number" min={0} max={100} step={0.1} value={capStyle.posX.toFixed(1)}
              onChange={(e) => setCapStyle((s) => ({ ...s, posX: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) }))}
              className="w-full bg-transparent text-[13px] outline-none"
            />
            <span className="text-[14px] text-muted-foreground">%</span>
          </label>
          <label className="flex items-center gap-2 rounded-md border border-border bg-input/50 px-2 py-1.5">
            <span className="text-[14px] font-semibold text-muted-foreground">Y</span>
            <input
              type="number" min={0} max={100} step={0.1} value={capStyle.posY.toFixed(1)}
              onChange={(e) => setCapStyle((s) => ({ ...s, posY: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) }))}
              className="w-full bg-transparent text-[13px] outline-none"
            />
            <span className="text-[14px] text-muted-foreground">%</span>
          </label>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[14px] text-muted-foreground">X</span>
          <input type="range" min={0} max={100} step={0.1} value={capStyle.posX}
            onChange={(e) => setCapStyle((s) => ({ ...s, posX: parseFloat(e.target.value) }))}
            className="flex-1 accent-primary" />
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-[14px] text-muted-foreground">Y</span>
          <input type="range" min={0} max={100} step={0.1} value={capStyle.posY}
            onChange={(e) => setCapStyle((s) => ({ ...s, posY: parseFloat(e.target.value) }))}
            className="flex-1 accent-primary" />
        </div>
      </div>

      {/* Templates */}
      <div className="border-b border-border/60 px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[14px] font-bold uppercase tracking-wider text-muted-foreground">Templates</div>
        </div>
        <div className="mb-2 flex items-center gap-2 rounded-md border border-border bg-input/50 px-2.5 py-1.5">
          <Search className="h-3 w-3 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search templates…"
            className="w-full bg-transparent text-[13px] outline-none placeholder:text-muted-foreground" />
        </div>
        <div className="grid gap-2">
          {filteredTpls.map((t) => (
            <button
              key={t.name}
              onClick={() => { setCapStyle((s) => ({ ...s, ...t.patch })); toast.success(`Applied "${t.name}"`); }}
              className="rounded-lg border border-border bg-card/60 p-3 text-left transition hover:border-primary/50 hover:bg-card"
            >
              <div className="mb-1 flex items-center justify-between">
                <div className="text-[13px] font-semibold">{t.name}</div>
                <Sparkles className="h-3 w-3 text-primary/70" />
              </div>
              <div
                className="rounded-md bg-background/60 px-3 py-2 text-center"
                style={{
                  fontFamily: (t.patch.fontFamily as string) ?? capStyle.fontFamily,
                  fontWeight: (t.patch.fontWeight as number) ?? 700,
                  color: (t.patch.color as string) ?? "#fff",
                  textTransform: (t.patch.textCase === "upper" ? "uppercase" : "none") as React.CSSProperties["textTransform"],
                }}
              >
                The quick brown fox
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Colors */}
      <div className="px-4 py-3">
        <div className="mb-2 text-[14px] font-bold uppercase tracking-wider text-muted-foreground">Colors</div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[13px] font-semibold">Primary</span>
          <div className="flex items-center gap-2">
            <input type="color" value={capStyle.color} onChange={(e) => setCapStyle((s) => ({ ...s, color: e.target.value, colorMode: "solid" }))}
              className="h-7 w-7 cursor-pointer rounded-md border border-border bg-transparent" />
            <span className="font-mono text-[14px] uppercase text-muted-foreground">{capStyle.color}</span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-semibold">Secondary</span>
          <div className="flex items-center gap-2">
            <input type="color" value={capStyle.gradTo} onChange={(e) => setCapStyle((s) => ({ ...s, gradTo: e.target.value }))}
              className="h-7 w-7 cursor-pointer rounded-md border border-border bg-transparent" />
            <span className="font-mono text-[14px] uppercase text-muted-foreground">{capStyle.gradTo}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const ModToggle_ANCHOR = null; // (used to keep line offsets stable if regenerated)
void ModToggle_ANCHOR;

/* --------------------- Virtualized caption list ---------------------
 * Renders only the caption rows that intersect the scroll viewport,
 * keeping DOM node count bounded on long videos (thousands of segments).
 * Uses dynamic measurement so wrapped multi-line rows still align. */
type CaptionRow = { segIdx: number; chunkIdx: number; text: string; isFirst: boolean; isLast: boolean };
const VirtualCaptionList = memo(({
  rows, segs, activeIdx, editingIdx, editingText, setEditingText,
  commitEdit, cancelEdit, beginEdit, rowMenu, setRowMenu, setWordMenu,
  onSeek, onSplitSeg, onDeleteSeg, setLineStyleFor, activeRowRef,
  emphasized, spotlighted, lowConfWordKeys, lowConfMode,
  flaggedIdxs, flaggedOnly, onClearFlagged, getCaptionSeekTime, filteredEmpty,
}: {
  rows: CaptionRow[];
  segs: Segment[];
  activeIdx: number;
  editingIdx: number | null;
  editingText: string;
  setEditingText: (v: string) => void;
  commitEdit: () => void;
  cancelEdit: () => void;
  beginEdit: (i: number) => void;
  rowMenu: number | null;
  setRowMenu: (v: number | null) => void;
  setWordMenu: (v: { seg: number; wi: number; x: number; y: number } | null) => void;
  onSeek: (t: number) => void;
  onSplitSeg: (i: number, wordIdx?: number) => void;
  onDeleteSeg: (i: number) => void;
  setLineStyleFor: (v: number | null) => void;
  activeRowRef: React.RefObject<HTMLDivElement>;
  emphasized: Set<string>;
  spotlighted: Set<string>;
  lowConfWordKeys: Set<string>;
  lowConfMode: LowConfMode;
  flaggedIdxs?: Set<number>;
  flaggedOnly?: boolean;
  onClearFlagged?: () => void;
  getCaptionSeekTime: (seg: Segment, wordIdx?: number) => number;
  filteredEmpty: boolean;
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 56,
    overscan: 24,
    getItemKey: (i) => `${rows[i].segIdx}-${rows[i].chunkIdx}`,
  });

  // Keep the active caption row centered as playback progresses. Uses the
  // virtualizer's scrollToIndex so off-screen active rows still auto-follow.
  useEffect(() => {
    if (activeIdx < 0) return;
    const idx = rows.findIndex((r) => r.segIdx === activeIdx && r.isFirst);
    if (idx < 0) return;
    virtualizer.scrollToIndex(idx, { align: "center", behavior: "smooth" });
  }, [activeIdx, rows, virtualizer]);

  const items = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
      {flaggedOnly && flaggedIdxs && flaggedIdxs.size > 0 && (
        <div className="mb-2 flex items-center justify-between rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-[13px]">
          <span className="text-warning">
            Reviewing {flaggedIdxs.size} flagged segment{flaggedIdxs.size === 1 ? "" : "s"}
          </span>
          <button
            onClick={() => onClearFlagged?.()}
            className="rounded-md border border-warning/50 bg-background/40 px-2 py-0.5 font-semibold text-warning hover:bg-warning/20"
          >
            Show all
          </button>
        </div>
      )}
      <div style={{ height: totalSize, position: "relative", width: "100%" }}>
        {items.map((v) => {
          const r = rows[v.index];
          if (!r) return null;
          const seg = segs[r.segIdx];
          const isActive = r.segIdx === activeIdx;
          const isEditing = editingIdx === r.segIdx && r.isFirst;
          const menuOpen = rowMenu === r.segIdx && r.isFirst;
          const isFlagged = flaggedIdxs?.has(r.segIdx) ?? false;
          return (
            <div
              key={v.key}
              data-index={v.index}
              ref={(el) => {
                if (el) virtualizer.measureElement(el);
                if (isActive && r.isFirst) {
                  (activeRowRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
                }
              }}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${v.start}px)`,
              }}
            >
              <div
                onClick={() => { if (editingIdx == null) onSeek(seg.start); }}
                onDoubleClick={(e) => { e.stopPropagation(); if (r.isFirst) beginEdit(r.segIdx); }}
                className={`group relative grid grid-cols-[36px_1fr_24px] items-center gap-3 rounded-lg px-3 py-3 transition ${
                  isActive ? "bg-primary/10" : isFlagged ? "bg-warning/5 hover:bg-warning/10" : "hover:bg-card/60"
                } ${!r.isLast ? "mb-0.5" : ""}`}
              >
                {isActive && r.isFirst && (
                  <span className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-primary" />
                )}
                {!isActive && isFlagged && r.isFirst && (
                  <span title="Flagged for review" className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-warning" />
                )}
                {r.isFirst ? (
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[13px] font-semibold tabular-nums ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-[0_0_0_2px_hsl(var(--primary)/.25)]"
                        : "text-muted-foreground/70"
                    }`}
                  >
                    {r.segIdx + 1}
                  </span>
                ) : (
                  <span />
                )}
                {isEditing ? (
                  <div className="flex min-w-0 items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      autoFocus
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
                        else if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
                      }}
                      className="min-w-0 flex-1 rounded-md border border-primary/50 bg-input/60 px-2 py-1.5 text-[14px] text-foreground outline-none focus:border-primary"
                    />
                    <button
                      title="Confirm"
                      onClick={(e) => { e.stopPropagation(); commitEdit(); }}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-primary/20 text-primary hover:bg-primary/30"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      title="Cancel"
                      onClick={(e) => { e.stopPropagation(); cancelEdit(); }}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                    >
                      <Ban className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap text-[14px] leading-[1.5] text-foreground sm:text-[15px]">
                    {r.text ? (
                      r.text.split(/\s+/).filter(Boolean).map((w, absWi) => {
                        const key = `${r.segIdx}:${absWi}`;
                        const isEmph = emphasized.has(key);
                        const isSpot = spotlighted.has(key);
                        const isLowConf = lowConfWordKeys.has(key);
                        const willHide = isLowConf && lowConfMode === "hide";
                        const clean = w.replace(/[^\p{L}\p{N}]/gu, "");
                        const emoji = clean ? getEmojiForWord(clean) : null;
                        const highlighted = !!emoji || isEmph || isSpot || (isLowConf && lowConfMode !== "off");
                        const cls = [
                          "word-chip cursor-pointer select-none touch-manipulation transition-colors duration-150 outline-none inline-flex items-center [-webkit-tap-highlight-color:transparent] focus-visible:ring-2 focus-visible:ring-primary",
                          highlighted
                            ? "rounded-md border px-1.5 py-0.5"
                            : "rounded px-0.5 hover:text-primary",
                          emoji ? "border-primary/40 bg-primary/10 text-primary" : "",
                          isEmph ? "border-warning/50 bg-warning/20 text-warning" : "",
                          isSpot ? "font-black" : "",
                          isLowConf && lowConfMode !== "off"
                            ? "underline decoration-warning decoration-wavy underline-offset-4"
                            : "",
                          willHide ? "line-through opacity-50" : "",
                          !highlighted ? "border-transparent" : "",
                        ].join(" ");
                        return (
                          <button
                            key={absWi}
                            type="button"
                            title="Click to jump · right-click for options"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSeek(getCaptionSeekTime(seg, absWi));
                              setWordMenu(null);
                              setRowMenu(null);
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                              setWordMenu({ seg: r.segIdx, wi: absWi, x: rect.left, y: rect.bottom + 4 });
                              setRowMenu(null);
                            }}
                            className={cls}
                          >
                            {w}{emoji && <span className="ml-1 text-[13px]">{emoji}</span>}
                          </button>
                        );
                      })
                    ) : (
                      <span className="italic text-muted-foreground">empty</span>
                    )}
                  </div>
                )}
                {r.isFirst && !isEditing ? (
                  <div className="relative">
                    <button
                      title="Row options"
                      onClick={(e) => { e.stopPropagation(); setRowMenu(menuOpen ? null : r.segIdx); }}
                      className={`transition ${menuOpen ? "text-foreground" : "text-muted-foreground/60 hover:text-foreground"}`}
                    >
                      <LayoutGrid className="h-4 w-4" strokeWidth={1.75} />
                    </button>
                    {menuOpen && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-6 z-30 w-44 overflow-hidden rounded-lg border border-border bg-card p-1 text-[13px] shadow-2xl"
                      >
                        <button
                          onClick={() => { beginEdit(r.segIdx); }}
                          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted/40"
                        >
                          <TypeIcon className="h-3 w-3 text-primary" /> Edit text
                        </button>
                        <button
                          onClick={() => { setRowMenu(null); onSplitSeg(r.segIdx); toast.success("Line split"); }}
                          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted/40"
                        >
                          <Scissors className="h-3 w-3 text-primary" /> Break line
                        </button>
                        <button
                          onClick={() => { setRowMenu(null); setLineStyleFor(r.segIdx); onSeek(seg.start); }}
                          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted/40"
                        >
                          <Sparkles className="h-3 w-3 text-primary" /> Line styling
                        </button>
                        <div className="my-0.5 h-px bg-border" />
                        <button
                          onClick={() => { setRowMenu(null); onDeleteSeg(r.segIdx); toast.message("Line deleted"); }}
                          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3 w-3" /> Delete line
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <span />
                )}
              </div>
            </div>
          );
        })}
      </div>
      {filteredEmpty && <p className="p-6 text-center text-[13px] text-muted-foreground">No matches.</p>}
    </div>
  );
});
VirtualCaptionList.displayName = "VirtualCaptionList";




const CaptionsColumn = memo(({
  segs, activeIdx, onSeek, onEditText, activeRowRef, uniqueLangs, activeLang, setActiveLang, onTranslate, translating, onOpenDub,
  onSplitSeg, onDeleteSeg, onApplyTool, onDeleteWord, onMoveWord, onReflow,
  emphasized, spotlighted, onToggleWordVisual,
  capStyle, setCapStyle,
  flaggedIdxs, flaggedOnly, onClearFlagged,
  lowConfMode, lowConfThreshold, setLowConf, lowConfWordKeys, lowConfSegIdxs,
  viewMode, setViewMode,
  onAutoFit,
  translateBlocked,
}: {
  segs: Segment[]; activeIdx: number; onSeek: (t: number) => void; onEditText: (i: number, t: string) => void;
  activeRowRef: React.RefObject<HTMLDivElement>;
  uniqueLangs: string[]; activeLang: string; setActiveLang: (v: string) => void;
  onTranslate: (t: string) => void; translating: boolean;
  onOpenDub: () => void;
  onSplitSeg: (i: number, wordIdx?: number) => void;
  onDeleteSeg: (i: number) => void;
  onApplyTool: (tool: "gaps" | "emojis" | "delay" | "punctuation" | "emphasis", value?: number) => void;
  onDeleteWord: (i: number, wi: number) => void;
  onMoveWord: (i: number, wi: number, dir: "prev" | "next") => void;
  onReflow: (opts: { words: number; chars: number; lines: number }) => void;
  emphasized: Set<string>;
  spotlighted: Set<string>;
  onToggleWordVisual: (kind: "emph" | "spot", segIdx: number, wi: number) => void;
  capStyle: CapStyle;
  setCapStyle: React.Dispatch<React.SetStateAction<CapStyle>>;
  flaggedIdxs?: Set<number>;
  flaggedOnly?: boolean;
  onClearFlagged?: () => void;
  lowConfMode: LowConfMode;
  lowConfThreshold: number;
  setLowConf: React.Dispatch<React.SetStateAction<{ mode: LowConfMode; threshold: number }>>;
  lowConfWordKeys: Set<string>;
  lowConfSegIdxs: Set<number>;
  viewMode: "word" | "line";
  setViewMode: (m: "word" | "line") => void;
  onAutoFit?: () => void;
  translateBlocked?: boolean;
}) => {
  const [q, setQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsAnchorRef = useRef<HTMLDivElement>(null);
  const [toolsPanelStyle, setToolsPanelStyle] = useState<React.CSSProperties>({});
  useLayoutEffect(() => {
    if (!toolsOpen) return;
    const compute = () => {
      const anchor = toolsAnchorRef.current;
      if (!anchor) return;
      const col = anchor.closest('[data-testid="captions-column"]') as HTMLElement | null;
      const rect = (col ?? anchor).getBoundingClientRect();
      const anchorRect = anchor.getBoundingClientRect();
      setToolsPanelStyle({
        left: rect.left,
        top: anchorRect.bottom + 6,
        width: rect.width,
        bottom: 0,
      });
    };
    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("scroll", compute, true);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute, true);
    };
  }, [toolsOpen]);
  const [langOpen, setLangOpen] = useState(false);
  const [langQuery, setLangQuery] = useState("");
  const [findOpen, setFindOpen] = useState(false);
  const [findQ, setFindQ] = useState("");
  const [findRepl, setFindRepl] = useState("");
  const [findCase, setFindCase] = useState(false);
  const [findCursor, setFindCursor] = useState(0);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const [rowMenu, setRowMenu] = useState<number | null>(null);
  const [delay, setDelay] = useState(0);
  // Word-level context menu — { segIdx, wi, x, y }.
  const [wordMenu, setWordMenu] = useState<{ seg: number; wi: number; x: number; y: number } | null>(null);
  // Line Styling drawer state — segment index (or null when closed).
  const [lineStyleFor, setLineStyleFor] = useState<number | null>(null);
  // Caption Tools "Display" zone drafts (applied via Apply button).
  const [displayWords, setDisplayWords] = useState<number>(capStyle.wordsPerChunk || 4);
  const [maxChars, setMaxChars] = useState<number>(24);
  const [maxLines, setMaxLines] = useState<number>(2);
  // Action toggle state — mirrors reference "Remove … / Restore …" pill switches.
  const [actionOn, setActionOn] = useState<{ punctuation: boolean; emphasis: boolean; gaps: boolean; emojis: boolean }>({ punctuation: false, emphasis: false, gaps: false, emojis: false });
  const toggleAction = useCallback((key: "punctuation" | "emphasis" | "gaps" | "emojis", label: string) => {
    setActionOn((s) => ({ ...s, [key]: !s[key] }));
    onApplyTool(key);
    toast.success(label);
  }, [onApplyTool]);
  const findMatches = useMemo(() => {
    if (!findQ) return [] as number[];
    const needle = findCase ? findQ : findQ.toLowerCase();
    return segs
      .map((s, i) => ({ hay: findCase ? s.text : s.text.toLowerCase(), i }))
      .filter(({ hay }) => hay.includes(needle))
      .map(({ i }) => i);
  }, [segs, findQ, findCase]);
  const filtered = useMemo(() => {
    const base = segs.map((s, i) => ({ s, i }));
    const afterFlag = flaggedOnly && flaggedIdxs && flaggedIdxs.size
      ? base.filter(({ i }) => flaggedIdxs.has(i))
      : base;
    if (!q) return afterFlag;
    const needle = q.toLowerCase();
    return afterFlag.filter(({ s }) => s.text.toLowerCase().includes(needle));
  }, [segs, q, flaggedOnly, flaggedIdxs]);
  // Row breakdown for the transcript view — memoized so the ~1900-line parent
  // re-rendering on every playhead tick doesn't re-chunk the entire transcript.
  // Render each segment as a single flex-wrapped row of word chips — matches
  // Kalakar/reference UI (SS #1). Prior chunking into 4-word visual rows was
  // creating awkward line breaks (SS #2) that the user explicitly rejected.
  const rows = useMemo(() => {
    const out: { segIdx: number; chunkIdx: number; text: string; isFirst: boolean; isLast: boolean; wordIdx?: number; wordStart?: number }[] = [];
    for (const { s, i } of filtered) {
      if (viewMode === "word") {
        const words = s.text.split(/\s+/).filter(Boolean);
        const dur = Math.max(0.001, s.end - s.start);
        words.forEach((w, wi) => {
          const wt = s.words?.[wi];
          const start = wt ? wt.start : s.start + (wi / Math.max(1, words.length)) * dur;
          out.push({
            segIdx: i, chunkIdx: wi, text: w, wordIdx: wi, wordStart: start,
            isFirst: wi === 0, isLast: wi === words.length - 1,
          });
        });
      } else {
        out.push({ segIdx: i, chunkIdx: 0, text: s.text.trim(), isFirst: true, isLast: true });
      }
    }
    return out;
  }, [filtered, viewMode]);


  const beginEdit = (i: number) => { setEditingIdx(i); setEditingText(segs[i]?.text ?? ""); setRowMenu(null); setWordMenu(null); };
  const commitEdit = () => {
    if (editingIdx == null) return;
    const orig = segs[editingIdx]?.text ?? "";
    if (editingText !== orig) onEditText(editingIdx, editingText);
    setEditingIdx(null);
  };
  const cancelEdit = () => setEditingIdx(null);
  const getCaptionSeekTime = useCallback((seg: Segment, wordIdx = 0) => {
    const exact = seg.words?.[wordIdx]?.start;
    if (typeof exact === "number" && Number.isFinite(exact)) return Math.max(0, exact);

    // Some translated/edited captions only have line timing. In that case,
    // estimate the clicked word's timestamp inside the segment so clicking a
    // later word (for example “DeepLeaf”) does not keep jumping to 0/start.
    const textWords = seg.text.trim().split(/\s+/).filter(Boolean);
    const count = Math.max(1, textWords.length);
    const safeStart = Number.isFinite(seg.start) ? Math.max(0, seg.start) : 0;
    const safeEnd = Number.isFinite(seg.end) && seg.end > safeStart ? seg.end : safeStart;
    const span = safeEnd - safeStart;
    return safeStart + span * Math.min(Math.max(wordIdx, 0), count - 1) / count;
 
  }, []);
  useEffect(() => {
    if (rowMenu == null && wordMenu == null) return;
    const close = () => { setRowMenu(null); setWordMenu(null); };
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [rowMenu, wordMenu]);

  return (
    <div className="flex min-h-0 bg-background/60">
      <div className="relative flex min-h-0 flex-1 flex-col">

      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">

        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">Captions</h2>
          {uniqueLangs.length > 1 && (
          <div className="relative">
            <button onClick={() => setLangOpen((v) => !v)} className="rounded-md bg-muted/40 px-2 py-0.5 text-[14px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">
              {activeLang}
            </button>
            {langOpen && (
              <div className="absolute left-0 top-6 z-30 w-64 overflow-hidden rounded-lg border border-border bg-card text-[13px] shadow-lg">
                <div className="flex items-center gap-2 border-b border-border px-2.5 py-2">
                  <Search className="h-3.5 w-3.5 opacity-60" />
                  <input
                    autoFocus
                    value={langQuery}
                    onChange={(e) => setLangQuery(e.target.value)}
                    placeholder="Search languages…"
                    className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
                  />
                </div>
                <div className="max-h-64 overflow-y-auto p-1">
                  {uniqueLangs
                    .filter((l) => !langQuery || l.toLowerCase().includes(langQuery.toLowerCase()) || (LANGS.find(([c]) => c === l)?.[1] ?? "").toLowerCase().includes(langQuery.toLowerCase()))
                    .map((l) => (
                      <button key={l} onClick={() => { setActiveLang(l); setLangOpen(false); setLangQuery(""); }}
                        className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left hover:bg-muted/40 ${l === activeLang ? "text-primary" : "text-muted-foreground"}`}>
                        <span>{LANGS.find(([c]) => c === l)?.[1] ?? l}</span>
                        <span className="text-[14px] uppercase opacity-60">{l}</span>
                      </button>
                    ))}
                  <div className="my-1 h-px bg-border" />
                  <div className="px-2 py-1.5 text-[14px] font-semibold uppercase text-muted-foreground">Translate to</div>
                  {translateBlocked && (
                    <div className="px-2 pb-1.5">
                      <UpgradeCTA
                        hint="Credits reached 0 — translations are paused."
                        action="Translation"
                        compact
                      />
                    </div>
                  )}
                  {LANGS
                    .filter(([code, name]) => !uniqueLangs.includes(code) && (!langQuery || name.toLowerCase().includes(langQuery.toLowerCase()) || code.toLowerCase().includes(langQuery.toLowerCase())))
                    .slice(0, 60)
                    .map(([code, name]) => (
                      <button
                        key={code}
                        disabled={translating || translateBlocked}
                        onClick={() => { onTranslate(code); setLangOpen(false); setLangQuery(""); }}
                        title={translateBlocked ? `Credits reached 0 — upgrade your plan to translate to ${name}. After upgrading, plan credits are added to your wallet and translations unlock instantly.` : undefined}
                        className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-muted-foreground hover:bg-primary/10 hover:text-primary disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground">
                        <span>{name}</span>
                        <span className="text-[14px] uppercase opacity-60">{code}</span>
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {onAutoFit && (
            <button
              onClick={onAutoFit}
              title="Auto-fit captions panel width to transcript"
              aria-label="Auto-fit captions panel"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-primary/15"
            >
              <Focus className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => { setSearchOpen((v) => !v); setFindOpen(false); }}
            title="Search captions"
            aria-label="Search captions"
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${searchOpen ? "bg-primary/15 text-primary" : "bg-muted/40 text-muted-foreground hover:text-foreground"}`}
          >
            <Search className="h-4 w-4" />
          </button>
          <div className="relative" ref={toolsAnchorRef}>
            <button
              onClick={(e) => { e.stopPropagation(); setToolsOpen((v) => !v); }}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1.5 text-[13px] font-medium text-primary hover:border-primary/50"
            >
              <Settings className="h-3.5 w-3.5" /> Caption Tools <ChevronDown className="h-3 w-3" />
            </button>
            {toolsOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="fixed z-40 flex flex-col overflow-hidden border-l border-border/60 bg-card shadow-2xl animate-fade-in"
                style={toolsPanelStyle}
              >
                <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
                  <div className="flex items-center gap-2 text-[13px] font-semibold">
                    <Settings className="h-3.5 w-3.5 text-primary" /> Caption Tools
                  </div>
                  <button
                    onClick={() => setToolsOpen(false)}
                    aria-label="Close caption tools"
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 text-[13px]">
                  <button
                    onClick={() => { setFindOpen(true); setToolsOpen(false); }}
                    className="mb-1 flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left hover:bg-muted/40"
                  >
                    <Search className="h-3.5 w-3.5 text-primary" />
                    <div className="flex-1">
                      <div className="font-semibold">Find & Replace</div>
                      <div className="text-[14px] text-muted-foreground">Search and replace across captions</div>
                    </div>
                  </button>

                  {/* Zone 1 — Display Settings */}
                  <div className="mb-1 mt-3 border-t border-border/60 pt-3">
                    <div className="mb-2 text-center text-[14px] font-bold uppercase tracking-[0.18em] text-muted-foreground/80">Display Settings</div>
                    <div className="grid grid-cols-3 gap-2 px-1">
                      <label className="flex flex-col gap-1">
                        <span className="pl-0.5 text-[10.5px] text-muted-foreground">Words</span>
                        <div className="relative">
                          <TypeIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-primary" />
                          <select
                            value={displayWords}
                            onChange={(e) => setDisplayWords(parseInt(e.target.value))}
                            className="w-full appearance-none rounded-lg border border-primary/40 bg-card/60 py-1.5 pl-7 pr-6 text-[13px] font-medium outline-none hover:border-primary/70 focus:border-primary"
                          >
                            {[1,2,3,4,5,6,7,8,9,10,12].map((n) => (<option key={n} value={n}>{n === (capStyle.wordsPerChunk||4) ? "Default" : n}</option>))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                        </div>
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="pl-0.5 text-[10.5px] text-muted-foreground">Max Chars</span>
                        <div className="relative flex items-center rounded-lg border border-border/70 bg-card/60 hover:border-border">
                          <TypeIcon className="ml-2.5 h-3 w-3 shrink-0 text-primary" />
                          <input
                            type="number" min={4} max={80}
                            value={maxChars}
                            onChange={(e) => setMaxChars(Math.max(4, Math.min(80, parseInt(e.target.value) || 4)))}
                            className="w-full bg-transparent px-1.5 py-1.5 text-center text-[13px] font-medium outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button
                            type="button"
                            onClick={() => setMaxChars(24)}
                            title="Reset"
                            className="mr-1.5 rounded p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                          >
                            <RotateCcw className="h-3 w-3" />
                          </button>
                        </div>
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="pl-0.5 text-[10.5px] text-muted-foreground">Lines</span>
                        <div className="relative">
                          <LayoutGrid className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-primary" />
                          <select
                            value={maxLines}
                            onChange={(e) => setMaxLines(parseInt(e.target.value))}
                            className="w-full appearance-none rounded-lg border border-border/70 bg-card/60 py-1.5 pl-7 pr-6 text-[13px] font-medium outline-none hover:border-border focus:border-primary"
                          >
                            {[1,2,3,4].map((n) => (<option key={n} value={n}>{n} Line{n>1?"s":""}</option>))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                        </div>
                      </label>
                    </div>
                    <button
                      onClick={() => { onReflow({ words: displayWords, chars: maxChars, lines: maxLines }); setCapStyle((s) => ({ ...s, wordsPerChunk: displayWords })); toast.success("Captions reflowed"); }}
                      className="mt-2.5 w-full rounded-lg bg-primary px-2.5 py-1.5 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      Apply layout
                    </button>
                  </div>

                  {/* Zone 2 — Actions */}
                  <div className="mb-1 mt-3 border-t border-border/60 pt-3">
                    <div className="mb-2 text-center text-[14px] font-bold uppercase tracking-[0.18em] text-muted-foreground/80">Actions</div>
                    <ModToggle
                      icon={<Eraser className="h-3.5 w-3.5" />}
                      label="Remove Punctuation" desc="Strip all punctuation for a cleaner, minimal look"
                      onLabel="Restore Punctuation" onDesc="Add periods, commas, and other punctuation marks back"
                      on={actionOn.punctuation}
                      onClick={() => toggleAction("punctuation", actionOn.punctuation ? "Punctuation restored" : "Punctuation removed")}
                    />
                    <ModToggle
                      icon={<Eraser className="h-3.5 w-3.5" />}
                      label="Remove Emphasis" desc="Remove all text emphasis for uniform appearance"
                      onLabel="Restore Emphasis" onDesc="Bring back bold, italic, and highlighted text styling"
                      on={actionOn.emphasis}
                      onClick={() => toggleAction("emphasis", actionOn.emphasis ? "Emphasis restored" : "Emphasis cleared")}
                    />
                    <ModToggle
                      icon={<Eraser className="h-3.5 w-3.5" />}
                      label="Remove Gaps in Captions" desc="Eliminate gaps between captions for seamless flow"
                      onLabel="Restore Gaps in Captions" onDesc="Add gaps back between captions"
                      on={actionOn.gaps}
                      onClick={() => toggleAction("gaps", actionOn.gaps ? "Gaps restored" : "Gaps removed")}
                    />
                    <ModToggle
                      icon={<Eraser className="h-3.5 w-3.5" />}
                      label="Remove Emojis" desc="Remove all emojis from captions"
                      onLabel="Restore Emojis" onDesc="Bring emojis back into captions"
                      on={actionOn.emojis}
                      onClick={() => toggleAction("emojis", actionOn.emojis ? "Emojis restored" : "Emojis removed")}
                    />
                  </div>

                  {/* Zone 3 — Timing header (parity with reference) */}
                  <div className="mt-3 border-t border-border/60 pt-3">
                    <div className="mb-1 text-center text-[14px] font-bold uppercase tracking-[0.18em] text-muted-foreground/80">Timing</div>
                  </div>


                  {/* Zone 2b — Low-confidence review */}
                  <div className="mt-2 border-t border-border/60 pt-2">
                    <div className="mb-1 flex items-center justify-between px-1">
                      <div className="text-[13px] font-bold uppercase tracking-wider text-muted-foreground/80">Low-confidence review</div>
                      <span className="rounded-full bg-warning/15 px-1.5 py-0.5 text-[13px] font-semibold text-warning">
                        {lowConfSegIdxs.size} seg · {lowConfWordKeys.size} words
                      </span>
                    </div>
                    <div className="rounded-md bg-warning/5 p-2.5">
                      <div className="mb-1.5 grid grid-cols-3 gap-1 text-[14px]">
                        {(["off", "flag", "hide"] as LowConfMode[]).map((m) => (
                          <button
                            key={m}
                            onClick={() => setLowConf((s) => ({ ...s, mode: m }))}
                            className={`rounded-md px-2 py-1.5 font-semibold capitalize transition ${
                              lowConfMode === m
                                ? "bg-warning text-black"
                                : "border border-warning/30 text-warning hover:bg-warning/10"
                            }`}
                          >
                            {m === "off" ? "Off" : m === "flag" ? "Flag" : "Hide"}
                          </button>
                        ))}
                      </div>
                      <div className="mb-1 flex items-center gap-2">
                        <div className="flex-1 text-[14px] text-muted-foreground">Threshold</div>
                        <span className="font-mono text-[14px] text-warning">
                          {Math.round(lowConfThreshold * 100)}%
                        </span>
                      </div>
                      <input
                        type="range" min={0} max={1} step={0.05} value={lowConfThreshold}
                        onChange={(e) => setLowConf((s) => ({ ...s, threshold: parseFloat(e.target.value) }))}
                        className="w-full accent-warning"
                      />
                      <div className="mt-0.5 flex justify-between text-[13px] text-muted-foreground/70"><span>0%</span><span>60%</span><span>100%</span></div>
                      <div className="mt-2 text-[14px] leading-snug text-muted-foreground">
                        {lowConfMode === "off" && "No visual marks. Turn on Flag to review, Hide to also drop from exports."}
                        {lowConfMode === "flag" && "Low-confidence words show a wavy amber underline; segments get an amber bar."}
                        {lowConfMode === "hide" && "Words below the threshold are struck through in the editor and removed from saved SRT and exports."}
                      </div>
                    </div>
                  </div>

                  {/* Zone 3 — Timeline Correction Engine */}
                  <div className="mt-2 border-t border-border/60 pt-2">
                    <div className="mb-1 px-1 text-[13px] font-bold uppercase tracking-wider text-muted-foreground/80">Timeline Correction</div>
                    <div className="rounded-md bg-primary/5 p-2.5">
                      <div className="mb-1.5 flex items-center gap-2">
                        <Zap className="h-3.5 w-3.5 text-primary" />
                        <div className="flex-1 font-semibold">Caption Delay Control</div>
                        <span className="font-mono text-[14px] text-primary">{delay >= 0 ? `+${delay.toFixed(1)}s` : `${delay.toFixed(1)}s`}</span>
                        <button onClick={() => setDelay(0)} title="Reset" className="text-muted-foreground hover:text-foreground">
                          <RefreshCw className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="mb-1 text-[14px] text-muted-foreground">Shift all captions earlier or later in time</div>
                      <input
                        type="range" min={-5} max={5} step={0.1} value={delay}
                        onChange={(e) => {
                          const next = parseFloat(e.target.value);
                          const d = next - delay;
                          if (d !== 0) onApplyTool("delay", d);
                          setDelay(next);
                        }}
                        onDoubleClick={() => { if (delay !== 0) { onApplyTool("delay", -delay); setDelay(0); } }}
                        className="w-full accent-primary"
                      />
                      <div className="flex justify-between text-[13px] text-muted-foreground/70"><span>-5s</span><span>0</span><span>+5s</span></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {findOpen && (
        <div className="border-b border-border/60 bg-card/40 px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[14px] font-bold uppercase tracking-wider text-muted-foreground">
              <Search className="h-3 w-3" /> Find & Replace
            </div>
            <button onClick={() => { setFindOpen(false); setFindQ(""); setFindRepl(""); }} className="text-muted-foreground hover:text-foreground">
              <Ban className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mb-2 text-[14px] font-semibold uppercase tracking-wider text-muted-foreground/70">Find</div>
          <div className="mb-2 flex items-center gap-2 rounded-md border border-border bg-input/50 px-2.5 py-1.5">
            <input value={findQ} onChange={(e) => { setFindQ(e.target.value); setFindCursor(0); }} placeholder=""
              className="w-full bg-transparent text-[13px] outline-none" />
            <button onClick={() => setFindCase((v) => !v)} title="Match case"
              className={`rounded px-1.5 py-0.5 text-[14px] font-bold ${findCase ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}>Aa</button>
            <span className="text-[14px] tabular-nums text-muted-foreground">{findMatches.length ? `${Math.min(findCursor + 1, findMatches.length)}/${findMatches.length}` : "0/0"}</span>
            <button disabled={!findMatches.length} onClick={() => { const n = (findCursor - 1 + findMatches.length) % findMatches.length; setFindCursor(n); onSeek(segs[findMatches[n]].start); }} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
              <ArrowLeft className="h-3 w-3 rotate-90" />
            </button>
            <button disabled={!findMatches.length} onClick={() => { const n = (findCursor + 1) % findMatches.length; setFindCursor(n); onSeek(segs[findMatches[n]].start); }} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
              <ArrowRight className="h-3 w-3 rotate-90" />
            </button>
          </div>
          <div className="mb-2 text-[14px] font-semibold uppercase tracking-wider text-muted-foreground/70">Replace with</div>
          <div className="mb-2 flex items-center gap-2 rounded-md border border-border bg-input/50 px-2.5 py-1.5">
            <input value={findRepl} onChange={(e) => setFindRepl(e.target.value)} placeholder="Type replacement…"
              className="w-full bg-transparent text-[13px] outline-none placeholder:text-muted-foreground" />
          </div>
          {findQ && findMatches.length === 0 && (
            <div className="mb-2 text-[14px] font-semibold text-destructive">No matches found</div>
          )}
          <div className="flex items-center justify-end gap-2">
            <button disabled={!findMatches.length} onClick={() => {
              findMatches.forEach((i) => {
                const re = new RegExp(findQ.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), findCase ? "g" : "gi");
                onEditText(i, segs[i].text.replace(re, findRepl));
              });
            }} className="rounded-md border border-border bg-card/60 px-3 py-1.5 text-[13px] font-medium hover:border-primary/50 disabled:opacity-40">
              Replace All <span className="ml-1 text-muted-foreground">{findMatches.length}</span>
            </button>
            <button disabled={!findMatches.length} onClick={() => {
              const i = findMatches[findCursor];
              if (i == null) return;
              const re = new RegExp(findQ.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), findCase ? "" : "i");
              onEditText(i, segs[i].text.replace(re, findRepl));
            }} className="rounded-md bg-primary/90 px-3 py-1.5 text-[13px] font-semibold text-primary-foreground hover:bg-primary disabled:opacity-40">
              Replace
            </button>
          </div>
        </div>
      )}

      {!findOpen && searchOpen && (
        <div className="border-b border-border/60 px-4 py-2">
          <div className="flex items-center gap-2 rounded-md border border-border bg-input/50 px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search captions…"
              className="w-full bg-transparent text-[13px] outline-none placeholder:text-muted-foreground" />
          </div>
        </div>
      )}

      <VirtualCaptionList
        rows={rows}
        segs={segs}
        activeIdx={activeIdx}
        editingIdx={editingIdx}
        editingText={editingText}
        setEditingText={setEditingText}
        commitEdit={commitEdit}
        cancelEdit={cancelEdit}
        beginEdit={beginEdit}
        rowMenu={rowMenu}
        setRowMenu={setRowMenu}
        setWordMenu={setWordMenu}
        onSeek={onSeek}
        onSplitSeg={onSplitSeg}
        onDeleteSeg={onDeleteSeg}
        setLineStyleFor={setLineStyleFor}
        activeRowRef={activeRowRef}
        emphasized={emphasized}
        spotlighted={spotlighted}
        lowConfWordKeys={lowConfWordKeys}
        lowConfMode={lowConfMode}
        flaggedIdxs={flaggedIdxs}
        flaggedOnly={flaggedOnly}
        onClearFlagged={onClearFlagged}
        getCaptionSeekTime={getCaptionSeekTime}
        filteredEmpty={filtered.length === 0}
      />


      {/* Word context menu (fixed-positioned overlay) */}
      {wordMenu && (() => {
        const seg = segs[wordMenu.seg];
        const words = seg?.text.split(/\s+/).filter(Boolean) ?? [];
        const word = words[wordMenu.wi] ?? "";
        const key = `${wordMenu.seg}:${wordMenu.wi}`;
        const isEmph = emphasized.has(key);
        const isSpot = spotlighted.has(key);
        return (
          <div
            onClick={(e) => e.stopPropagation()}
            className="fixed z-50 w-64 overflow-hidden rounded-2xl border border-border bg-card p-1.5 text-[13px] shadow-2xl animate-scale-in"
            style={{ left: Math.min(wordMenu.x, window.innerWidth - 272), top: Math.min(wordMenu.y, window.innerHeight - 380) }}
          >
            <WordMenuItem icon={<Sparkles className="h-3.5 w-3.5" />} label={isEmph ? "Unemphasize" : "Emphasize"} desc="Make this word stand out" onClick={() => { onToggleWordVisual("emph", wordMenu.seg, wordMenu.wi); setWordMenu(null); }} />
            <WordMenuItem icon={<Focus className="h-3.5 w-3.5" />} label={isSpot ? "Remove Spotlight" : "Spotlight"} desc="Feature for maximum impact" onClick={() => { onToggleWordVisual("spot", wordMenu.seg, wordMenu.wi); setWordMenu(null); }} />
            <WordMenuItem icon={<TypeIcon className="h-3.5 w-3.5" />} label="Edit" desc="Modify the text" onClick={() => { beginEdit(wordMenu.seg); setWordMenu(null); }} />
            <WordMenuItem icon={<Search className="h-3.5 w-3.5" />} label="Search & Replace" desc="Find all occurrences" onClick={() => { setFindOpen(true); setFindQ(word); setWordMenu(null); }} />
            <WordMenuItem icon={<Scissors className="h-3.5 w-3.5" />} label="Split" desc="Split caption here" onClick={() => { onSplitSeg(wordMenu.seg, wordMenu.wi); setWordMenu(null); toast.success("Split at word"); }} />
            <WordMenuItem icon={<ArrowLeft className="h-3.5 w-3.5" />} label="Previous Line" desc="Move word to previous line" onClick={() => { onMoveWord(wordMenu.seg, wordMenu.wi, "prev"); setWordMenu(null); }} />
            <WordMenuItem icon={<ArrowRight className="h-3.5 w-3.5" />} label="Next Line" desc="Move word to next line" onClick={() => { onMoveWord(wordMenu.seg, wordMenu.wi, "next"); setWordMenu(null); }} />
            <div className="my-1 h-px bg-border/60" />
            <WordMenuItem icon={<Trash2 className="h-3.5 w-3.5" />} label="Delete" desc="Remove this word" destructive onClick={() => { onDeleteWord(wordMenu.seg, wordMenu.wi); setWordMenu(null); }} />
          </div>
        );
      })()}


      {/* Line Styling drawer */}
      {lineStyleFor != null && (
        <LineStylingDrawer
          segIdx={lineStyleFor}
          capStyle={capStyle}
          setCapStyle={setCapStyle}
          onClose={() => setLineStyleFor(null)}
        />
      )}
      </div>
    </div>
  );
});

CaptionsColumn.displayName = "CaptionsColumn";

/* --------------------- Video viewport --------------------- */
const VideoViewport = memo(({
  mediaUrl, isAudio, videoRef, playing, currentTime, duration, capStyle, words, activeWordIdx, activeIdx, setCapStyle, onTogglePlay,
  emphasized, spotlighted, onReplace, replacing, onQuickExport, quickBusy, sync, setSync, panelCollapsed,
  leftCollapsed, onToggleLeft, onMediaUnsupported, mediaRepairing, onFrameWidth,
  videoMinTrackWidth, videoMaxTrackWidth, videoTrackWidth, onVideoTrackWidthChange, showWatermark, saveState,
  onUndo, onRedo, canUndo, canRedo, onToggleHistory, historyOpen,
  onEditWord, onEmphasizeWord, onSplitAtWord,

}: {
  mediaUrl: string | null; isAudio: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
  playing: boolean; currentTime: number; duration: number;
  capStyle: CapStyle;
  words: string[];
  activeWordIdx: number;
  activeIdx: number;
  setCapStyle: React.Dispatch<React.SetStateAction<CapStyle>>;
  onTogglePlay: () => void;
  emphasized: Set<string>;
  spotlighted: Set<string>;
  onReplace: (file: File) => void | Promise<void>;
  replacing: boolean;
  onQuickExport: (res: "1080p" | "4k" | "720p" | "1440p") => void;
  quickBusy: boolean;
  sync: { enabled: boolean; offsetMs: number; driftPerMin: number };
  setSync: React.Dispatch<React.SetStateAction<{ enabled: boolean; offsetMs: number; driftPerMin: number }>>;
  panelCollapsed?: boolean;
  leftCollapsed?: boolean;
  onToggleLeft?: () => void;
  onMediaUnsupported?: () => void;
  mediaRepairing?: boolean;
  onFrameWidth?: (w: number) => void;
  videoMinTrackWidth?: number;
  videoMaxTrackWidth?: number;
  videoTrackWidth?: number | null;
  onVideoTrackWidthChange?: (w: number) => void;
  showWatermark?: boolean;
  saveState?: "idle" | "saving" | "saved";
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onToggleHistory?: () => void;
  historyOpen?: boolean;
  onEditWord?: (wi: number) => void;
  onEmphasizeWord?: (wi: number) => void;
  onSplitAtWord?: (wi: number, dir: "next" | "prev") => void;


}) => {
  const audibleDefault = 0.8;
  const [syncOpen, setSyncOpen] = useState(false);
  const [marginOpen, setMarginOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [debugOverlay, setDebugOverlay] = useState(false);
  const [wordCtx, setWordCtx] = useState<{ wi: number; x: number; y: number } | null>(null);
  useEffect(() => {
    if (!wordCtx) return;
    const close = () => setWordCtx(null);
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("keydown", close); };
  }, [wordCtx]);



  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(audibleDefault);
  const [showVolume, setShowVolume] = useState(false);
  const [videoScale, setVideoScale] = useState(1.25); // 1.25 is the floor — drag can only enlarge (up to 2.5)
  const { id: fitProjectId } = useParams();
  const fitStorageKey = fitProjectId ? `yc:fitMode:${fitProjectId}` : null;
  const snapStorageKey = fitProjectId ? `yc:snap:${fitProjectId}` : null;
  const gridStorageKey = fitProjectId ? `yc:grid:${fitProjectId}` : null;
  const [fitMode, setFitMode] = useState<"contain" | "cover">(() => {
    if (typeof window === "undefined" || !fitProjectId) return "contain";
    const saved = window.localStorage.getItem(`yc:fitMode:${fitProjectId}`);
    return saved === "cover" ? "cover" : "contain";
  });
  const [snapEnabled, setSnapEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined" || !fitProjectId) return false;
    return window.localStorage.getItem(`yc:snap:${fitProjectId}`) === "1";
  });
  const [gridVisible, setGridVisible] = useState<boolean>(() => {
    if (typeof window === "undefined" || !fitProjectId) return false;
    return window.localStorage.getItem(`yc:grid:${fitProjectId}`) === "1";
  });
  const [isDraggingCaption, setIsDraggingCaption] = useState(false);
  useEffect(() => {
    if (!fitStorageKey) return;
    try { window.localStorage.setItem(fitStorageKey, fitMode); } catch { /* ignore */ }
  }, [fitMode, fitStorageKey]);
  useEffect(() => {
    if (!snapStorageKey) return;
    try { window.localStorage.setItem(snapStorageKey, snapEnabled ? "1" : "0"); } catch { /* ignore */ }
  }, [snapEnabled, snapStorageKey]);
  useEffect(() => {
    if (!gridStorageKey) return;
    try { window.localStorage.setItem(gridStorageKey, gridVisible ? "1" : "0"); } catch { /* ignore */ }
  }, [gridVisible, gridStorageKey]);
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const safeVolume = muted ? 0 : Math.max(volume || audibleDefault, 0.01);
    v.volume = safeVolume;
    v.muted = muted;
  }, [volume, muted, videoRef]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    v.volume = Math.max(v.volume || 0, audibleDefault);
    setMuted(false);
    setVolume((prev) => Math.max(prev || 0, audibleDefault));
  }, [mediaUrl, videoRef]);

  const handleVolume = (val: number) => {
    const v = videoRef.current;
    const clamped = Math.max(0, Math.min(1, val));
    setVolume(clamped);
    setMuted(clamped === 0);
    if (v) {
      v.volume = clamped;
      v.muted = clamped === 0;
    }
  };
  const [aspect, setAspect] = useState<number>(16 / 9); // width / height
  const containerRef = useRef<HTMLDivElement>(null);
  const captionWrapRef = useRef<HTMLDivElement>(null);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const [captionSize, setCaptionSize] = useState({ width: 0, height: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fsWrapperRef = useRef<HTMLDivElement>(null);
  const topStripRef = useRef<HTMLDivElement>(null);
  const bottomStripRef = useRef<HTMLDivElement>(null);

  // Auto-hide controls on inactivity (only while playing).
  const [controlsVisible, setControlsVisible] = useState(true);
  const idleTimerRef = useRef<number | null>(null);
  const bumpControls = useCallback(() => {
    setControlsVisible(true);
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    if (playing) {
      idleTimerRef.current = window.setTimeout(() => setControlsVisible(false), 2200);
    }
  }, [playing]);
  useEffect(() => {
    // When play state flips, restart the reveal/hide cycle.
    bumpControls();
    return () => { if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current); };
  }, [playing, bumpControls]);

  const chunkKey = `${activeIdx}:${words.join(" ")}`;
  const fsBusyRef = useRef(false);
  const getFsElement = (): Element | null =>
    (document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement) ?? null;
  const toggleFullscreen = async () => {
    if (fsBusyRef.current) return; // debounce rapid double-clicks
    fsBusyRef.current = true;
    setTimeout(() => { fsBusyRef.current = false; }, 350);
    const el: any = fsWrapperRef.current ?? containerRef.current;
    if (!el) {
      logEditorControlError(new Error("Video container not mounted"), { control: "fullscreen", action: "requestFullscreen" });
      return;
    }
    const inFs = !!getFsElement();
    try {
      if (inFs) {
        const exit = (document.exitFullscreen ||
          (document as any).webkitExitFullscreen ||
          (document as any).mozCancelFullScreen ||
          (document as any).msExitFullscreen);
        if (exit) await exit.call(document);
      } else {
        const req = (el.requestFullscreen ||
          el.webkitRequestFullscreen ||
          el.mozRequestFullScreen ||
          el.msRequestFullscreen);
        if (req) {
          await req.call(el);
        } else if (videoRef.current && (videoRef.current as any).webkitEnterFullscreen) {
          // iOS Safari fallback — only <video> supports fullscreen
          (videoRef.current as any).webkitEnterFullscreen();
        } else {
          throw new Error("Fullscreen API not supported in this browser");
        }
      }
    } catch (err) {
      logEditorControlError(err, {
        control: "fullscreen",
        action: inFs ? "exitFullscreen" : "requestFullscreen",
        context: {
          hasStandard: typeof el.requestFullscreen === "function",
          hasWebkit: typeof el.webkitRequestFullscreen === "function",
          hasIOSVideo: !!(videoRef.current && (videoRef.current as any).webkitEnterFullscreen),
        },
      });
    }
  };
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!getFsElement());
    const evts = ["fullscreenchange", "webkitfullscreenchange", "mozfullscreenchange", "MSFullscreenChange"];
    evts.forEach((e) => document.addEventListener(e, onChange));
    // iOS <video> uses its own events
    const v = videoRef.current;
    v?.addEventListener("webkitbeginfullscreen", onChange);
    v?.addEventListener("webkitendfullscreen", onChange);
    return () => {
      evts.forEach((e) => document.removeEventListener(e, onChange));
      v?.removeEventListener("webkitbeginfullscreen", onChange);
      v?.removeEventListener("webkitendfullscreen", onChange);
    };
// eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Ctrl/Cmd + wheel anywhere on the video frame resizes captions.
  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const step = e.deltaY < 0 ? 2 : -2;
      setCapStyle((s) => normalizeCapStyle({ ...s, fontSize: s.fontSize + step }));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel as EventListener);
  }, [setCapStyle]);

  const [isResizing, setIsResizing] = useState(false);
  useLayoutEffect(() => {
    const frame = containerRef.current;
    if (!frame) return;
    let idleT = 0;
    // Synchronous read — runs before paint so strips + video update in the
    // same frame as the container. No RAF gap → no visible flicker.
    const read = () => {
      const r = frame.getBoundingClientRect();
      setFrameSize((prev) =>
        prev.width === r.width && prev.height === r.height ? prev : { width: r.width, height: r.height },
      );
      onFrameWidth?.(r.width);
    };

    const markResizing = () => {
      setIsResizing(true);
      window.clearTimeout(idleT);
      idleT = window.setTimeout(() => setIsResizing(false), 180);
      read();
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(frame);
    // Some mobile browsers don't fire ResizeObserver on orientation change
    // reliably — force a re-measure so the video re-hugs the arrow correctly.
    window.addEventListener("resize", markResizing);
    window.addEventListener("orientationchange", markResizing);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", markResizing);
      window.removeEventListener("orientationchange", markResizing);
      window.clearTimeout(idleT);
    };
// eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Belt-and-suspenders alignment: on every window resize / orientation
  // change / video box mutation, imperatively copy the video's rendered
  // width to the top and bottom strips BEFORE the next paint. This bypasses
  // React's render cycle so strips can never lag the video by even one frame.
  useLayoutEffect(() => {
    const video = containerRef.current;
    if (!video) return;
    const recalibrate = () => {
      if (isFullscreen) {
        if (topStripRef.current) topStripRef.current.style.width = "100%";
        if (bottomStripRef.current) bottomStripRef.current.style.width = "100%";
        return;
      }
      const w = video.getBoundingClientRect().width;
      if (!w) return;
      const px = `${w}px`;
      if (topStripRef.current && topStripRef.current.style.width !== px) {
        topStripRef.current.style.width = px;
      }
      if (bottomStripRef.current && bottomStripRef.current.style.width !== px) {
        bottomStripRef.current.style.width = px;
      }
    };
    recalibrate();
    const ro = new ResizeObserver(recalibrate);
    ro.observe(video);
    window.addEventListener("resize", recalibrate);
    window.addEventListener("orientationchange", recalibrate);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recalibrate);
      window.removeEventListener("orientationchange", recalibrate);
    };
  }, [isFullscreen]);




  useEffect(() => {
    const caption = captionWrapRef.current;
    if (!caption) return;
    const read = () => {
      const r = caption.getBoundingClientRect();
      setCaptionSize({ width: r.width, height: r.height });
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(caption);
    return () => ro.disconnect();
  }, [chunkKey, capStyle.fontSize, capStyle.fontFamily, capStyle.fontWeight, capStyle.lineHeight, capStyle.letterSpacing, capStyle.bgPadX, capStyle.bgPadY, words]);
  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) { logEditorControlError(new Error("Video element not ready"), { control: "mute" }); return; }
    try {
      const nextMuted = !v.muted;
      v.muted = nextMuted;
      if (!nextMuted && v.volume <= 0.01) {
        v.volume = audibleDefault;
        setVolume(audibleDefault);
      }
      setMuted(nextMuted);
    }
    catch (err) { logEditorControlError(err, { control: "mute", context: { muted: v.muted } }); }
  };

  // Match the preview frame to the source video's real aspect ratio so
  // portrait Reels/Shorts don't render tiny inside a 16:9 letterbox.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onMeta = () => {
      if (v.videoWidth && v.videoHeight) setAspect(v.videoWidth / v.videoHeight);
    };
    v.addEventListener("loadedmetadata", onMeta);
    if (v.readyState >= 1) onMeta();
    return () => v.removeEventListener("loadedmetadata", onMeta);
  }, [mediaUrl, videoRef]);

  void aspect; // aspect drives frameStyle below

  // Let the preview frame fill the entire video column — cap only by the
  // parent's height/width so the video feels cinema-sized like the reference
  // editor, instead of being clamped to a small 560/720px box.
  const scalePct = `${Math.round(videoScale * 100)}%`;
  // Leave headroom for the top (Replace/Low-res) and bottom (scrubber/controls)
  // strips so the video never bleeds into or past them. ~112px covers both.
  const framedCap = `min(${scalePct}, calc(100% - 72px))`;
  // While the user is actively dragging the window, disable the width/height
  // easing so the video edge stays glued to the arrow with no lag/flicker.
  // Transitions still play for panel collapse/expand and scale changes.
  const sizeTransition = isResizing
    ? "none"
    : "width 200ms ease, height 200ms ease, max-width 200ms ease, max-height 200ms ease";
  const frameStyle: React.CSSProperties = isFullscreen
    ? { aspectRatio: `${aspect}`, flex: "1 1 auto", minHeight: 0, maxWidth: "100vw", maxHeight: "100%", width: "auto", height: "auto", borderRadius: 0, border: 0, background: "hsl(var(--background))" }
    : videoTrackWidth != null
      ? { width: "100%", height: framedCap, maxWidth: "100%", maxHeight: framedCap, transition: sizeTransition }
    : panelCollapsed
      ? { aspectRatio: `${aspect}`, height: framedCap, width: "auto", maxWidth: "100%", maxHeight: framedCap, transition: sizeTransition }
      : aspect < 1
        ? { aspectRatio: `${aspect}`, height: framedCap, width: "auto", maxWidth: "100%", maxHeight: framedCap, transition: sizeTransition }
        : { aspectRatio: `${aspect}`, width: scalePct, height: "auto", maxWidth: "100%", maxHeight: framedCap, transition: sizeTransition };



  const hasCaption = words.length > 0;
  const marginPx = (capStyle.safeMargin / 100) * Math.min(frameSize.width, frameSize.height);
  const safePadX = Math.max(4, frameSize.width * 0.01) + marginPx;
  const safePadTop = Math.max(4, frameSize.height * 0.01) + marginPx;
  const safePadBottom = Math.max(4, frameSize.height * 0.01) + marginPx;
  const safeWidth = Math.max(0, frameSize.width - safePadX * 2);
  const safeHeight = Math.max(0, frameSize.height - safePadTop - safePadBottom);

  const responsiveFontSize = Math.max(10, Math.min(capStyle.fontSize, Math.max(16, frameSize.height * 0.105), Math.max(16, frameSize.width * 0.095)));
  const fitScaleW = captionSize.width > 0 && safeWidth > 0 ? safeWidth / captionSize.width : 1;
  const fitScaleH = captionSize.height > 0 && safeHeight > 0 ? safeHeight / captionSize.height : 1;
  const measuredScale = capStyle.fitToVideo
    ? Math.min(1, fitScaleW, fitScaleH)
    : Math.min(1, fitScaleW); // width-only guard when fit mode is off
  const safeFontSize = Math.max(10, Math.floor(responsiveFontSize * measuredScale));
  const halfCaptionW = Math.min(captionSize.width / 2, safeWidth / 2);
  const halfCaptionH = Math.min(captionSize.height / 2, safeHeight / 2);
  const rawLeft = (capStyle.posX / 100) * frameSize.width;
  const rawTop = (capStyle.posY / 100) * frameSize.height;
  const captionLeft = frameSize.width
    ? Math.max(safePadX + halfCaptionW, Math.min(frameSize.width - safePadX - halfCaptionW, rawLeft))
    : rawLeft;
  const captionTop = frameSize.height
    ? Math.max(safePadTop + halfCaptionH, Math.min(frameSize.height - safePadBottom - halfCaptionH, rawTop))
    : rawTop;

  // Auto-correct: if the caption gets clamped (would go off-screen), write the
  // corrected position back into capStyle so it persists across scrubs/seeks.
  const autoCorrectRef = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!frameSize.width || !frameSize.height || !captionSize.width) return;
    const dx = Math.abs(rawLeft - captionLeft);
    const dy = Math.abs(rawTop - captionTop);
    if (dx < 0.5 && dy < 0.5) return;
    const nextX = +((captionLeft / frameSize.width) * 100).toFixed(2);
    const nextY = +((captionTop / frameSize.height) * 100).toFixed(2);
    const last = autoCorrectRef.current;
    if (last && Math.abs(last.x - nextX) < 0.05 && Math.abs(last.y - nextY) < 0.05) return;
    autoCorrectRef.current = { x: nextX, y: nextY };
    setCapStyle((s) => normalizeCapStyle({ ...s, posX: nextX, posY: nextY }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captionLeft, captionTop, rawLeft, rawTop, frameSize.width, frameSize.height, captionSize.width, captionSize.height]);

  const baseSpanStyle = captionSpanStyle(capStyle);
  const outerStyle: React.CSSProperties = {
    ...baseSpanStyle,
    fontSize: `${safeFontSize}px`,
    background: capStyle.bgOn && capStyle.colorMode !== "gradient" && !capStyle.activeWordBgOn ? baseSpanStyle.background : capStyle.colorMode === "gradient" ? baseSpanStyle.background : "transparent",
    padding: capStyle.bgOn && !capStyle.activeWordBgOn ? baseSpanStyle.padding : "2px 6px",
    display: "inline-block",
    cursor: "grab",
    pointerEvents: "auto",
    touchAction: "none",
    userSelect: "none",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    wordBreak: "normal",
    maxWidth: `${Math.max(40, safeWidth)}px`,
    maxHeight: `${Math.max(40, safeHeight)}px`,
    overflow: "hidden",
  };

  const shrinkWrapPreview = videoTrackWidth == null;

  return (
    <div className={`relative flex min-h-0 min-w-0 items-stretch overflow-visible bg-background/50 p-0 justify-center lg:justify-end ${shrinkWrapPreview ? "lg:w-fit lg:max-w-full lg:self-end" : "w-full"}`}>
      {/* Video width control removed per user request */}




      <div
        ref={fsWrapperRef}
        className={`flex min-h-0 flex-col gap-2 ${isFullscreen ? "fixed inset-0 z-[100] h-screen w-screen items-center justify-between bg-background p-3 sm:p-4" : `h-full max-h-full ${shrinkWrapPreview ? "w-fit" : "w-full"} max-w-full py-1 items-center lg:items-end justify-between`}`}


        onMouseMove={bumpControls}
        onMouseEnter={bumpControls}
        onMouseLeave={() => { if (playing) setControlsVisible(false); }}
        onTouchStart={bumpControls}
      >
      {/* Top strip — Replace + Low-res (outside the video frame) */}
      {mediaUrl && !isAudio && (
        <div
          ref={topStripRef}
          className={`flex flex-wrap items-center justify-between gap-2 max-w-full transition-opacity duration-300 ${controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          style={{ width: isFullscreen ? "100%" : (frameSize.width || "100%") }}
        >

          <input
            ref={replaceInputRef}
            type="file"
            accept="video/*,audio/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onReplace(f);
              e.currentTarget.value = "";
            }}
          />
          {onToggleLeft && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleLeft(); }}
              title={leftCollapsed ? "Show captions panel" : "Hide captions panel"}
              aria-label={leftCollapsed ? "Show captions panel" : "Hide captions panel"}
              aria-pressed={!leftCollapsed}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-foreground hover:bg-muted/40"
            >
              {leftCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); replaceInputRef.current?.click(); }}
            disabled={replacing}
            title="Replace media"
            aria-label="Replace media"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1.5 text-[13px] font-medium text-foreground hover:bg-muted/40 disabled:opacity-60"
          >
            <RefreshCw className={`h-3 w-3 ${replacing ? "animate-spin" : ""}`} /> {replacing ? "Replacing…" : "Replace"}
          </button>
          <div className="ml-auto flex items-center gap-2">
            {saveState && saveState !== "idle" && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[13px] font-medium ${saveState === "saved" ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"}`}
                title="Your caption edits autosave to this device"
                aria-live="polite"
              >
                <span className={`h-1.5 w-1.5 rounded-full ${saveState === "saved" ? "bg-primary" : "bg-muted-foreground animate-pulse"}`} />
                {saveState === "saved" ? "Saved" : "Saving…"}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/95 px-2.5 py-1.5 text-[13px] font-medium text-black shadow">
              <span className="h-1.5 w-1.5 rounded-full bg-black/60" /> Low-res
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); setSnapEnabled((v) => !v); }}
              title={snapEnabled ? "Snap: on (5% grid + edges/center). Hold Shift to force snap." : "Snap: off. Hold Shift while dragging to snap."}
              aria-label="Toggle caption snap"
              aria-pressed={snapEnabled}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[13px] font-medium hover:bg-muted/40 ${snapEnabled ? "border-primary bg-primary/15 text-primary" : "border-border bg-card text-foreground"}`}
            >
              Snap
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setGridVisible((v) => !v); }}
              title={gridVisible ? "Hide position grid" : "Show position grid (thirds + center)"}
              aria-label="Toggle position grid"
              aria-pressed={gridVisible}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[13px] font-medium hover:bg-muted/40 ${gridVisible ? "border-primary bg-primary/15 text-primary" : "border-border bg-card text-foreground"}`}
            >
              Grid
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onUndo?.(); }}
              disabled={!canUndo}
              title="Undo caption change (Ctrl/Cmd+Z)"
              aria-label="Undo caption change"
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1.5 text-[13px] font-medium text-foreground hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Undo
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onRedo?.(); }}
              disabled={!canRedo}
              title="Redo caption change (Ctrl/Cmd+Shift+Z)"
              aria-label="Redo caption change"
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1.5 text-[13px] font-medium text-foreground hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Redo
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onToggleHistory?.(); }}
              title="Show change history"
              aria-label="Toggle change history"
              aria-pressed={!!historyOpen}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[13px] font-medium hover:bg-muted/40 ${historyOpen ? "border-primary bg-primary/15 text-primary" : "border-border bg-card text-foreground"}`}
            >
              History
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCapStyle((s) => normalizeCapStyle({ ...s, posX: DEFAULT_CAP_STYLE.posX, posY: DEFAULT_CAP_STYLE.posY }));
                toast.success("Caption position reset");
              }}
              title="Reset caption to default position (center-bottom)"
              aria-label="Reset caption position"
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1.5 text-[13px] font-medium text-foreground hover:bg-muted/40"
            >
              Reset
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setFitMode((m) => (m === "contain" ? "cover" : "contain")); }}
              title={fitMode === "contain" ? "Switch to Fill (crop to frame)" : "Switch to Fit (show full video)"}
              aria-label="Toggle fit or fill"
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1.5 text-[13px] font-medium text-foreground hover:bg-muted/40"
            >
              {fitMode === "contain" ? "Fit" : "Fill"}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-foreground hover:bg-muted/40"
            >
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        data-align-debug="video"
        className="relative overflow-hidden rounded-none border-y border-r border-border bg-background shadow-2xl"
        style={frameStyle}
      >
        {/* Video resize handle removed — video sizes naturally with its container. */}





        <div className="relative h-full w-full flex-1">
          {mediaUrl ? (
            isAudio ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-primary/20 via-background to-primary/5">
                <Music2 className="h-8 w-8 text-primary" />
                <p className="text-sm">Audio preview</p>
                <audio ref={videoRef as unknown as React.RefObject<HTMLAudioElement>} src={mediaUrl} />
              </div>
            ) : (
              <video
                ref={videoRef}
                src={mediaUrl}
                className={`h-full w-full cursor-pointer ${fitMode === "cover" ? "object-cover" : "object-contain"}`}
                playsInline
                preload="metadata"
                controls={false}
                onLoadedMetadata={(e) => {
                  e.currentTarget.muted = false;
                  e.currentTarget.volume = Math.max(e.currentTarget.volume || 0, audibleDefault);
                  setMuted(false);
                  setVolume((prev) => Math.max(prev || 0, audibleDefault));
                }}
                onClick={(e) => { e.stopPropagation(); onTogglePlay(); }}
                onDoubleClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                onError={(e) => {
                  const result = logPlaybackError({ surface: "project_preview", element: e.currentTarget, extra: { phase: "element_error", src: mediaUrl } });
                  if (result.category === "src_not_supported" || result.category === "decode") onMediaUnsupported?.();
                }}
                onStalled={(e) => logPlaybackError({ surface: "project_preview", element: e.currentTarget, silent: true, extra: { phase: "stalled" } })}
              />

            )
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading…</div>
          )}
          {showWatermark && mediaUrl && !isAudio && (
            <div
              className="pointer-events-none absolute right-2 top-2 z-30 select-none rounded-md bg-black/45 px-2 py-1.5 text-[13px] font-semibold uppercase tracking-wider text-white/95 shadow-[0_2px_8px_rgba(0,0,0,0.45)] backdrop-blur-sm"
              aria-label="Yourcaptions watermark"
            >
              Yourcaptions.in
            </div>
          )}
        </div>

        {mediaRepairing && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/80 text-foreground backdrop-blur-sm">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-[13px] font-medium shadow-lg">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Repairing video playback…
            </div>
          </div>
        )}

        {/* Center play overlay removed — controls now live outside the video frame */}


        {/* Debug overlay — safe zone, clamp limits, caption bbox */}
        {debugOverlay && frameSize.width > 0 && (
          <div className="pointer-events-none absolute inset-0 z-40 font-mono text-[13px]">
            {/* Safe zone rectangle */}
            <div
              className="absolute border-2 border-dashed border-primary/80"
              style={{ left: safePadX, top: safePadTop, width: safeWidth, height: safeHeight }}
            >
              <span className="absolute -top-4 left-0 bg-primary/90 px-1 text-black">
                safe {Math.round(safeWidth)}×{Math.round(safeHeight)}
              </span>
            </div>
            {/* Clamp limits (center-of-caption travel box) */}
            <div
              className="absolute border border-warning/80"
              style={{
                left: safePadX + halfCaptionW,
                top: safePadTop + halfCaptionH,
                width: Math.max(0, frameSize.width - safePadX * 2 - halfCaptionW * 2),
                height: Math.max(0, frameSize.height - safePadTop - safePadBottom - halfCaptionH * 2),
              }}
            >
              <span className="absolute -top-4 right-0 bg-warning/95 px-1 text-black">clamp</span>
            </div>
            {/* Caption bbox */}
            {captionSize.width > 0 && (
              <div
                className="absolute border-2 border-destructive/90"
                style={{
                  left: captionLeft - captionSize.width / 2,
                  top: captionTop - captionSize.height / 2,
                  width: captionSize.width,
                  height: captionSize.height,
                }}
              >
                <span className="absolute -bottom-4 left-0 bg-destructive/95 px-1 text-foreground">
                  cap {Math.round(captionSize.width)}×{Math.round(captionSize.height)}
                </span>
              </div>
            )}
            {/* Anchor dot at caption center */}
            <div
              className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-destructive ring-2 ring-foreground/70"
              style={{ left: captionLeft, top: captionTop }}
            />
            {/* Stats HUD */}
            <div className="absolute left-2 top-2 rounded bg-background/75 px-2 py-1.5 leading-relaxed text-foreground shadow">
              <div>frame {Math.round(frameSize.width)}×{Math.round(frameSize.height)}</div>
              <div>pos {capStyle.posX.toFixed(1)}%,{capStyle.posY.toFixed(1)}% → {Math.round(captionLeft)},{Math.round(captionTop)}</div>
              <div>scale {measuredScale.toFixed(2)} · font {safeFontSize}px</div>
              <div>margin {capStyle.safeMargin}% · fit {capStyle.fitToVideo ? "on" : "off"}</div>
            </div>
          </div>
        )}


        {/* Position grid overlay — thirds + center guides */}
        {(gridVisible || isDraggingCaption) && frameSize.width > 0 && (
          <div className="pointer-events-none absolute inset-0 z-20">
            {/* Rule-of-thirds */}
            <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(to right, rgba(255,255,255,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.18) 1px, transparent 1px)", backgroundSize: "33.333% 33.333%" }} />
            {/* Center crosshair */}
            <div className="absolute left-1/2 top-0 h-full w-px bg-primary/60" />
            <div className="absolute top-1/2 left-0 w-full h-px bg-primary/60" />
            {/* Corner ticks at 25/75 */}
            <div className="absolute left-1/4 top-0 h-full w-px bg-white/10" />
            <div className="absolute left-3/4 top-0 h-full w-px bg-white/10" />
            <div className="absolute top-1/4 left-0 w-full h-px bg-white/10" />
            <div className="absolute top-3/4 left-0 w-full h-px bg-white/10" />
            {isDraggingCaption && (
              <div className="absolute right-2 top-2 rounded-md bg-black/70 px-2 py-0.5 font-mono text-[14px] text-white shadow">
                {capStyle.posX.toFixed(1)}% · {capStyle.posY.toFixed(1)}%
              </div>
            )}
          </div>
        )}

        {/* Caption overlay */}
        {hasCaption && (
          <div className="pointer-events-none absolute inset-0 z-30">
            <div
              ref={captionWrapRef}
              key={chunkKey}
              className={`absolute cap-anim-${capStyle.transition}`}
              style={{
                left: captionLeft, top: captionTop, transform: "translate(-50%,-50%)",
                maxWidth: Math.max(40, safeWidth),
                maxHeight: Math.max(40, safeHeight),
                // @ts-expect-error css var
                "--cap-dur": `${capStyle.transitionSpeed}ms`,
              }}
            >
              <span
                onPointerDown={(e) => {
                  e.preventDefault();
                  const container = containerRef.current; if (!container) return;
                  const rect = container.getBoundingClientRect();
                  const startX = e.clientX, startY = e.clientY;
                  const start = { x: capStyle.posX, y: capStyle.posY };
                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                  setIsDraggingCaption(true);
                  const snapVal = (v: number, shift: boolean) => {
                    if (!snapEnabled && !shift) return v;
                    // Snap to 5% grid + strong pull to 0/25/50/75/100 within 2%
                    const anchors = [0, 25, 50, 75, 100];
                    for (const a of anchors) if (Math.abs(v - a) < 2) return a;
                    return Math.round(v / 5) * 5;
                  };
                  // Coalesce pointermove → one setCapStyle per animation frame.
                  // On a fast trackpad the browser fires 120+ pointermoves/sec;
                  // committing each one to React state re-renders the caption
                  // overlay and every subscriber (grid readout, style panel).
                  // rAF-throttling keeps state at ~60 Hz max, which is all the
                  // display can show anyway, and stays smooth on low-end phones.
                  let raf = 0;
                  let pending: { x: number; y: number } | null = null;
                  const flush = () => {
                    raf = 0;
                    if (!pending) return;
                    const { x, y } = pending;
                    pending = null;
                    setCapStyle((s) => normalizeCapStyle({ ...s, posX: x, posY: y }));
                  };
                  const move = (ev: PointerEvent) => {
                    const dx = ((ev.clientX - startX) / rect.width) * 100;
                    const dy = ((ev.clientY - startY) / rect.height) * 100;
                    const rawX = Math.max(0, Math.min(100, start.x + dx));
                    const rawY = Math.max(0, Math.min(100, start.y + dy));
                    pending = { x: snapVal(rawX, ev.shiftKey), y: snapVal(rawY, ev.shiftKey) };
                    if (!raf) raf = requestAnimationFrame(flush);
                  };
                  const up = () => {
                    if (raf) { cancelAnimationFrame(raf); raf = 0; }
                    // Commit any pending frame so the final resting position
                    // is exactly what the pointer landed on, not one frame stale.
                    if (pending) flush();
                    setIsDraggingCaption(false);
                    window.removeEventListener("pointermove", move);
                    window.removeEventListener("pointerup", up);
                  };
                  window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
                }}
                title={`Drag to move · ${snapEnabled ? "snap on" : "hold Shift to snap"} · scroll to resize`}
                style={{ ...outerStyle, pointerEvents: "auto", cursor: "move", touchAction: "none" }}
                onWheel={(e) => { if (e.ctrlKey || e.metaKey) return; e.stopPropagation(); setCapStyle((s) => normalizeCapStyle({ ...s, fontSize: s.fontSize + (e.deltaY < 0 ? 2 : -2) })); }}
                className="hover:outline hover:outline-1 hover:outline-dashed hover:outline-primary/60"
              >
                {(() => {
                  // Detect if any word in the currently visible chunk is spotlighted → dim the rest.
                  const hasSpot = words.some((_, i) => spotlighted.has(`${activeIdx}:${i}`));
                  const impactRed = parseImpactWords(capStyle.impactWordsRed);
                  const impactYellow = parseImpactWords(capStyle.impactWordsYellow);
                  return words.map((w, i) => {
                  const isActive = capStyle.activeWordOn && i === activeWordIdx;
                  // With default wordsPerChunk=0, overlay word index == segment word index.
                  const key = `${activeIdx}:${i}`;
                  const isEmph = emphasized.has(key);
                  const isSpot = spotlighted.has(key);
                  const wordStyle: React.CSSProperties = {
                    display: "inline-block",
                    transition: "color 120ms ease, transform 120ms ease, background-color 120ms ease, opacity 160ms ease, filter 160ms ease, text-shadow 160ms ease",
                    padding: capStyle.activeWordBgOn ? "0 6px" : undefined,
                    borderRadius: capStyle.activeWordBgOn ? 6 : undefined,
                    // Typography (fontFamily/weight/italic/letterSpacing/case) cascades from
                    // outerStyle so idle words stay in sync with the right-panel pickers.
                  };
                  if (isActive) {
                    if (capStyle.activeWordBgOn) {
                      wordStyle.backgroundColor = capStyle.activeWordBgColor;
                      wordStyle.color = capStyle.activeWordColor;
                    } else {
                      wordStyle.color = capStyle.activeWordColor;
                    }
                    // Gradient mode paints text via background-clip on the parent — force the
                    // active word to render as a solid fill so the picker color shows through.
                    if (capStyle.colorMode === "gradient") {
                      wordStyle.backgroundImage = "none";
                      wordStyle.WebkitTextFillColor = capStyle.activeWordColor;
                    }
                    // Retint the glow with the active-word color so it stays synced with the picker.
                    if (capStyle.glowOn) {
                      const a = capStyle.glowIntensity / 100;
                      const hex = capStyle.activeWordColor.replace("#", "");
                      const r = parseInt(hex.slice(0, 2), 16) || 255;
                      const g = parseInt(hex.slice(2, 4), 16) || 255;
                      const b = parseInt(hex.slice(4, 6), 16) || 255;
                      wordStyle.textShadow = `0 0 ${capStyle.glowBlur}px rgba(${r},${g},${b},${a}), 0 0 ${Math.round(capStyle.glowBlur * 1.6)}px rgba(${r},${g},${b},${a * 0.7})`;
                    }
                    wordStyle.transform = `scale(${capStyle.activeWordScale})`;
                    wordStyle.transformOrigin = "center";
                  }
                  if (isEmph) {
                    wordStyle.color = "#FBBF24";
                    wordStyle.textShadow = "0 0 12px rgba(251,191,36,0.6)";
                  }
                  if (isSpot) {
                    wordStyle.transform = `scale(${Math.max(capStyle.activeWordScale, 1.4)})`;
                    wordStyle.transformOrigin = "center";
                    wordStyle.fontWeight = 900;
                    wordStyle.filter = "drop-shadow(0 6px 18px rgba(255,255,255,0.35)) drop-shadow(0 2px 6px rgba(0,0,0,.6))";
                    wordStyle.zIndex = 5;
                    wordStyle.position = "relative";
                    wordStyle.opacity = 1;
                  } else if (hasSpot) {
                    // Dim non-spotlighted siblings so the spotlighted word truly pops.
                    wordStyle.opacity = 0.28;
                    wordStyle.filter = "blur(0.4px)";
                    wordStyle.transform = (wordStyle.transform ?? "") + " scale(0.94)";
                  }
                  // Impact-word tint (red/yellow) — applied last so it wins over
                  // active/emphasis colors when the word is on an impact list.
                  const impactTier = matchImpactTier(w, impactRed, impactYellow);
                  if (impactTier === "red") {
                    wordStyle.color = capStyle.impactRedColor;
                    wordStyle.textShadow = `0px 4px 15px rgba(${parseInt(capStyle.impactRedColor.slice(1,3),16)},${parseInt(capStyle.impactRedColor.slice(3,5),16)},${parseInt(capStyle.impactRedColor.slice(5,7),16)},0.4), 0px 2px 4px rgba(0,0,0,1)`;
                  } else if (impactTier === "yellow") {
                    wordStyle.color = capStyle.impactYellowColor;
                    wordStyle.textShadow = `0px 4px 15px rgba(${parseInt(capStyle.impactYellowColor.slice(1,3),16)},${parseInt(capStyle.impactYellowColor.slice(3,5),16)},${parseInt(capStyle.impactYellowColor.slice(5,7),16)},0.4), 0px 2px 4px rgba(0,0,0,1)`;
                  }
                  const emoji = capStyle.autoEmojiOn ? getEmojiForWord(w) : null;
                  return (
                    <span
                      key={i}
                      className="cap-word"
                      style={{ position: "relative", display: "inline-block", cursor: onEditWord ? "context-menu" : undefined, pointerEvents: "auto" }}
                       onContextMenu={(e) => {
                         if (!onEditWord && !onEmphasizeWord && !onSplitAtWord) return;
                         e.preventDefault(); e.stopPropagation();
                         setWordCtx({ wi: i, x: e.clientX, y: e.clientY });
                       }}
                       onClick={(e) => {
                         if (!onEditWord && !onEmphasizeWord && !onSplitAtWord) return;
                         e.preventDefault(); e.stopPropagation();
                         const t = e.currentTarget.getBoundingClientRect();
                         setWordCtx({ wi: i, x: e.clientX || t.left + t.width / 2, y: e.clientY || t.bottom });
                       }}
                    >
                      {emoji && isActive && (
                        <span
                          aria-hidden
                          style={{
                            position: "absolute",
                            left: "50%",
                            bottom: "100%",
                            transform: "translate(-50%, -4px)",
                            fontSize: capStyle.emojiSize,
                            lineHeight: 1,
                            filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.45))",
                            pointerEvents: "none",
                            animation: "cap-emoji-pop 320ms cubic-bezier(.34,1.56,.64,1) both",
                          }}
                        >
                          {emoji}
                        </span>
                      )}
                      <span style={wordStyle}>
                        {applyTextCase(w, capStyle.textCase)}
                        {i < words.length - 1 ? " " : ""}
                      </span>
                    </span>
                  );
                });
                })()}
              </span>
            </div>
          </div>
        )}

        {wordCtx && (() => {
          const wi = wordCtx.wi;
          const w = words[wi] ?? "";
          const isEmph = emphasized.has(`${activeIdx}:${wi}`);
          const MENU_W = 260, MENU_H = 220;
          const left = Math.min(wordCtx.x, (typeof window !== "undefined" ? window.innerWidth : 1024) - MENU_W - 8);
          const top = Math.min(wordCtx.y, (typeof window !== "undefined" ? window.innerHeight : 768) - MENU_H - 8);
          return (
            <div
              role="menu"
              onPointerDown={(e) => e.stopPropagation()}
              className="fixed z-[80] w-[260px] rounded-xl border border-border/70 bg-popover/95 p-2 text-popover-foreground shadow-2xl backdrop-blur"
              style={{ left, top }}
            >
              <div className="px-2 pb-1 pt-0.5 text-[14px] uppercase tracking-wide text-muted-foreground">Word · {w}</div>
              <button
                onClick={() => { onEditWord?.(wi); setWordCtx(null); }}
                className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-muted/40"
              >
                <TypeIcon className="mt-0.5 h-3.5 w-3.5 text-primary" />
                <div className="flex-1">
                  <div className="text-[14px] font-semibold">Edit word</div>
                  <div className="text-[14px] text-muted-foreground">Change the text of this word</div>
                </div>
              </button>
              <button
                onClick={() => { onEmphasizeWord?.(wi); setWordCtx(null); }}
                className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-muted/40"
              >
                <Sparkles className="mt-0.5 h-3.5 w-3.5 text-primary" />
                <div className="flex-1">
                  <div className="text-[14px] font-semibold">{isEmph ? "Unemphasize" : "Emphasize"}</div>
                  <div className="text-[14px] text-muted-foreground">Make this word stand out</div>
                </div>
              </button>
              <div className="my-1 h-px bg-border/60" />
              <button
                onClick={() => { onSplitAtWord?.(wi, "next"); setWordCtx(null); }}
                className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-muted/40"
              >
                <ChevronDown className="mt-0.5 h-3.5 w-3.5 text-primary" />
                <div className="flex-1">
                  <div className="text-[14px] font-semibold">Next line</div>
                  <div className="text-[14px] text-muted-foreground">Split — this word starts a new block</div>
                </div>
              </button>
              <button
                onClick={() => { onSplitAtWord?.(wi, "prev"); setWordCtx(null); }}
                className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-muted/40"
              >
                <ChevronUp className="mt-0.5 h-3.5 w-3.5 text-primary" />
                <div className="flex-1">
                  <div className="text-[14px] font-semibold">Previous line</div>
                  <div className="text-[14px] text-muted-foreground">Split — this word ends a new block above</div>
                </div>
              </button>
            </div>
          );
        })()}

      </div>



      {/* Bottom control strip — scrubber + play/mute/volume/time/fullscreen (outside the video frame) */}
      {mediaUrl && !isAudio && (
        <div
          ref={bottomStripRef}
          className={`flex flex-col gap-1 rounded-lg border border-border bg-card px-2 py-2 sm:px-3 max-w-full transition-opacity duration-300 ${controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          style={{ width: isFullscreen ? "100%" : (frameSize.width || "100%") }}
        >

          <div
            onPointerDown={(e) => {
              e.stopPropagation();
              const el = e.currentTarget as HTMLDivElement;
              el.setPointerCapture(e.pointerId);
              const wasPlaying = !!(videoRef.current && !videoRef.current.paused);
              const rect = el.getBoundingClientRect();
              const apply = (clientX: number) => {
                const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                const t = ratio * (duration || 0);
                const v = videoRef.current;
                if (v) v.currentTime = Math.max(0, Math.min(duration || 0, t));
              };
              apply(e.clientX);
              // Pause during drag so the video clock doesn't fight the scrub —
              // the RAF loop keeps currentTime and caption highlight in lockstep.
              if (wasPlaying && videoRef.current) videoRef.current.pause();
              const move = (ev: PointerEvent) => apply(ev.clientX);
              const up = () => {
                el.releasePointerCapture(e.pointerId);
                el.removeEventListener("pointermove", move);
                el.removeEventListener("pointerup", up);
                el.removeEventListener("pointercancel", up);
                if (wasPlaying && videoRef.current) void videoRef.current.play().catch(() => {});
              };
              el.addEventListener("pointermove", move);
              el.addEventListener("pointerup", up);
              el.addEventListener("pointercancel", up);
            }}
            className="group relative h-2.5 w-full cursor-pointer touch-none select-none"
            role="slider"
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration || 0)}
            aria-valuenow={Math.round(currentTime)}
          >
            <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-muted-foreground/25" />
            <div
              className="absolute left-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-primary"
              style={{ width: `${duration ? Math.min(100, (currentTime / duration) * 100) : 0}%` }}
            />
            <div
              className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow opacity-0 group-hover:opacity-100 transition"
              style={{ left: `${duration ? Math.min(100, (currentTime / duration) * 100) : 0}%` }}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); onTogglePlay(); }}
                title={playing ? "Pause" : "Play"}
                aria-label={playing ? "Pause video" : "Play video"}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted/40 text-foreground hover:bg-muted/60"
              >
                {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 pl-0.5" />}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                onMouseEnter={() => setShowVolume(true)}
                title={muted ? "Unmute" : "Mute"}
                aria-label={muted ? "Unmute video" : "Mute video"}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-foreground/90 hover:bg-muted/40"
              >
                {muted || volume === 0 ? <Volume1 className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              </button>
              <div
                onMouseEnter={() => setShowVolume(true)}
                onMouseLeave={() => setShowVolume(false)}
                className={`flex items-center overflow-hidden transition-all duration-200 ${showVolume ? "w-20 opacity-100" : "w-0 opacity-0"}`}
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="range" min={0} max={1} step={0.01}
                  value={muted ? 0 : volume}
                  onChange={(e) => handleVolume(parseFloat(e.target.value))}
                  aria-label="Volume"
                  className="h-1 w-full cursor-pointer accent-primary"
                />
              </div>
              <span className="ml-1 font-mono text-[13px] tabular-nums text-muted-foreground">
                {fmtHMS(currentTime)} <span className="text-muted-foreground/60">/ {fmtHMS(duration || 0)}</span>
              </span>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-foreground/90 hover:bg-muted/40"
            >
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
});

VideoViewport.displayName = "VideoViewport";

/* ---------------------- Bottom timeline ---------------------- */
const BottomTimeline = memo(({
  segs, currentTime, duration, onSeek, onEditTime, activeIdx, selectedSeg, setSelectedSeg, videoRef,
  viewMode, setViewMode, onInsertWord, onAutoHighlight, onDeleteSelected, onUndo, onRedo,
}: {
  segs: Segment[]; currentTime: number; duration: number;
  onSeek: (t: number) => void;
  onEditTime: (i: number, patch: { start?: number; end?: number }) => void;
  activeIdx: number;
  selectedSeg: number | null; setSelectedSeg: (i: number | null) => void;
  videoRef: React.RefObject<HTMLVideoElement>;
  viewMode: "word" | "line";
  setViewMode: (m: "word" | "line") => void;
  onInsertWord: () => void;
  onAutoHighlight: () => void;
  onDeleteSelected: (i: number | null) => void;
  onUndo: () => void;
  onRedo: () => void;
}) => {
  const [zoom, setZoom] = useState(1);
  const trackRef = useRef<HTMLDivElement>(null);
  const total = Math.max(duration, segs[segs.length - 1]?.end ?? 0, 10);
  const view = total / zoom;
  const [scroll, setScroll] = useState(0);
  const start = Math.max(0, Math.min(total - view, scroll));
  const end = start + view;
  const wave = useWaveform(segs, total, Math.floor(400 * zoom));
  const pct = (t: number) => `${((t - start) / view) * 100}%`;

  useEffect(() => {
    // keep playhead in view — use functional setState so we don't feedback-loop
    // through `start`/`end` (which are derived from `scroll` itself).
    setScroll((prev) => {
      const s = Math.max(0, Math.min(total - view, prev));
      const e = s + view;
      if (currentTime < s || currentTime > e - 0.2) {
        const next = Math.max(0, Math.min(total - view, currentTime - view * 0.1));
        return Math.abs(next - prev) > 0.001 ? next : prev;
      }
      return prev;
    });
  }, [currentTime, total, view]);

  const rulerTicks = useMemo(() => {
    const step = view <= 20 ? 1 : view <= 60 ? 2 : view <= 180 ? 5 : 10;
    const arr: number[] = [];
    for (let t = Math.ceil(start / step) * step; t <= end + 0.01; t += step) arr.push(t);
    return arr;
  }, [start, end, view]);

  const dragSeg = (e: React.PointerEvent, i: number, kind: "move" | "l" | "r") => {
    e.stopPropagation(); e.preventDefault();
    const rail = trackRef.current; if (!rail) return;
    const rect = rail.getBoundingClientRect();
    const orig = { ...segs[i] };
    const px2s = (px: number) => (px / rect.width) * view;
    const sx = e.clientX;
    setSelectedSeg(i);
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const onMove = (ev: PointerEvent) => {
      const dt = px2s(ev.clientX - sx);
      if (kind === "move") {
        const w = orig.end - orig.start;
        let ns = Math.max(0, orig.start + dt), ne = ns + w;
        if (ne > total) { ne = total; ns = ne - w; }
        onEditTime(i, { start: ns, end: ne });
      } else if (kind === "l") onEditTime(i, { start: orig.start + dt });
      else onEditTime(i, { end: orig.end + dt });
    };
    const onUp = () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
    window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp);
  };

  const scrubTo = (e: React.MouseEvent) => {
    const r = trackRef.current?.getBoundingClientRect(); if (!r) return;
    const t = start + ((e.clientX - r.left) / r.width) * view;
    onSeek(Math.max(0, Math.min(total, t)));
  };

  return (
      <div className="flex h-[160px] md:h-[220px] shrink-0 flex-col border-t border-border/60 bg-background/80">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-3 py-1.5">
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center rounded-md bg-muted/30 p-0.5 text-[14px] font-bold uppercase tracking-wider">
            <button onClick={() => setViewMode("word")} title="Word mode" aria-label="Word mode"
              className={`inline-flex h-7 items-center gap-1 rounded px-2.5 ${viewMode === "word" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              Word
            </button>
            <button onClick={() => setViewMode("line")} title="Line mode" aria-label="Line mode"
              className={`inline-flex h-7 items-center gap-1 rounded px-2.5 ${viewMode === "line" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              Line
            </button>
          </div>
          <button onClick={onInsertWord} className="inline-flex h-7 items-center gap-1 rounded-md bg-muted/30 px-2 text-[13px] font-semibold text-muted-foreground hover:bg-muted/50 hover:text-foreground" title="Add word at playhead" aria-label="Add word at playhead">
            <Plus className="h-3.5 w-3.5" /> Word
          </button>
          <span className="mx-1 h-5 w-px bg-border" />
          <button onClick={onUndo} title="Undo (⌘Z)" aria-label="Undo" className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-15-6.7L3 13" /></svg>
          </button>
          <button onClick={onRedo} title="Redo (⌘⇧Z)" aria-label="Redo" className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 15-6.7L21 13" /></svg>
          </button>
          <span className="mx-1 h-5 w-px bg-border" />
          <button onClick={onAutoHighlight} title="Auto-highlight keywords" aria-label="Auto-highlight keywords" className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-primary/15 hover:text-primary"><Zap className="h-3.5 w-3.5" /></button>
          <button onClick={() => activeIdx >= 0 && (setSelectedSeg(activeIdx), onSeek(segs[activeIdx].start))} title="Focus active caption" aria-label="Focus active caption" className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"><Focus className="h-3.5 w-3.5" /></button>
          <button onClick={() => selectedSeg != null && onSeek((segs[selectedSeg].start + segs[selectedSeg].end) / 2)} title="Cut point preview" className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"><Scissors className="h-3.5 w-3.5" /></button>
          <span className="mx-1 h-5 w-px bg-border" />
          <button onClick={() => { const idx = selectedSeg ?? activeIdx; if (idx > 0) { setSelectedSeg(idx - 1); onSeek(segs[idx - 1].start); } }} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /></button>
          <button onClick={() => { const idx = selectedSeg ?? activeIdx; if (idx >= 0 && idx < segs.length - 1) { setSelectedSeg(idx + 1); onSeek(segs[idx + 1].start); } }} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"><ArrowRight className="h-3.5 w-3.5" /></button>
          <button onClick={() => onDeleteSelected(selectedSeg)} title="Delete selected caption" aria-label="Delete selected caption"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/20 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
            title="Zoom out"
            aria-label="Zoom out"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <input
            type="range"
            min={0.5}
            max={8}
            step={0.25}
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="h-1 w-24 accent-primary"
            aria-label="Timeline zoom"
          />
          <button
            onClick={() => setZoom((z) => Math.min(8, +(z + 0.25).toFixed(2)))}
            title="Zoom in"
            aria-label="Zoom in"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>

      </div>

      {/* Ruler */}
      <div className="relative h-6 shrink-0 border-b border-border/60 bg-background/40">
        {rulerTicks.map((t, i) => (
          <div key={i} className="absolute inset-y-0 border-l border-border/50 pl-1 text-[13px] font-mono text-muted-foreground/80" style={{ left: pct(t) }}>
            {fmtRuler(t)}
          </div>
        ))}
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        onClick={scrubTo}
        className="relative flex-1 cursor-pointer overflow-hidden"
        onWheel={(e) => { if (e.deltaY !== 0) setScroll((s) => Math.max(0, Math.min(total - view, s + (e.deltaY / 200) * view))); }}
      >
        {/* Chip band */}
        <div className="absolute inset-x-0 top-0 h-9">
          {segs.map((s, i) => {
            if (s.end < start || s.start > end) return null;
            const isSel = selectedSeg === i, isCur = activeIdx === i;
            return (
              <div
                key={i}
                onPointerDown={(e) => dragSeg(e, i, "move")}
                onDoubleClick={(ev) => { ev.stopPropagation(); onSeek(s.start); }}
                title={s.text}
                style={{ left: pct(s.start), width: `calc(${pct(s.end) } - ${pct(s.start)})` }}
                className={`group absolute top-1 flex h-7 items-center gap-1 overflow-hidden rounded-md border px-1.5 text-[14px] transition ${
                  isSel ? "border-primary bg-primary/40 text-primary-foreground"
                  : isCur ? "border-primary/70 bg-primary/80 text-primary-foreground"
                  : "border-primary/40 bg-primary/25 text-foreground hover:bg-primary/40"
                }`}
              >
                <span
                  onPointerDown={(e) => dragSeg(e, i, "l")}
                  className="absolute inset-y-0 left-0 z-10 w-1.5 cursor-ew-resize bg-background/30 opacity-40 hover:opacity-100"
                />
                <div className="pointer-events-none flex min-w-0 flex-col leading-none">
                  <span className="truncate font-semibold">{s.text.split(/\s+/)[0] ?? s.text}</span>
                  <span className="mt-0.5 flex items-center gap-0.5 text-[14px] italic opacity-70">
                    <TypeIcon className="h-2 w-2" /> Text
                  </span>
                </div>
                <span
                  onPointerDown={(e) => dragSeg(e, i, "r")}
                  className="absolute inset-y-0 right-0 z-10 w-1.5 cursor-ew-resize bg-background/30 opacity-40 hover:opacity-100"
                />
              </div>
            );
          })}
        </div>
        {/* Waveform — warm amber tone to match reference editor */}
        <div className="absolute inset-x-0 top-10 bottom-0 flex items-center gap-[1px] px-0.5">
          {wave.map((v, i) => (
            <div key={i} style={{ height: `${v * 100}%` }} className="flex-1 rounded-sm bg-primary/70" />
          ))}
        </div>
        {/* Playhead */}
        <div className="pointer-events-none absolute inset-y-0 w-px bg-primary" style={{ left: pct(currentTime) }}>
          <div className="absolute -top-1 -left-[5px] h-2.5 w-2.5 rounded-sm bg-primary" />
        </div>
      </div>
    </div>
  );
});
BottomTimeline.displayName = "BottomTimeline";

/* ============================ Main ============================ */
const ProjectView = () => {
  useEffect(() => { const p = startPerfMonitor(); return () => p?.stop(); }, []);
  const { id } = useParams();

  const navigate = useNavigate();
  const { user } = useAuth();
  const { blocked: creditsBlocked } = useCredits();
  const [project, setProject] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaRepairing, setMediaRepairing] = useState(false);
  const [activeLang, setActiveLang] = useState("hi");
  const [translating, setTranslating] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [editSegs, setEditSegs] = useState<Segment[] | null>(null);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [spellOpen, setSpellOpen] = useState(false);
  const [selectedSeg, setSelectedSeg] = useState<number | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [quickBusy, setQuickBusy] = useState(false);
  const [dubOpen, setDubOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"captions" | "video" | "style">("video");
  // Bottom-sheet mode for very small screens (< 640px). 'closed' means base view (video) fully visible.
  const [sheetHeight, setSheetHeight] = useState<"closed" | "peek" | "half" | "full">("closed");
  const [isPhone, setIsPhone] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 639px)").matches : false
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 639px)");
    const on = () => setIsPhone(mq.matches);
    on();
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
 
  }, []);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  // Minimum width that guarantees the tab row (Text / Templates / Motion / Music / AI Audio)
  // fits on a single line without horizontal scroll or label overlap.
  const RIGHT_PANEL_MIN = 340;
  const RIGHT_PANEL_MAX = 640;
  const rightWidthKey = id ? `yc:rightWidth:${id}` : "yc:rightWidth";
  const [rightPanelWidth, setRightPanelWidth] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(id ? `yc:rightWidth:${id}` : "yc:rightWidth");
      if (raw) {
        const n = Number(raw);
        if (Number.isFinite(n)) return Math.max(RIGHT_PANEL_MIN, Math.min(RIGHT_PANEL_MAX, n));
      }
    } catch {}
    return RIGHT_PANEL_MIN;
  });
  useEffect(() => {
    try { localStorage.setItem(rightWidthKey, String(rightPanelWidth)); } catch {}
  }, [rightPanelWidth, rightWidthKey]);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const startRightResize = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    const pid = e.pointerId;
    try { target.setPointerCapture(pid); } catch {}
    const startX = e.clientX;
    const startW = rightPanelWidth;
    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    const prevTouch = document.body.style.touchAction;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.body.style.touchAction = "none";
    let moved = false;
    let raf = 0;
    let pendingW = startW;
    const flush = () => { raf = 0; setRightPanelWidth(pendingW); };
    const onMove = (ev: PointerEvent) => {
      ev.preventDefault();
      const dx = startX - ev.clientX;
      if (Math.abs(dx) > 3) moved = true;
      pendingW = Math.max(RIGHT_PANEL_MIN, Math.min(RIGHT_PANEL_MAX, startW + dx));
      if (moved && !raf) raf = requestAnimationFrame(flush);
      if (moved) setIsResizingRight(true);
    };
    const onUp = (ev: PointerEvent) => {
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      target.removeEventListener("pointercancel", onUp);
      try { target.releasePointerCapture(pid); } catch {}
      if (raf) cancelAnimationFrame(raf);
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
      document.body.style.touchAction = prevTouch;
      setIsResizingRight(false);
      if (!moved) setRightPanelCollapsed(true);
    };
    target.addEventListener("pointermove", onMove, { passive: false });
    target.addEventListener("pointerup", onUp);
    target.addEventListener("pointercancel", onUp);
  }, [rightPanelWidth]);
  const capWidthKey = id ? `yc:capWidth:${id}` : "yc:capWidth";
  const [captionsWidth, setCaptionsWidth] = useState<number | null>(() => {
    try {
      const raw = localStorage.getItem(id ? `yc:capWidth:${id}` : "yc:capWidth");
      if (raw) {
        const n = Number(raw);
        if (Number.isFinite(n) && n >= 240 && n <= 900) return n;
      }
    } catch {}
    return null;
  });
  useEffect(() => {
    try {
      if (captionsWidth == null) localStorage.removeItem(capWidthKey);
      else localStorage.setItem(capWidthKey, String(captionsWidth));
    } catch {}
  }, [captionsWidth, capWidthKey]);
  const [isResizingCaptions, setIsResizingCaptions] = useState(false);
  const [videoFrameW, setVideoFrameW] = useState(0);
  const videoTrackKey = id ? `yc:videoTrackW:${id}` : "yc:videoTrackW";
  const [customVideoTrackW, setCustomVideoTrackW] = useState<number | null>(() => {
    try {
      const raw = localStorage.getItem(id ? `yc:videoTrackW:${id}` : "yc:videoTrackW");
      if (!raw) return null;
      const n = Number(raw);
      return Number.isFinite(n) && n > 0 ? n : null;
    } catch { return null; }
  });
  useEffect(() => {
    try {
      if (customVideoTrackW == null) localStorage.removeItem(videoTrackKey);
      else localStorage.setItem(videoTrackKey, String(Math.round(customVideoTrackW)));
    } catch {}
  }, [customVideoTrackW, videoTrackKey]);
  const captionsColRef = useRef<HTMLDivElement>(null);

  // Auto-fit: when true, panel width tracks transcript content on load/change.
  // Turns off the moment the user drags to a custom width; turns back on via Shift+dbl-click reset.
  const [autoFit, setAutoFit] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(`${capWidthKey}:autofit`);
      if (raw === "0") return false;
      if (raw === "1") return true;
    } catch {}
    // Default: auto-fit unless a persisted width already exists.
    return captionsWidth == null;
  });
  useEffect(() => {
    try { localStorage.setItem(`${capWidthKey}:autofit`, autoFit ? "1" : "0"); } catch {}
  }, [autoFit, capWidthKey]);
  // Viewport-aware bounds so resizing never crushes the video or overflows small screens.
  // Reserves ~360px for video + right panel at minimum.
  const getCaptionsBounds = useCallback(() => {
    const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
    const min = Math.max(240, Math.min(320, Math.round(vw * 0.18)));
    const max = Math.max(min + 80, Math.min(900, Math.round(vw * 0.55)));
    return { min, max };
 
  }, []);
  const runAutoFit = useCallback(() => {
    if (isPhone) return;
    const root = captionsColRef.current;
    if (!root) return;
    const rows = root.querySelectorAll<HTMLElement>('[data-transcript-row], .transcript-row, [role="listitem"]');
    let widest = 0;
    rows.forEach((r) => { if (r.scrollWidth > widest) widest = r.scrollWidth; });
    const { min, max } = getCaptionsBounds();
    const target = widest > 0 ? widest + 56 : Math.round((min + max) / 2);
    setCaptionsWidth(Math.max(min, Math.min(max, target)));
  }, [getCaptionsBounds, isPhone]);
  // Bump on window resize so the grid template IIFE re-evaluates against the
  // current viewport (needed when captionsWidth is null / auto).
  const [, setVpTick] = useState(0);
  // Clamp persisted width against current viewport (e.g. user resized window down).
  useEffect(() => {
    if (captionsWidth == null) return;
    const { min, max } = getCaptionsBounds();
    if (captionsWidth < min || captionsWidth > max) {
      setCaptionsWidth(Math.max(min, Math.min(max, captionsWidth)));
    }
  }, [captionsWidth, getCaptionsBounds]);
  const editorShellRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    let raf = 0;
    const bump = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setVpTick((n) => (n + 1) & 0xffff);
        const b = getCaptionsBounds();
        setCaptionsWidth((w) => (w == null ? w : Math.max(b.min, Math.min(b.max, w))));
      });
    };
    window.addEventListener("resize", bump);
    window.addEventListener("orientationchange", bump);
    // Observe the editor shell so any container-size change (devtools, sidebar
    // toggles, browser chrome, zoom) keeps the grid template + video/captions
    // alignment in sync — not just window `resize` events.
    let ro: ResizeObserver | null = null;
    const target = editorShellRef.current;
    if (target && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(bump);
      ro.observe(target);
      if (document.documentElement) ro.observe(document.documentElement);
    }
    return () => {
      window.removeEventListener("resize", bump);
      window.removeEventListener("orientationchange", bump);
      if (ro) ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [getCaptionsBounds]);
  // Restore captions width, auto-fit, snap opt-outs, and collapsed state to defaults.
  const resetLayout = useCallback(() => {
    try {
      localStorage.removeItem(capWidthKey);
      localStorage.removeItem(`${capWidthKey}:autofit`);
      localStorage.removeItem(videoTrackKey);
    } catch {}
    setCustomVideoTrackW(null);
    setCaptionsWidth(null);
    setAutoFit(true);
    setLeftCollapsed(false);
    setRightPanelCollapsed(false);
    setSheetHeight("closed");
    setMobilePanel("video");
    // Run auto-fit once the grid settles.
    setTimeout(() => runAutoFit(), 60);
    toast.success("Layout reset to defaults");
  }, [capWidthKey, videoTrackKey, runAutoFit]);
  const startCaptionsResize = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    const pid = e.pointerId;
    try { target.setPointerCapture(pid); } catch {}
    const startX = e.clientX;
    // Drag shrinks/grows the VIDEO track (inverse) so the captions column
    // (which is a 1fr filler) naturally absorbs the leftover — this guarantees
    // captions stay flush against the video with zero gap.
    const shell = editorShellRef.current?.clientWidth ?? window.innerWidth;
    const rightReserve = (rightPanelCollapsed ? 12 : rightPanelWidth);
    const videoFloor = 280;
    const videoCeil = Math.max(videoFloor + 40, shell - captionsTrackMin - rightReserve);
    // Start from the *currently rendered* video width, not the floor — this way
    // dragging in either direction produces immediate, symmetric motion.
    const currentVideoW = customVideoTrackW ?? (videoFrameW > 0 ? Math.ceil(videoFrameW) : videoFloor);
    const startVideoW = Math.max(videoFloor, Math.min(videoCeil, currentVideoW));
    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    const prevTouch = document.body.style.touchAction;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.body.style.touchAction = "none";
    setIsResizingCaptions(true);
    let raf = 0;
    let pendingW = startVideoW;
    // Subtle snap points: floor (min video), ceil (max video), midpoint, and
    // common widths. Snap within ±8px so users still get fluid drag feel.
    const midpoint = Math.round((videoFloor + videoCeil) / 2);
    const snapCandidates = Array.from(new Set([
      videoFloor, videoCeil, midpoint,
      videoFloor + 80, videoFloor + 160, videoFloor + 240,
      480, 560, 640, 720, 800, 960,
    ].filter((v) => v >= videoFloor && v <= videoCeil)));
    const SNAP_PX = 8;
    const applySnap = (w: number) => {
      let best = w; let bestD = SNAP_PX + 1;
      for (const s of snapCandidates) {
        const d = Math.abs(w - s);
        if (d <= SNAP_PX && d < bestD) { best = s; bestD = d; }
      }
      return best;
    };
    const flush = () => { raf = 0; setCustomVideoTrackW(pendingW); };
    const onMove = (ev: PointerEvent) => {
      ev.preventDefault();
      // Drag right → captions grows → video shrinks.
      const raw = Math.max(videoFloor, Math.min(videoCeil, startVideoW - (ev.clientX - startX)));
      pendingW = applySnap(raw);
      if (!raf) raf = requestAnimationFrame(flush);
    };
    const onUp = () => {
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      target.removeEventListener("pointercancel", onUp);
      try { target.releasePointerCapture(pid); } catch {}
      if (raf) cancelAnimationFrame(raf);
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
      document.body.style.touchAction = prevTouch;
      setIsResizingCaptions(false);
    };
    target.addEventListener("pointermove", onMove, { passive: false });
    target.addEventListener("pointerup", onUp);
    target.addEventListener("pointercancel", onUp);
  }, [customVideoTrackW, rightPanelCollapsed, rightPanelWidth, videoFrameW]);

  const [replacing, setReplacing] = useState(false);
  const [flaggedIdxs, setFlaggedIdxs] = useState<Set<number>>(new Set());
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  // Low-confidence review: mode ("off" = do nothing, "flag" = mark visually,
  // "hide" = also drop from saves/exports) + threshold (0..1).
  const [lowConf, setLowConf] = useState<{ mode: LowConfMode; threshold: number }>(() => {
    try { const raw = localStorage.getItem("captions:lowConf"); if (raw) return JSON.parse(raw); } catch {}
    return { mode: "off", threshold: 0.6 };
  });
  useEffect(() => { try { localStorage.setItem("captions:lowConf", JSON.stringify(lowConf)); } catch {} }, [lowConf]);
  // Sync smoothing: view-only correction of the playhead used to pick the
  // active segment/word. offsetMs shifts everything; driftPerMin adds a linear
  // correction that grows with elapsed time to fight consistent drift.
  const [sync, setSync] = useState<{ enabled: boolean; offsetMs: number; driftPerMin: number }>(() => {
    try { const raw = localStorage.getItem("captions:sync"); if (raw) return JSON.parse(raw); } catch {}
    return { enabled: false, offsetMs: 0, driftPerMin: 0 };
  });
  useEffect(() => { try { localStorage.setItem("captions:sync", JSON.stringify(sync)); } catch {} }, [sync]);

  // Word / Line view mode — persisted per project.
  const capModeKey = id ? `yc:capMode:${id}` : "yc:capMode";
  const [viewMode, setViewMode] = useState<"word" | "line">(() => {
    try {
      const v = localStorage.getItem(id ? `yc:capMode:${id}` : "yc:capMode");
      if (v === "word" || v === "line") return v;
    } catch {}
    return "line";
  });
  useEffect(() => { try { localStorage.setItem(capModeKey, viewMode); } catch {} }, [viewMode, capModeKey]);

  // ---- Edit history (undo / redo) — tracks editSegs snapshots ----
  const undoStackRef = useRef<Array<Segment[] | null>>([]);
  const redoStackRef = useRef<Array<Segment[] | null>>([]);
  const skipHistRef = useRef(false);
  useEffect(() => {
    if (skipHistRef.current) { skipHistRef.current = false; return; }
    const stack = undoStackRef.current;
    if (stack[stack.length - 1] === editSegs) return;
    stack.push(editSegs);
    if (stack.length > 60) stack.shift();
    redoStackRef.current.length = 0;
  }, [editSegs]);
  const undo = useCallback(() => {
    const stack = undoStackRef.current;
    if (stack.length < 2) { toast.message("Nothing to undo"); return; }
    const cur = stack.pop()!;
    redoStackRef.current.push(cur);
    const prev = stack[stack.length - 1];
    skipHistRef.current = true;
    setEditSegs(prev ?? null);
    setDirty(true);
 
  }, []);
  const redo = useCallback(() => {
    const next = redoStackRef.current.pop();
    if (next === undefined) { toast.message("Nothing to redo"); return; }
    undoStackRef.current.push(next);
    skipHistRef.current = true;
    setEditSegs(next);
    setDirty(true);
 
  }, []);

  useHotkeys(
    {
      "?": () => setShortcutsOpen((v) => !v),
      "shift+/": () => setShortcutsOpen((v) => !v),
      escape: () => { setShortcutsOpen(false); setExportOpen(false); setDubOpen(false); },
      "mod+z": (e) => { if ((e as any).shiftKey) redo(); else undo(); },
      "mod+y": () => redo(),
    },
    [undo, redo],
  );

  // Per-project + per-language caption style persistence (autosave).
  // Scoping by project id ensures every project keeps its own captions look
  // (font, colors, position, template, etc.) across reloads.
  const STYLE_MAP_KEY = id ? `captions:style:byLang:${id}` : "captions:style:byLang";
  const LEGACY_MAP_KEY = "captions:style:byLang"; // pre-per-project global map
  const LEGACY_STYLE_KEY = "captions:style";
  const readStyleMap = useCallback((): Record<string, Partial<CapStyle>> => {
    try { const raw = localStorage.getItem(STYLE_MAP_KEY); if (raw) return JSON.parse(raw); } catch {}
    return {};
  }, [STYLE_MAP_KEY]);
  const [capStyle, setCapStyle] = useState<CapStyle>(() => {
    try {
      const raw = localStorage.getItem(STYLE_MAP_KEY);
      const map: Record<string, Partial<CapStyle>> = raw ? JSON.parse(raw) : {};
      const forLang = map[activeLang] ?? map._default;
      if (forLang) return normalizeCapStyle({ ...DEFAULT_CAP_STYLE, ...forLang });
    } catch {}
    // Fallbacks for projects opened before per-project scoping existed.
    try {
      const rawLegacyMap = localStorage.getItem(LEGACY_MAP_KEY);
      if (rawLegacyMap) {
        const map = JSON.parse(rawLegacyMap);
        const forLang = map[activeLang] ?? map._default;
        if (forLang) return normalizeCapStyle({ ...DEFAULT_CAP_STYLE, ...forLang });
      }
      const raw = localStorage.getItem(LEGACY_STYLE_KEY);
      if (raw) return normalizeCapStyle({ ...DEFAULT_CAP_STYLE, ...JSON.parse(raw) });
    } catch {}
    return normalizeCapStyle(DEFAULT_CAP_STYLE);
  });
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [activeTemplateName, setActiveTemplateName] = useState<string | null>(null);
  const { isPaid, planId } = usePlanInfo();
  const caps = getPlanCapabilities(planId);
  const { isAdmin } = useIsAdmin();
  const { names: freeTemplateNames } = useFreeTemplates();
  const { toast: notifyToast } = useToast();
  const isPremiumTemplateActive = !!activeTemplateName &&
    !canUseTemplate({ name: activeTemplateName, freeNames: freeTemplateNames, isPaid, isAdmin });
  const gateDownload = useCallback((run: () => void) => {
    if (isPremiumTemplateActive) {
      notifyToast({
        title: "Premium template on your video",
        description: "Downloads with premium templates are for paid users. Switch to a free template or upgrade to export this look.",
        action: (
          <button
            onClick={() => navigate("/pricing")}
            className="rounded-md bg-primary px-3 py-1.5 text-[13px] font-semibold text-primary-foreground"
          >Upgrade</button>
        ) as any,
      });
      return;
    }
    run();
  }, [isPremiumTemplateActive, notifyToast, navigate]);
  // Load the saved style whenever the active language (or project) changes.
  useEffect(() => {
    const appliedTemplateName = localStorage.getItem("captions:appliedTemplate");
    if (appliedTemplateName) {
      const preset = CAP_PRESETS.find((p) => p.name.toLowerCase() === appliedTemplateName.toLowerCase())
        || CAP_PRESETS.find((p) => {
             const cleanApplied = appliedTemplateName.toLowerCase().replace(/^(moonshot|diveo|captions\.ai|captik|kalakar|kinetic|reels|dynamic|desi|creator)\s*·\s*/i, "");
             const cleanP = p.name.toLowerCase().replace(/^(moonshot|diveo|captions\.ai|captik|kalakar|kinetic|reels|dynamic|desi|creator)\s*·\s*/i, "");
             return cleanP === cleanApplied || p.name.toLowerCase().includes(cleanApplied);
           });
      if (preset) {
        setCapStyle(normalizeCapStyle({ ...DEFAULT_CAP_STYLE, ...preset.patch }));
        toast.success(`Applied template "${preset.name}"!`);
        localStorage.removeItem("captions:appliedTemplate");
        return;
      }
    }
    const map = readStyleMap();
    const forLang = map[activeLang] ?? map._default;
    if (forLang) setCapStyle(normalizeCapStyle({ ...DEFAULT_CAP_STYLE, ...forLang }));
  }, [activeLang, readStyleMap]);
  // Persist the current style under the active language and as the new default.
  // Debounced so rapid slider/drag updates don't thrash localStorage.
  useEffect(() => {
    setSaveState("saving");
    const t = setTimeout(() => {
      try {
        const map = readStyleMap();
        map[activeLang] = capStyle;
        map._default = capStyle;
        localStorage.setItem(STYLE_MAP_KEY, JSON.stringify(map));
        localStorage.setItem(LEGACY_STYLE_KEY, JSON.stringify(capStyle));
        setSaveState("saved");
      } catch {
        setSaveState("idle");
      }
    }, 250);
    return () => clearTimeout(t);
  }, [capStyle, activeLang, readStyleMap, STYLE_MAP_KEY]);
  // Fade "Saved" indicator back to idle after a moment.
  useEffect(() => {
    if (saveState !== "saved") return;
    const t = setTimeout(() => setSaveState("idle"), 1500);
    return () => clearTimeout(t);
  }, [saveState]);

  // ---------- Undo / Redo for caption style + position ----------
  // Rapid slider drags and pointer moves would flood a naive history stack,
  // so we coalesce consecutive edits into one entry by debouncing 400ms after
  // the user pauses. Each entry is a full CapStyle snapshot plus a
  // human-readable label + timestamp so the History panel can list them.
  // Typical stacks stay small (a few KB), well under the 50-entry cap.
  type HistEntry = { style: CapStyle; label: string; at: number };
  const historyRef = useRef<{ past: HistEntry[]; future: HistEntry[]; current: HistEntry }>({
    past: [],
    future: [],
    current: { style: capStyle, label: "Initial", at: Date.now() },
  });
  const applyingHistoryRef = useRef(false);
  const [historyTick, setHistoryTick] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const HISTORY_MAX = 50;
  useEffect(() => {
    // If this change came from undo/redo/jump itself, don't record it — just
    // sync the "current" entry so the next real edit compares correctly.
    if (applyingHistoryRef.current) {
      applyingHistoryRef.current = false;
      return;
    }
    const t = setTimeout(() => {
      const prev = historyRef.current.current;
      // Cheap change detector — JSON.stringify is fine for a ~1KB style blob
      // fired at most every 400ms.
      if (JSON.stringify(prev.style) === JSON.stringify(capStyle)) return;
      historyRef.current.past.push(prev);
      if (historyRef.current.past.length > HISTORY_MAX) historyRef.current.past.shift();
      historyRef.current.future = [];
      // Label describes the transition prev → new.
      historyRef.current.current = {
        style: capStyle,
        label: describeCapDiff(prev.style, capStyle),
        at: Date.now(),
      };
      setHistoryTick((n) => n + 1);
    }, 400);
    return () => clearTimeout(t);
  }, [capStyle]);
  const canUndo = historyRef.current.past.length > 0;
  const canRedo = historyRef.current.future.length > 0;
  const undoCaption = useCallback(() => {
    const h = historyRef.current;
    if (h.past.length === 0) return;
    const prev = h.past.pop()!;
    h.future.push(h.current);
    if (h.future.length > HISTORY_MAX) h.future.shift();
    applyingHistoryRef.current = true;
    h.current = prev;
    setCapStyle(prev.style);
    setHistoryTick((n) => n + 1);
 
  }, []);
  const redoCaption = useCallback(() => {
    const h = historyRef.current;
    if (h.future.length === 0) return;
    const next = h.future.pop()!;
    h.past.push(h.current);
    if (h.past.length > HISTORY_MAX) h.past.shift();
    applyingHistoryRef.current = true;
    h.current = next;
    setCapStyle(next.style);
    setHistoryTick((n) => n + 1);
 
  }, []);
  // Jump directly to any past step. Everything between it and the current
  // state (inclusive of the current) gets moved to the future stack in the
  // right order, so subsequent undo/redo still walks the timeline correctly.
  const jumpToPast = useCallback((index: number) => {
    const h = historyRef.current;
    if (index < 0 || index >= h.past.length) return;
    const target = h.past[index];
    const moved = h.past.slice(index + 1); // entries between target and current
    // future stack is pop-order (top = "nearest ahead") so push current first,
    // then moved entries newest-first — i.e. moved.reverse() then push.
    const newFuture = [...h.future, h.current, ...moved.reverse()];
    // Enforce cap by trimming oldest future entries (front of array).
    while (newFuture.length > HISTORY_MAX) newFuture.shift();
    h.past = h.past.slice(0, index);
    h.future = newFuture;
    applyingHistoryRef.current = true;
    h.current = target;
    setCapStyle(target.style);
    setHistoryTick((n) => n + 1);
 
  }, []);
  // Jump directly to any future step. Symmetric to jumpToPast.
  const jumpToFuture = useCallback((index: number) => {
    const h = historyRef.current;
    if (index < 0 || index >= h.future.length) return;
    const target = h.future[index];
    // future is pop-ordered — entries at higher indices are "closer" to current.
    // Steps between current and target = future[index+1 .. end], in that order
    // they should be re-inserted into past (oldest first from timeline view).
    const between = h.future.slice(index + 1).reverse();
    const newPast = [...h.past, h.current, ...between];
    while (newPast.length > HISTORY_MAX) newPast.shift();
    h.future = h.future.slice(0, index);
    h.past = newPast;
    applyingHistoryRef.current = true;
    h.current = target;
    setCapStyle(target.style);
    setHistoryTick((n) => n + 1);
 
  }, []);
  // Reset stacks when switching language or project so undo doesn't cross into
  // a different caption context.
  useEffect(() => {
    historyRef.current = {
      past: [],
      future: [],
      current: { style: capStyle, label: "Opened", at: Date.now() },
    };
    setHistoryTick((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLang, id]);
  // Keyboard shortcuts — Cmd/Ctrl+Z to undo, Cmd+Shift+Z / Ctrl+Y to redo.
  // Skip when focus is inside an editable field so the browser's own text
  // undo still works there.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField = !!target && (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      );
      if (inField) return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) { e.preventDefault(); undoCaption(); }
      else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); redoCaption(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undoCaption, redoCaption]);
  // Reference historyTick so React re-renders undo/redo button enabled states.
  void historyTick;
  // Build the entry list the panel renders — oldest at top, newest at bottom,
  // "current" in between. Recomputed only when the stacks change (historyTick).
  const historyEntries = useMemo(() => {
    const h = historyRef.current;
    const past = h.past.map((e, i) => ({ label: e.label, at: e.at, kind: "past" as const, index: i }));
    const cur = { label: h.current.label, at: h.current.at, kind: "current" as const, index: 0 };
    // future is pop-ordered (last = nearest ahead) — for display, show nearest
    // ahead first (right below current), so iterate from end → start.
    const future = [...h.future].reverse().map((e, i, arr) => ({
      label: e.label,
      at: e.at,
      kind: "future" as const,
      // Translate display index back to real future array index: nearest ahead
      // is future[future.length - 1] → display i=0.
      index: arr.length - 1 - i,
    }));
    return [...past, cur, ...future];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyTick]);


  const videoRef = useRef<HTMLVideoElement>(null);
  const activeRowRef = useRef<HTMLDivElement>(null);
  const [videoAspect, setVideoAspect] = useState<number>(16 / 9);
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onMeta = () => {
      if (v.videoWidth && v.videoHeight) setVideoAspect(v.videoWidth / v.videoHeight);
    };
    v.addEventListener("loadedmetadata", onMeta);
    if (v.readyState >= 1) onMeta();
    return () => v.removeEventListener("loadedmetadata", onMeta);
 
  }, []);

  const seek = useCallback((t: number) => { const v = videoRef.current; if (!v) return; v.currentTime = t; }, []);

  const signedPathRef = useRef<string | null>(null);
  const repairAttemptedRef = useRef<string | null>(null);
  const repairInFlightRef = useRef(false);
  const activeLangRef = useRef(activeLang);
  useEffect(() => { activeLangRef.current = activeLang; }, [activeLang]);
  const load = useCallback(async () => {
    if (!id) return;
    const { data: p } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
    setProject(p as Project | null);
    if (p?.media_path && signedPathRef.current !== p.media_path) {
      signedPathRef.current = p.media_path;
      const { data: signed } = await supabase.storage.from("media").createSignedUrl(p.media_path, 3600);
      setMediaUrl(signed?.signedUrl ?? null);
      repairAttemptedRef.current = null;
    }
    const { data: c } = await supabase.from("captions").select("*").eq("project_id", id);
    const list = (c ?? []) as unknown as Caption[];
    setCaptions(list);
    if (p && list.length && !list.find((x) => x.language === activeLangRef.current)) setActiveLang(p.source_language);
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!id) return;
    if (project?.status === "ready" || project?.status === "failed") return;
    const t = setInterval(load, 4000); return () => clearInterval(t);
  }, [id, project?.status, load]);


  const sourceLang = project?.source_language;
  const captionsForLang = useMemo(() => captions.filter((c) => c.language === activeLang), [captions, activeLang]);
  const active = useMemo(() => (
    activeLang === sourceLang && project?.compare_mode && project?.chosen_provider
      ? captionsForLang.find((c) => c.provider === project.chosen_provider) ?? captionsForLang[0]
      : captionsForLang[0]
  ), [captionsForLang, activeLang, sourceLang, project?.compare_mode, project?.chosen_provider]);
  const segs = useMemo(() => editSegs ?? active?.segments ?? [], [editSegs, active]);
  const autoRetryRef = useRef<string | null>(null);
  // Auto-fit whenever transcript content loads or changes, unless the user set a manual width.
  useEffect(() => {
    if (!autoFit || isPhone) return;
    if (!segs || segs.length === 0) return;
    const t = window.setTimeout(() => runAutoFit(), 80);
    return () => window.clearTimeout(t);
  }, [autoFit, isPhone, segs, viewMode, runAutoFit]);

  useEffect(() => {
    if (!id || !project || active || captions.length) return;
    if (project.status !== "processing" && project.status !== "uploading") return;
    if (autoRetryRef.current === id) return;

    let cancelled = false;
    const checkStaleJob = async () => {
      const { data } = await supabase
        .from("jobs")
        .select("id,status,updated_at,message")
        .eq("project_id", id)
        .eq("kind", "transcribe")
        .order("created_at", { ascending: false })
        .limit(1);
      if (cancelled) return;
      const latest = (data ?? [])[0] as { id: string; status: string; updated_at: string; message?: string | null } | undefined;
      const latestMs = latest ? new Date(latest.updated_at).getTime() : 0;
      const stale = !latest || ((latest.status === "queued" || latest.status === "running") && Date.now() - latestMs > 90_000);
      if (!stale) return;

      autoRetryRef.current = id;
      try {
        if (latest?.id) {
          await supabase.from("jobs").update({
            status: "failed",
            message: "Stale transcription restarted",
            error: `No progress after ${latest.message ?? "queue"}`,
            finished_at: new Date().toISOString(),
          }).eq("id", latest.id);
        }
        toast.message("Restarting stuck caption generation…");
        const { error } = await invokeWithRetry("transcribe", { body: { project_id: id, provider: project.chosen_provider ?? "deepgram" } });
        if (error) throw error;
        await load();
      } catch (e: any) {
        toast.error("Caption generation restart failed", { description: e?.message ?? String(e) });
      }
    };

    const timer = window.setTimeout(checkStaleJob, 1200);
    return () => { cancelled = true; window.clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, project?.id, project?.status, project?.chosen_provider, active?.id, captions.length]);
  // Precompute low-confidence segments/words for the current threshold. Used
  // for visual marks in the transcript, and (when mode === "hide") for filtering
  // out of saves and downloads.
  const lowConfInfo = useMemo(
    () => computeLowConf(segs, lowConf.threshold),
    [segs, lowConf.threshold],
  );
  // Reflect low-confidence segments into the shared flaggedIdxs set whenever
  // review mode is active — reuses the existing amber row treatment / "review"
  // banner so behaviour matches the manual TranscribeCompare flow.
  useEffect(() => {
    if (lowConf.mode === "off") return;
    setFlaggedIdxs(lowConfInfo.segIdxs);
  }, [lowConf.mode, lowConfInfo]);
  const uniqueLangs = useMemo(() => Array.from(new Set(captions.map((c) => c.language))), [captions]);
  const isAudio = useMemo(() => /\.(mp3|wav|m4a|aac|ogg|flac|opus|weba)$/.test((project?.media_path ?? "").toLowerCase()), [project?.media_path]);

  useEffect(() => { setEditSegs(null); setDirty(false); }, [activeLang, active?.id]);

  const handleFlagLowConfidence = useCallback((times: number[]) => {
    if (!segs.length) return;
    const set = new Set<number>();
    for (const t of times) {
      let best = -1, bestD = Infinity;
      for (let i = 0; i < segs.length; i++) {
        const mid = (segs[i].start + segs[i].end) / 2;
        const d = Math.abs(mid - t);
        if (d < bestD) { bestD = d; best = i; }
      }
      if (best >= 0) set.add(best);
    }
    setFlaggedIdxs(set);
    setFlaggedOnly(true);
  }, [segs]);
  const clearFlagged = useCallback(() => { setFlaggedIdxs(new Set()); setFlaggedOnly(false); }, []);

  useEffect(() => {
    const v = videoRef.current; if (!v) return;
    let raf = 0;
    let last = -1;
    // Push on every rAF while playing so the active-word chip stays frame-accurate.
    // Skip only when the delta is below ~1 ms (same wall clock, e.g. paused rAF).
    // Throttle React state updates to ~30fps. The <video> element itself
    // still plays at native frame rate; we only need to re-render the caption
    // highlight tree fast enough that word transitions look tight. Halving
    // the setState frequency roughly halves editor CPU during playback and
    // makes drag/scrub feel much smoother on mid-range laptops and phones.
    const MIN_DELTA = 1 / 30; // 33ms
    const push = (t: number) => { if (Math.abs(t - last) >= MIN_DELTA) { last = t; setCurrentTime(t); } };
    const tick = () => { push(v.currentTime); raf = requestAnimationFrame(tick); };
    const onTime = () => push(v.currentTime);
    const onPlay = () => { setPlaying(true); cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); };
    const onPause = () => { setPlaying(false); cancelAnimationFrame(raf); last = -1; setCurrentTime(v.currentTime); };
    const onSeeked = () => { last = -1; setCurrentTime(v.currentTime); };
    // Instant sync while user drags the progress bar: keep pushing currentTime
    // during the seeking phase so caption highlights update live, not only on release.
    const onSeeking = () => { last = -1; setCurrentTime(v.currentTime); cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); };
    // Buffering / rate changes can freeze timeupdate; force a resync so highlights
    // don't drift once playback resumes at a new position or speed.
    const onWaiting = () => { last = -1; };
    const onCanPlay = () => { last = -1; setCurrentTime(v.currentTime); };
    const onRateChange = () => { last = -1; setPlaybackRate(v.playbackRate || 1); };
    const onMeta = () => { if (Number.isFinite(v.duration)) setDuration(v.duration); };
    v.addEventListener("timeupdate", onTime); v.addEventListener("play", onPlay); v.addEventListener("pause", onPause);
    v.addEventListener("seeked", onSeeked);
    v.addEventListener("seeking", onSeeking);
    v.addEventListener("waiting", onWaiting);
    v.addEventListener("canplay", onCanPlay);
    v.addEventListener("ratechange", onRateChange);
    v.addEventListener("loadedmetadata", onMeta); v.addEventListener("durationchange", onMeta);
    setPlaybackRate(v.playbackRate || 1);
    if (!v.paused) { raf = requestAnimationFrame(tick); }
    return () => {
      cancelAnimationFrame(raf);
      v.removeEventListener("timeupdate", onTime); v.removeEventListener("play", onPlay); v.removeEventListener("pause", onPause);
      v.removeEventListener("seeked", onSeeked);
      v.removeEventListener("seeking", onSeeking);
      v.removeEventListener("waiting", onWaiting);
      v.removeEventListener("canplay", onCanPlay);
      v.removeEventListener("ratechange", onRateChange);
      v.removeEventListener("loadedmetadata", onMeta); v.removeEventListener("durationchange", onMeta);
    };
  }, [mediaUrl]);

  // Apply user sync offset/drift AND compensate for render/paint latency scaled
  // by current playback rate — at 2x speed, one frame late = twice as much drift.
  const syncedTime = useMemo(() => {
    // Use the video's own clock 1:1 — no artificial lookahead. Any perceived
    // offset should be dialed in via the user-facing Sync Smoothing panel so
    // it's explicit, not a hidden nudge that fights word-level timings.
    const base = currentTime;
    if (!sync.enabled) return base;
    return base + sync.offsetMs / 1000 + (sync.driftPerMin / 60000) * base;
  }, [currentTime, sync]);

  const activeIdx = useMemo(() => {
    const n = segs.length; if (n === 0) return -1;
    let lo = 0, hi = n - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const s = segs[mid];
      if (syncedTime < s.start) hi = mid - 1;
      else if (syncedTime > s.end) lo = mid + 1;
      else return mid;
    }
    // Sticky fallback: in short gaps (<250ms) between cues, keep the nearer cue
    // highlighted so the row doesn't flicker off and on during natural pauses.
    const after = lo, before = hi;
    const gapTol = 0.25;
    if (before >= 0 && syncedTime - segs[before].end < gapTol) {
      if (after < n && segs[after].start - syncedTime < syncedTime - segs[before].end) return after;
      return before;
    }
    if (after < n && segs[after].start - syncedTime < gapTol) return after;
    return -1;
  }, [segs, syncedTime]);

  useEffect(() => {
    const el = activeRowRef.current; if (activeIdx < 0 || !el) return;
    let sc: HTMLElement | null = el.parentElement;
    while (sc && sc !== document.body) {
      const st = getComputedStyle(sc);
      if (/(auto|scroll)/.test(st.overflowY) && sc.scrollHeight > sc.clientHeight) break;
      sc = sc.parentElement;
    }
    if (!sc || sc === document.body) return;
    const s = sc.getBoundingClientRect(), r = el.getBoundingClientRect();
    sc.scrollBy({ top: r.top - s.top - (s.height / 2 - r.height / 2), behavior: "smooth" });
  }, [activeIdx]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) { logEditorControlError(new Error("Video element not ready"), { control: "play_pause" }); return; }
    try {
      if (v.paused) {
        v.muted = false;
        if (v.volume <= 0.01) v.volume = 0.8;
        if (v.ended) v.currentTime = 0;
        const p = v.play();
        if (p && typeof p.then === "function") {
          p.catch((err: unknown) => {
            // Route through the playback logger — it classifies AbortError /
            // autoplay-blocked / decode / src-unsupported and only toasts the
            // non-benign categories.
            logPlaybackError({ surface: "project_preview", element: v, thrown: err, extra: { action: "play" } });
          });
        }
      } else {
        v.pause();
      }
    } catch (err) {
      logEditorControlError(err, { control: "play_pause", action: v.paused ? "play" : "pause" });
    }
 
  }, []);

  const handleMediaUnsupported = useCallback(async () => {
    if (!id || !project?.media_path || mediaRepairing) return;
    if (repairInFlightRef.current) return;
    if (repairAttemptedRef.current === project.media_path) return;
    const repairLockKey = `yc:mediaRepair:${id}:${project.media_path}`;
    const lastRepairAttempt = Number(localStorage.getItem(repairLockKey) || 0);
    if (Number.isFinite(lastRepairAttempt) && Date.now() - lastRepairAttempt < 120_000) return;
    repairAttemptedRef.current = project.media_path;
    repairInFlightRef.current = true;
    try { localStorage.setItem(repairLockKey, String(Date.now())); } catch {}
    setMediaRepairing(true);
    const t = toast.loading("Repairing video playback…");
    try {
      const { data, error } = await invokeWithRetry<{ ok?: boolean; media_path?: string; signedUrl?: string | null }>(
        "repair-media",
        { body: { project_id: id } },
        { maxAttempts: 1 },
      );
      if (error) throw error;
      if (data?.signedUrl) setMediaUrl(data.signedUrl);
      if (data?.media_path) {
        signedPathRef.current = data.media_path;
        setProject((p) => (p ? { ...p, media_path: data.media_path ?? p.media_path, error_message: null } : p));
        try { localStorage.removeItem(repairLockKey); } catch {}
      }
      toast.success("Video repaired — preview is ready", { id: t });
    } catch (e: any) {
      logEditorControlError(e, { control: "replace_media", action: "repair", context: { projectId: id, mediaPath: project.media_path }, silent: true });
      toast.error("Video needs re-upload", {
        id: t,
        description: e?.message?.includes("not configured")
          ? "The media repair converter is not configured yet. Upload an H.264/AAC MP4 for immediate playback."
          : e?.message ?? "This file's codec is not supported by the browser.",
      });
    } finally {
      repairInFlightRef.current = false;
      setMediaRepairing(false);
    }
  }, [id, project?.media_path, mediaRepairing]);

  const translate = async (target: string) => {
    if (!id) return;
    if (creditsBlocked) { toast.error("You're out of credits — upgrade your plan to translate."); return; }
    setTranslating(true);
    const { error } = await invokeWithRetry("translate-captions", { body: { project_id: id, target_language: target } }, {
      onRetry: (attempt, ms) => toast.message(`Rate limited — retrying (${attempt}) in ${Math.ceil(ms / 1000)}s`),
    });
    setTranslating(false);
    if (error) {
      if (detectRateLimit(error, "translate-captions")) return;
      return toast.error(error.message);
    }
    toast.success("Translated");
    await load();
    setActiveLang(target);
  };

  const download = (fmt: "srt" | "vtt" = "srt") => {
    if (!active) return;
    const source = lowConf.mode === "hide" ? filterLowConf(segs, lowConf.threshold) : segs;
    const body = buildCaptions(source, fmt);
    const blob = new Blob([body], { type: fmt === "vtt" ? "text/vtt" : "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${project?.title ?? "captions"}-${activeLang}.${fmt}`;
    a.click();
  };

  const editSegText = useCallback((i: number, text: string) => {
    setEditSegs((prev) => {
      const base = prev ?? active?.segments ?? [];
      const next = [...base]; next[i] = { ...next[i], text };
      return next;
    });
    setDirty(true);
  }, [active]);
  const editSegTime = useCallback((i: number, patch: { start?: number; end?: number }) => {
    setEditSegs((prev) => {
      const base = prev ?? active?.segments ?? [];
      const next = base.map((s) => ({ ...s })); const c = next[i], p = next[i-1], n = next[i+1];
      const MIN = 0.2;
      let s = patch.start ?? c.start, e = patch.end ?? c.end;
      if (p) s = Math.max(s, p.end); if (n) e = Math.min(e, n.start);
      s = Math.max(0, s); if (duration > 0) e = Math.min(e, duration);
      if (e - s < MIN) { if (patch.start !== undefined) s = e - MIN; else e = s + MIN; }
      next[i] = { ...c, start: s, end: e };
      return next;
    });
    setDirty(true);
  }, [active, duration]);

  // Session-only per-word visual state (segIdx:wordIdx keys).
  const [emphasized, setEmphasized] = useState<Set<string>>(new Set());
  const [spotlighted, setSpotlighted] = useState<Set<string>>(new Set());
  const toggleWordVisual = useCallback((kind: "emph" | "spot", segIdx: number, wi: number) => {
    const setFn = kind === "emph" ? setEmphasized : setSpotlighted;
    setFn((prev) => {
      const key = `${segIdx}:${wi}`;
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
 
  }, []);

  // Split a segment at a given word index. If wordIdx is null, splits at midpoint.
  // Uses word-level timings when available for frame-accurate cuts; falls back to proportional.
  const splitSegAt = useCallback((i: number, wordIdx?: number) => {
    setEditSegs((prev) => {
      const base = prev ?? active?.segments ?? [];
      const s = base[i]; if (!s) return prev;
      const words = s.text.trim().split(/\s+/).filter(Boolean);
      if (words.length < 2) { toast.message("Not enough words to break"); return prev; }
      const cutAt = wordIdx != null ? Math.max(1, Math.min(words.length - 1, wordIdx)) : Math.floor(words.length / 2);

      // Prefer real word-level timing when the transcript carries it.
      let cut: number;
      const wt = s.words;
      if (wt && wt.length === words.length && wt[cutAt - 1] && wt[cutAt]) {
        cut = (wt[cutAt - 1].end + wt[cutAt].start) / 2;
      } else {
        const dur = s.end - s.start;
        cut = s.start + dur * (cutAt / words.length);
      }
      cut = Math.min(s.end - 0.05, Math.max(s.start + 0.05, cut));

      const leftWords = wt ? wt.slice(0, cutAt) : undefined;
      const rightWords = wt ? wt.slice(cutAt) : undefined;
      const left: Segment = { ...s, text: words.slice(0, cutAt).join(" "), end: cut, words: leftWords };
      const right: Segment = { ...s, text: words.slice(cutAt).join(" "), start: cut, words: rightWords };
      const next = [...base]; next.splice(i, 1, left, right);
      return next;
    });
    setDirty(true);
  }, [active]);

  const deleteSeg = useCallback((i: number) => {
    setEditSegs((prev) => {
      const base = prev ?? active?.segments ?? [];
      return base.filter((_, idx) => idx !== i);
    });
    setDirty(true);
  }, [active]);

  // Remove a single word from a segment.
  const deleteWord = useCallback((i: number, wi: number) => {
    setEditSegs((prev) => {
      const base = prev ?? active?.segments ?? [];
      const s = base[i]; if (!s) return prev;
      const words = s.text.split(/\s+/).filter(Boolean);
      if (wi < 0 || wi >= words.length) return prev;
      words.splice(wi, 1);
      const next = [...base];
      next[i] = { ...s, text: words.join(" ") };
      return next;
    });
    setDirty(true);
  }, [active]);

  // Rename a single word in-place (used by the caption-overlay context menu).
  const editWord = useCallback((i: number, wi: number) => {
    const base = editSegs ?? active?.segments ?? [];
    const s = base[i]; if (!s) return;
    const words = s.text.split(/\s+/).filter(Boolean);
    if (wi < 0 || wi >= words.length) return;
    const next = window.prompt("Edit word", words[wi]);
    if (next == null) return;
    const cleaned = next.trim();
    if (!cleaned) return;
    setEditSegs((prev) => {
      const b = prev ?? active?.segments ?? [];
      const seg = b[i]; if (!seg) return prev;
      const ws = seg.text.split(/\s+/).filter(Boolean);
      if (wi >= ws.length) return prev;
      ws[wi] = cleaned;
      const out = [...b];
      out[i] = { ...seg, text: ws.join(" ") };
      return out;
    });
    setDirty(true);
  }, [active, editSegs]);


  // Move a word to the previous or next caption block.
  const moveWord = useCallback((i: number, wi: number, dir: "prev" | "next") => {
    setEditSegs((prev) => {
      const base = prev ?? active?.segments ?? [];
      const src = base[i]; const targetIdx = dir === "prev" ? i - 1 : i + 1;
      const tgt = base[targetIdx];
      if (!src || !tgt) { toast.message(`No ${dir} line`); return prev; }
      const srcWords = src.text.split(/\s+/).filter(Boolean);
      if (wi < 0 || wi >= srcWords.length) return prev;
      const [moved] = srcWords.splice(wi, 1);
      const tgtWords = tgt.text.split(/\s+/).filter(Boolean);
      if (dir === "prev") tgtWords.push(moved); else tgtWords.unshift(moved);
      const next = [...base];
      next[i] = { ...src, text: srcWords.join(" "), words: undefined };
      next[targetIdx] = { ...tgt, text: tgtWords.join(" "), words: undefined };
      return next;
    });
    setDirty(true);
  }, [active]);

  // Reflow: regroup words across segments to obey max-words / max-chars / max-lines rules.
  // Timing is redistributed proportionally by word count within the original merged span.
  const reflowSegs = useCallback((opts: { words: number; chars: number; lines: number }) => {
    setEditSegs((prev) => {
      const base = prev ?? active?.segments ?? [];
      if (!base.length) return prev;
      // Collect words with proportional timestamps within each original segment.
      type W = { text: string; start: number; end: number };
      const all: W[] = [];
      for (const s of base) {
        const ws = s.text.split(/\s+/).filter(Boolean);
        if (!ws.length) continue;
        const dur = Math.max(0.001, s.end - s.start);
        const per = dur / ws.length;
        ws.forEach((t, k) => all.push({ text: t, start: s.start + k * per, end: s.start + (k + 1) * per }));
      }
      if (!all.length) return prev;
      const maxW = Math.max(1, opts.words) * Math.max(1, opts.lines);
      const maxC = Math.max(4, opts.chars) * Math.max(1, opts.lines);
      const out: Segment[] = [];
      let bucket: W[] = [];
      let bucketChars = 0;
      const flush = () => {
        if (!bucket.length) return;
        out.push({ start: bucket[0].start, end: bucket[bucket.length - 1].end, text: bucket.map((w) => w.text).join(" ") });
        bucket = []; bucketChars = 0;
      };
      for (const w of all) {
        const nextChars = bucketChars + (bucketChars ? 1 : 0) + w.text.length;
        if (bucket.length >= maxW || nextChars > maxC) flush();
        bucket.push(w); bucketChars = bucket.map((x) => x.text).join(" ").length;
      }
      flush();
      return out;
    });
    setDirty(true);
  }, [active]);

  const applyCaptionTool = useCallback((tool: "gaps" | "emojis" | "delay" | "punctuation" | "emphasis", value?: number) => {
    setEditSegs((prev) => {
      const base = prev ?? active?.segments ?? [];
      if (tool === "gaps") {
        const out = base.map((s) => ({ ...s }));
        for (let k = 1; k < out.length; k++) if (out[k].start > out[k - 1].end) out[k].start = out[k - 1].end;
        return out;
      }
      if (tool === "emojis") {
        return base.map((s) => ({
          ...s,
          text: s.text.replace(/\p{Extended_Pictographic}/gu, "").replace(/\s+/g, " ").trim(),
        }));
      }
      if (tool === "punctuation") {
        return base.map((s) => ({
          ...s,
          text: s.text.replace(/[.,!?;:"“”‘’()[\]{}—–\-]/g, "").replace(/\s+/g, " ").trim(),
        }));
      }
      if (tool === "delay" && value != null) {
        return base.map((s) => ({ ...s, start: Math.max(0, s.start + value), end: Math.max(0, s.end + value) }));
      }
      return base;
    });
    if (tool === "emphasis") {
      // "Remove Emphasis" clears session emphasis + spotlight marks.
      setEmphasized(new Set());
      setSpotlighted(new Set());
    }
    setDirty(true);
  }, [active]);

  // Insert an empty word at the current playhead — inside the active caption if
  // one intersects the playhead, otherwise as a brand-new 0.5s segment.
  const insertWordAtPlayhead = useCallback(() => {
    const t = Math.max(0, videoRef.current?.currentTime ?? 0);
    setEditSegs((prev) => {
      const base = prev ?? active?.segments ?? [];
      const idx = base.findIndex((s) => t >= s.start && t <= s.end);
      if (idx >= 0) {
        const s = base[idx];
        const words = s.text.split(/\s+/).filter(Boolean);
        const dur = Math.max(0.001, s.end - s.start);
        const pos = Math.max(0, Math.min(words.length, Math.round(((t - s.start) / dur) * words.length)));
        words.splice(pos, 0, "word");
        const next = [...base];
        next[idx] = { ...s, text: words.join(" "), words: undefined };
        return next;
      }
      const newSeg: Segment = { start: t, end: t + 0.5, text: "word" };
      const nextIdx = base.findIndex((s) => s.start > t);
      const next = [...base];
      if (nextIdx === -1) next.push(newSeg); else next.splice(nextIdx, 0, newSeg);
      return next;
    });
    setDirty(true);
    toast.success("Word added");
  }, [active]);

  // Delete the currently selected caption (from BottomTimeline).
  const deleteSelectedSeg = useCallback((i: number | null) => {
    if (i == null) { toast.message("Select a caption first"); return; }
    setEditSegs((prev) => (prev ?? active?.segments ?? []).filter((_, idx) => idx !== i));
    setDirty(true);
  }, [active]);

  // Auto-highlight — mark proper nouns / all-caps / numeric tokens as emphasized.
  const autoHighlight = useCallback(() => {
    const skip = new Set(["The","This","That","And","But","Or","So","With","For","In","On","At","To","Of","A","An","Is","Are","Was","Were","Be","Been","Being","Have","Has","Had","Do","Does","Did","Will","Would","Can","Could","Should","May","Might","Must","Shall","I","You","He","She","We","They","It","My","Your","His","Her","Our","Their"]);
    const set = new Set<string>();
    segs.forEach((s, i) => {
      const words = s.text.split(/\s+/).filter(Boolean);
      words.forEach((w, wi) => {
        const clean = w.replace(/[^\p{L}\p{N}]/gu, "");
        if (!clean) return;
        const hasDigit = /\d/.test(clean);
        const startsCap = /^\p{Lu}/u.test(clean);
        const allCap = clean.length > 2 && clean === clean.toUpperCase() && /\p{L}/u.test(clean);
        if (hasDigit || allCap || (startsCap && !skip.has(clean))) set.add(`${i}:${wi}`);
      });
    });
    setEmphasized(set);
    toast.success(`Auto-highlighted ${set.size} keyword${set.size === 1 ? "" : "s"}`);
  }, [segs]);



  const saveEdits = async () => {
    if (!active || !editSegs) return;
    setSaving(true);
    // When "hide" is on, exported SRT excludes low-confidence words — but the
    // stored segments keep them so users can dial the threshold back later.
    const srtSource = lowConf.mode === "hide" ? filterLowConf(editSegs, lowConf.threshold) : editSegs;
    const srt = buildCaptions(srtSource, "srt");
    const { error } = await supabase.from("captions").update({ segments: editSegs as any, srt_text: srt }).eq("id", active.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved"); setDirty(false); await load(); setEditSegs(null);
  };

  const { words: activeWords, activeIndex: activeWordIdx } = activeIdx >= 0
    ? getVisibleWords(segs[activeIdx].text, segs[activeIdx].start, segs[activeIdx].end, syncedTime, capStyle.wordsPerChunk, segs[activeIdx].words)
    : { words: [] as string[], activeIndex: -1 };
  // Kept for anything downstream that still consumes the flat chunk string.
  const currentText = activeIdx >= 0 ? getVisibleChunk(segs[activeIdx].text, segs[activeIdx].start, segs[activeIdx].end, syncedTime, capStyle.wordsPerChunk) : "";

  // Emit an animation-timing sample every time the active caption chunk changes
  // (i.e. the word-entrance animation re-fires because chunkKey remounts).
  // PerfHUD subscribes to render drift between expected fire time and actual currentTime.
  useEffect(() => {
    if (activeIdx < 0) return;
    const seg = segs[activeIdx]; if (!seg) return;
    const actual = videoRef.current?.currentTime ?? currentTime;
    emitAnimSample({
      segIdx: activeIdx,
      expected: seg.start,
      actual,
      drift: +((actual - seg.start) * 1000).toFixed(1),
      duration: capStyle.transitionSpeed,
      transition: capStyle.transition,
      at: performance.now(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx]);

  const [rerunning, setRerunning] = useState(false);
  const [resyncing, setResyncing] = useState(false);

  // Re-sync captions: rebuild caption rows from the stored word-level
  // timestamps (segs[*].words) without touching the STT provider. Useful after
  // edits or drift where segment boundaries no longer match the underlying
  // word timings.
  const resyncCaptions = useCallback(() => {
    if (resyncing) return;
    if (!segs.length) { toast.error("No captions to re-sync"); return; }
    setResyncing(true);
    try {
      // Flatten every word timing across all segments.
      const flat: WordTiming[] = [];
      for (const s of segs) {
        if (s.words && s.words.length) {
          for (const w of s.words) {
            if (typeof w.start === "number" && typeof w.end === "number" && w.end > w.start && (w.text ?? "").trim()) {
              flat.push({ text: w.text.trim(), start: w.start, end: w.end });
            }
          }
        }
      }
      if (flat.length < 2) {
        toast.error("No word-level timings stored", { description: "Re-run transcription to capture per-word timestamps." });
        setResyncing(false);
        return;
      }
      flat.sort((a, b) => a.start - b.start);

      // Group words into new caption rows using natural pause + length caps.
      const GAP = 0.5;             // seconds of silence between words → new row
      const MAX_WORDS = Math.max(3, Math.min(12, capStyle.wordsPerChunk || 6));
      const MAX_DURATION = 4.0;    // seconds per caption row
      const next: Segment[] = [];
      let cur: WordTiming[] = [];
      const flush = () => {
        if (!cur.length) return;
        next.push({
          start: cur[0].start,
          end: cur[cur.length - 1].end,
          text: cur.map((w) => w.text).join(" "),
          words: cur.slice(),
        });
        cur = [];
      };
      for (let i = 0; i < flat.length; i++) {
        const w = flat[i];
        if (cur.length) {
          const gap = w.start - cur[cur.length - 1].end;
          const dur = w.end - cur[0].start;
          if (gap > GAP || cur.length >= MAX_WORDS || dur > MAX_DURATION) flush();
        }
        cur.push(w);
      }
      flush();

      if (!next.length) { toast.error("Re-sync produced no rows"); setResyncing(false); return; }
      setEditSegs(next);
      setDirty(true);
      toast.success(`Re-synced ${next.length} caption rows`, { description: "Review and Save to persist." });
    } catch (e: any) {
      toast.error("Re-sync failed", { description: e?.message ?? String(e) });
    } finally {
      setResyncing(false);
    }
  }, [segs, resyncing, capStyle.wordsPerChunk]);


  const retryTranscription = async () => {
    if (!id || !project || rerunning) return;
    if (creditsBlocked) { toast.error("You're out of credits — upgrade your plan to transcribe."); return; }
    setRerunning(true);
    const provider = project.chosen_provider ?? "auto";
    const t = toast.loading(`Re-running transcription (${provider})…`);
    const log = createRunLog("transcription", { project_id: id, provider });
    try {
      log.step("mark project processing");
      await supabase.from("projects").update({ status: "processing", error_message: null }).eq("id", id);
      log.step("invoke: transcribe");
      const { error } = await invokeWithRetry("transcribe", { body: { project_id: id, force: true } });
      if (error) throw error;
      log.step("invoke: ok");
      toast.success("Transcription re-run started", { id: t });
      await load();
    } catch (e: any) {
      toast.dismiss(t);
      failWithLog(log, e, { title: "Re-run failed" });
    } finally {
      setRerunning(false);
    }
  };

  const handleReplaceMedia = async (file: File) => {
    if (!id || !project || !user || replacing) return;
    const maxBytes = caps.maxUploadBytes || 250 * 1024 * 1024;
    if (file.size > maxBytes) {
      const maxFormatted = maxBytes >= 1024 * 1024 * 1024
        ? `${Math.round(maxBytes / (1024 * 1024 * 1024))} GB`
        : `${Math.round(maxBytes / (1024 * 1024))} MB`;
      toast.error("File exceeds plan limit", { description: `Your ${planId.toUpperCase()} plan allows uploads up to ${maxFormatted}.` });
      return;
    }
    setReplacing(true);
    const t = toast.loading("Uploading replacement…");
    try {
      const ext = file.name.split(".").pop() || "mp4";
      const newPath = `${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("media").upload(newPath, file, {
        contentType: file.type || undefined, upsert: false,
      });
      if (upErr) throw upErr;

      const oldPath = project.media_path;
      const { error: updErr } = await supabase.from("projects").update({
        media_path: newPath, status: "processing", error_message: null, duration_seconds: null,
      }).eq("id", id);
      if (updErr) throw updErr;

      // Clear existing captions for this project — they belong to the old media.
      await supabase.from("captions").delete().eq("project_id", id);

      if (oldPath) { try { await supabase.storage.from("media").remove([oldPath]); } catch {} }

      // Refresh signed URL for new media.
      const { data: signed } = await supabase.storage.from("media").createSignedUrl(newPath, 3600);
      setMediaUrl(signed?.signedUrl ?? null);
      repairAttemptedRef.current = null;
      setEditSegs(null); setDirty(false);

      // Kick off transcription for the new media.
      await invokeWithRetry("transcribe", { body: { project_id: id } }).catch(() => {});
      await load();
      toast.success("Media replaced — transcribing", { id: t });
    } catch (e: any) {
      logEditorControlError(e, { control: "replace_media", context: { size: file.size, type: file.type }, silent: true });
      toast.error("Replace failed", { id: t, description: e?.message ?? String(e) });
    } finally {
      setReplacing(false);
    }
  };
  const cancelProcessing = async () => {
    if (!id || !project) return;
    if (!confirm("Cancel this transcription?")) return;
    if (project.media_path) { try { await supabase.storage.from("media").remove([project.media_path]); } catch {} }
    await supabase.from("projects").delete().eq("id", id);
    toast.message("Cancelled"); navigate("/dashboard");
  };

  const handleDeleteProject = async () => {
    if (!id || !project || deleting) return;
    if (!user) {
      toast.error("Sign in required", { description: "Please sign in again to delete this project." });
      return;
    }
    if (!window.confirm(`Delete "${project.title || "Untitled"}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      if (project.media_path) {
        try { await supabase.storage.from("media").remove([project.media_path]); } catch {}
      }
      const { data, error } = await supabase
        .from("projects")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id)
        .select("id");
      if (error) {
        const code = (error as { code?: string }).code;
        if (code === "42501" || /permission|denied|rls/i.test(error.message)) {
          toast.error("Permission denied", { description: "You don't have access to delete this project." });
        } else {
          toast.error("Couldn't delete project", { description: error.message });
        }
        return;
      }
      if (!data || data.length === 0) {
        toast.error("Permission denied", { description: "You don't have permission to delete this project." });
        return;
      }
      toast.success("Project deleted");
      navigate("/dashboard");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error. Please try again.";
      toast.error("Couldn't delete project", { description: msg });
    } finally {
      setDeleting(false);
    }
  };

  const status = project?.status;
  const showBanner = status && status !== "ready";
  const shellWidth = editorShellRef.current?.clientWidth
    ?? (typeof window !== "undefined" ? window.innerWidth : 1280);
  const styleTrackWidth = rightPanelCollapsed ? 0 : rightPanelWidth;
  // Absolute minimum for the video track so drag can genuinely shrink it.
  // The video element scales down (object-fit) to fit whatever track it's given.
  const videoTrackFloor = 280;
  const videoNaturalWidth = Math.max(videoTrackFloor, videoFrameW > 0 ? Math.ceil(videoFrameW) : videoTrackFloor);
  const captionsTrackMin = 240;
  const arrowTrackWidth = rightPanelCollapsed ? 12 : 0;
  const maxVideoTrackWidth = Math.max(
    videoNaturalWidth,
    shellWidth - (leftCollapsed ? 0 : captionsTrackMin) - styleTrackWidth - arrowTrackWidth,
  );
  const activeVideoTrackWidth = customVideoTrackW == null
    ? videoNaturalWidth
    : Math.max(videoTrackFloor, Math.min(maxVideoTrackWidth, Math.ceil(customVideoTrackW)));

  return (
    <div
      className="editor-scope flex h-dvh w-screen flex-col overflow-hidden bg-background text-foreground"
      style={{
        // Scoped theme override — Red & Black premium theme.
        ["--primary" as any]: "0 100% 45%",
        ["--primary-foreground" as any]: "0 0% 100%",
        ["--ring" as any]: "0 100% 45%",
        ["--accent" as any]: "0 100% 45%",
        ["--accent-foreground" as any]: "0 0% 100%",
      }}
    >
      <TopBar
        title={project?.title ?? ""}
        onRename={async (newTitle) => {
          if (!id) return;
          const prev = project;
          setProject((p) => (p ? { ...p, title: newTitle } : p));
          const { error } = await supabase.from("projects").update({ title: newTitle }).eq("id", id);
          if (error) {
            setProject(prev);
            toast.error("Rename failed", { description: error.message });
          } else {
            toast.success("Renamed", { description: newTitle });
          }
        }}
        onExport={() => gateDownload(() => setExportOpen(true))}
        onQuickExport={async (r) => {
          if (quickBusy) return;
          gateDownload(async () => {
            if (caps.maxExportResolution === "720p" && r !== "720p") {
              toast.error("Resolution locked", { description: "Your Free plan allows up to 720p. Upgrade to export in 1080p or 4K." });
              return;
            }
            if (caps.maxExportResolution === "1080p" && (r === "4k" || r === "1440p")) {
              toast.error("4K Export locked", { description: "Your Editor plan allows up to 1080p. Upgrade to Creator or Studio for stunning 4K exports." });
              return;
            }
            setQuickBusy(true);
            try {
              await (await loadQuickExport())({
                mediaUrl, segs,
                capStyle: {
                  ...capStyle,
                  ...(caps.watermarkRequired ? { watermark: true } : {}),
                },
                title: project?.title ?? "captioned-video",
                resolution: r,
              });
            } finally { setQuickBusy(false); }
          });
        }}
        quickBusy={quickBusy}
        dirty={dirty}
        saving={saving}
        onSave={saveEdits}
        onDelete={handleDeleteProject}
        deleting={deleting}
        onRerun={retryTranscription}
        rerunning={rerunning}
        onPasteSubtitles={() => setPasteOpen(true)}
        onSpellCheck={() => setSpellOpen(true)}
        onResync={resyncCaptions}
        resyncing={resyncing}
        onResetLayout={resetLayout}
        creditsBlocked={creditsBlocked}
      />

      <Suspense fallback={null}>
        <EditorErrorInspector />


        {spellOpen && (
          <SpellCheckDialog
            open={spellOpen}
            onOpenChange={setSpellOpen}
            segments={(editSegs ?? segs) as any}
            language={activeLang}
            onApply={(next) => {
              setEditSegs(next as any);
              setDirty(true);
            }}
          />
        )}

        {pasteOpen && (
          <PasteSubtitlesDialog
            open={pasteOpen}
            onClose={() => setPasteOpen(false)}
            projectId={id!}
            defaultLanguage={activeLang}
            videoDuration={duration}
            onImported={load}
          />
        )}

        {/* Credits are surfaced in the dashboard header; keep the editor chrome clean. */}

        {exportOpen && (
          <ExportModal
            open={exportOpen}
            onClose={() => setExportOpen(false)}
            mediaUrl={mediaUrl}
            segs={segs}
            capStyle={capStyle}
            title={project?.title ?? "captioned-video"}
            onDownloadCaptions={download}
          />
        )}

        {dubOpen && (
          <DubModal
            open={dubOpen}
            onClose={() => setDubOpen(false)}
            projectId={id ?? ""}
            projectTitle={project?.title ?? ""}
            languages={LANGS}
            availableLangs={uniqueLangs}
            onTranslate={async (t) => { await translate(t); }}
            translating={translating}
          />
        )}

        {shortcutsOpen && <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />}
      </Suspense>


      {showBanner && (
        <div className={`shrink-0 border-b px-4 py-2 text-[13px] ${
          status === "failed" ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-border bg-card/50 text-muted-foreground"
        }`}>
          <div className="flex items-center gap-2">
            {status === "failed" ? <AlertCircle className="h-4 w-4" /> : <FuturisticLoader size="sm" inline />}
            <span className="font-semibold uppercase tracking-wide">{status}</span>
            <span className="text-muted-foreground">
              {status === "failed" 
                ? (project?.error_message?.toLowerCase().includes("timeout") || project?.error_message?.toLowerCase().includes("failed") || project?.error_message?.toLowerCase().includes("deepgram") || project?.error_message?.toLowerCase().includes("redis") || project?.error_message?.toLowerCase().includes("bullmq") ? "We couldn't process this video. Please try again." : (project?.error_message || "Processing failed."))
                : (project?.error_message ?? "AI is generating captions…")}
            </span>
            <div className="ml-auto flex items-center gap-2">
              {status === "failed" && !creditsBlocked && <button onClick={retryTranscription} className="rounded-full border border-destructive/40 px-2 py-0.5 font-semibold hover:bg-destructive/20"><RefreshCw className="mr-1 inline h-3 w-3" />Retry</button>}
              {status === "failed" && creditsBlocked && <UpgradeCTA compact label="Upgrade to retry" action="Transcription" hint="Credits reached 0 — transcription is paused until you upgrade." />}
              {(status === "processing" || status === "uploading") && <button onClick={cancelProcessing} className="rounded-full border border-border px-2 py-0.5 font-semibold hover:border-destructive/50 hover:text-destructive"><Ban className="mr-1 inline h-3 w-3" />Cancel</button>}
            </div>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {(
          <EditorRail
            onCaptions={() => { activeRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }}
            onFonts={() => { toast.message("Custom fonts", { description: "Pick any font in the Text panel on the right →" }); }}
            onAudio={() => { setDubOpen(true); }}
          />
        )}


        <div className="flex min-h-0 flex-1 flex-col">
          {project && activeLang === sourceLang && !!project.compare_mode && (
            <div className="flex shrink-0 items-center justify-end gap-2 border-b border-border/60 bg-background/60 px-3 py-1.5">
              <Suspense fallback={null}>
                <TranscribeCompare
                  projectId={project.id}
                  sourceLanguage={project.source_language}
                  compareMode={!!project.compare_mode}
                  chosenProvider={project.chosen_provider}
                  captions={captionsForLang.map((c) => ({ id: c.id, provider: c.provider, segments: c.segments as any }))}
                  onSeek={seek}
                  onRefresh={load}
                  onFlagLowConfidence={handleFlagLowConfidence}
                />
                <CaptionReviewPanel segs={segs} activeIdx={activeIdx} onSeek={seek} onEditText={editSegText} />
              </Suspense>
            </div>
          )}

          {/* Mobile panel switcher — visible under lg */}
          <div className="flex shrink-0 items-center gap-1 border-b border-border/60 bg-background/70 px-2 py-1.5 lg:hidden">
            {([
              { id: "captions", label: "Captions" },
              { id: "video", label: "Video" },
              { id: "style", label: "Style" },
            ] as const).map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  if (isPhone && t.id === "captions") {
                    // On phones, Captions opens a bottom sheet over the video instead of replacing it.
                    setSheetHeight((h) => (h === "closed" ? "half" : "closed"));
                    setMobilePanel("video");
                    return;
                  }
                  if (isPhone && sheetHeight !== "closed") setSheetHeight("closed");
                  setMobilePanel(t.id);
                }}
                className={`flex-1 rounded-md px-2 py-1.5 text-[13px] font-semibold transition ${
                  (t.id === "captions" && isPhone ? sheetHeight !== "closed" : mobilePanel === t.id)
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div
            ref={editorShellRef}
            data-testid="editor-shell"
            className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:grid gap-0"
            style={{
              gridTemplateColumns: (() => {
                if (leftCollapsed) {
                  return `0px minmax(${videoTrackFloor}px, 1fr) ${styleTrackWidth}px`;
                }

                // When the right templates panel is collapsed, let the video
                // shrink-wrap and snap to the right edge, while the captions
                // column absorbs all remaining width — no dead gap, no overflow.
                if (rightPanelCollapsed) {
                  const videoColCollapsed = customVideoTrackW == null
                    ? `fit-content(${maxVideoTrackWidth}px)`
                    : `${activeVideoTrackWidth}px`;
                  return `minmax(0, 1fr) ${videoColCollapsed} ${arrowTrackWidth}px`;
                }

                // Panel open: captions column is a 1fr filler that always
                // absorbs leftover space and hugs the video with zero gap.
                // For landscape (16:9) sources, let the video column absorb
                // available width so it renders cinema-wide like the reference,
                // instead of shrink-wrapping to a small intrinsic size.
                if (customVideoTrackW == null && videoAspect >= 1) {
                  return `minmax(${captionsTrackMin}px, 0.8fr) minmax(${videoTrackFloor}px, 1.2fr) ${styleTrackWidth}px`;
                }
                const videoCol = customVideoTrackW == null
                  ? `fit-content(${maxVideoTrackWidth}px)`
                  : `${activeVideoTrackWidth}px`;
                return `minmax(${captionsTrackMin}px, 1fr) ${videoCol} ${styleTrackWidth}px`;
              })(),

              transition: "none",
              willChange: "grid-template-columns",
            }}

          >

            {/* col 1 — captions */}



            <div
              ref={captionsColRef}
              data-testid="captions-column"
              className={
                isPhone
                  ? `${sheetHeight === "closed" ? "hidden" : "flex"} fixed inset-x-0 bottom-0 z-40 flex-col rounded-t-2xl border-t border-border/60 bg-background shadow-[0_-8px_30px_rgba(0,0,0,0.35)] lg:static lg:z-auto lg:rounded-none lg:border-t-0 lg:shadow-none lg:flex ${leftCollapsed ? "lg:!invisible lg:!pointer-events-none" : ""}`
                  : `relative min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${mobilePanel === "captions" ? "flex" : "hidden"} lg:flex ${leftCollapsed ? "lg:!invisible lg:!pointer-events-none" : ""}`
              }
              style={
                isPhone && sheetHeight !== "closed"
                  ? {
                      height:
                        sheetHeight === "peek"
                          ? "32vh"
                          : sheetHeight === "half"
                            ? "58vh"
                            : "85vh",
                      transition: "height 220ms cubic-bezier(0.22, 1, 0.36, 1)",
                    }
                  : undefined
              }
            >
              {isPhone && sheetHeight !== "closed" && (
                <div
                  role="button"
                  aria-label="Drag to resize captions sheet"
                  className="relative flex h-6 shrink-0 items-center justify-center lg:hidden touch-none cursor-ns-resize"
                  onPointerDown={(e) => {
                    (e.target as HTMLElement).setPointerCapture(e.pointerId);
                    const startY = e.clientY;
                    const vh = window.innerHeight;
                    const startPx =
                      sheetHeight === "peek" ? 0.32 * vh : sheetHeight === "half" ? 0.58 * vh : 0.85 * vh;
                    const el = (e.currentTarget as HTMLElement).parentElement as HTMLElement | null;
                    if (el) el.style.transition = "none";
                    let latest = startPx;
                    const onMove = (ev: PointerEvent) => {
                      const dy = startY - ev.clientY;
                      latest = Math.max(120, Math.min(vh * 0.95, startPx + dy));
                      if (el) el.style.height = `${latest}px`;
                    };
                    const onUp = () => {
                      window.removeEventListener("pointermove", onMove);
                      window.removeEventListener("pointerup", onUp);
                      if (el) el.style.transition = "";
                      const ratio = latest / vh;
                      const next =
                        ratio < 0.18
                          ? "closed"
                          : ratio < 0.45
                            ? "peek"
                            : ratio < 0.72
                              ? "half"
                              : "full";
                      setSheetHeight(next as typeof sheetHeight);
                      if (el) el.style.height = "";
                    };
                    window.addEventListener("pointermove", onMove);
                    window.addEventListener("pointerup", onUp);
                  }}
                  onDoubleClick={() =>
                    setSheetHeight((h) => (h === "full" ? "half" : h === "half" ? "peek" : "full"))
                  }
                >
                  <span className="h-1.5 w-10 rounded-full bg-border" />
                  <button
                    type="button"
                    onClick={() => setSheetHeight("closed")}
                    aria-label="Close captions sheet"
                    className="absolute right-2 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-card/60 hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            {active ? (
              <CaptionsColumn
                segs={segs} activeIdx={activeIdx} onSeek={seek} onEditText={editSegText}
                activeRowRef={activeRowRef}
                uniqueLangs={uniqueLangs} activeLang={activeLang} setActiveLang={setActiveLang}
                onTranslate={translate} translating={translating}
                translateBlocked={creditsBlocked}
                onOpenDub={() => setDubOpen(true)}
                onSplitSeg={splitSegAt}
                onDeleteSeg={deleteSeg}
                onApplyTool={applyCaptionTool}
                onDeleteWord={deleteWord}
                onMoveWord={moveWord}
                onReflow={reflowSegs}
                emphasized={emphasized}
                spotlighted={spotlighted}
                onToggleWordVisual={toggleWordVisual}
                capStyle={capStyle}
                setCapStyle={setCapStyle}
                flaggedIdxs={flaggedIdxs}
                flaggedOnly={flaggedOnly}
                onClearFlagged={clearFlagged}
                lowConfMode={lowConf.mode}
                lowConfThreshold={lowConf.threshold}
                setLowConf={setLowConf}
                lowConfWordKeys={lowConfInfo.wordKeys}
                lowConfSegIdxs={lowConfInfo.segIdxs}
                viewMode={viewMode} setViewMode={setViewMode}
                onAutoFit={() => { setAutoFit(true); runAutoFit(); toast.success("Captions panel auto-fit"); }}
              />

            ) : (
              <CaptionsLoadingState status={status} />
            )}
            <Suspense fallback={null}>
              <WordTimingPreview
                open={previewMode}
                onToggle={() => setPreviewMode((v) => !v)}
                segs={segs}
                activeIdx={activeIdx}
                currentTime={currentTime}
                onSeek={seek}
              />
            </Suspense>
            <BottomTimeline
              segs={segs} currentTime={currentTime} duration={duration}
              onSeek={seek} onEditTime={editSegTime}
              activeIdx={activeIdx}
              selectedSeg={selectedSeg} setSelectedSeg={setSelectedSeg}
              videoRef={videoRef}
              viewMode={viewMode} setViewMode={setViewMode}
              onInsertWord={insertWordAtPlayhead}
              onAutoHighlight={autoHighlight}
              onDeleteSelected={deleteSelectedSeg}
              onUndo={undo} onRedo={redo}
            />
            {!isPhone && !leftCollapsed && (
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Drag to resize captions panel"
                title="Drag to resize · double-click to reset"
                onPointerDown={startCaptionsResize}
                onDoubleClick={() => {
                  setCustomVideoTrackW(null);
                }}
                className={`group absolute right-0 top-0 bottom-0 z-30 hidden lg:flex w-4 -mr-2 cursor-col-resize items-center justify-center touch-none select-none ${isResizingCaptions ? "" : ""}`}
                style={{ WebkitUserSelect: "none" }}
              >
                <span
                  aria-hidden
                  className={`block h-full w-[4px] rounded-full transition-colors ${isResizingCaptions ? "bg-primary" : "bg-primary/40 group-hover:bg-primary/80"}`}
                />
                <span
                  aria-hidden
                  className={`absolute top-1/2 -translate-y-1/2 h-14 w-[4px] rounded-full shadow-[0_0_10px_hsl(var(--primary)/0.7)] transition-opacity ${isResizingCaptions ? "opacity-100 bg-primary" : "opacity-70 group-hover:opacity-100 bg-primary"}`}
                />
              </div>
            )}
            </div>


            <div
              data-testid="video-column"
              className={`relative min-h-0 flex-1 flex-col ${mobilePanel === "video" ? "flex" : "hidden"} lg:flex ${customVideoTrackW == null ? "lg:w-fit lg:max-w-full lg:justify-self-end" : "lg:w-full"}`}
            >
            <VideoViewport
              mediaUrl={mediaUrl} isAudio={isAudio}
              videoRef={videoRef}
              playing={playing} currentTime={currentTime} duration={duration}
              capStyle={capStyle} words={activeWords} activeWordIdx={activeWordIdx} activeIdx={activeIdx}
              setCapStyle={setCapStyle} onTogglePlay={togglePlay}
              emphasized={emphasized} spotlighted={spotlighted}
              onReplace={handleReplaceMedia} replacing={replacing}
              quickBusy={quickBusy}
              sync={sync} setSync={setSync}
              panelCollapsed={rightPanelCollapsed}
              leftCollapsed={leftCollapsed}
              onToggleLeft={() => setLeftCollapsed((v) => !v)}
              onMediaUnsupported={handleMediaUnsupported}
              mediaRepairing={mediaRepairing}
              onFrameWidth={setVideoFrameW}
              videoMinTrackWidth={videoTrackFloor}
              videoMaxTrackWidth={maxVideoTrackWidth}
              videoTrackWidth={customVideoTrackW == null ? null : activeVideoTrackWidth}
              onVideoTrackWidthChange={setCustomVideoTrackW}
              showWatermark={!isPaid && !isAdmin}
              saveState={saveState}
              onUndo={undoCaption}
              onRedo={redoCaption}
              canUndo={canUndo}
              canRedo={canRedo}
              onToggleHistory={() => setHistoryOpen((v) => !v)}
              historyOpen={historyOpen}
              onEditWord={(wi) => { if (activeIdx >= 0) editWord(activeIdx, wi); }}
              onEmphasizeWord={(wi) => { if (activeIdx >= 0) toggleWordVisual("emph", activeIdx, wi); }}
              onSplitAtWord={(wi, dir) => {
                if (activeIdx < 0) return;
                // "Next line" → this word starts a new block  → split at wi
                // "Previous line" → this word ends the block above → split at wi+1
                splitSegAt(activeIdx, dir === "next" ? wi : wi + 1);
              }}


              onQuickExport={async (r) => {
                if (quickBusy) return;
                gateDownload(async () => {
                  setQuickBusy(true);
                  try {
                    await (await loadQuickExport())({ mediaUrl, segs, capStyle, title: project?.title ?? "captioned-video", resolution: r });
                  } finally { setQuickBusy(false); }
                });
              }}
            />
            {historyOpen && (
              <Suspense fallback={null}>
                <CaptionHistoryPanel
                  open={historyOpen}
                  onClose={() => setHistoryOpen(false)}
                  entries={historyEntries}
                  onJumpPast={jumpToPast}
                  onJumpFuture={jumpToFuture}
                />
              </Suspense>
            )}
            </div>


            <div data-testid="style-panel" className={`relative min-h-0 flex-col overflow-hidden border-l border-border/60 bg-background/60 ${mobilePanel === "style" ? "flex" : "hidden"} lg:flex ${rightPanelCollapsed ? "lg:!invisible lg:!pointer-events-none" : ""} lg:h-full lg:w-full`}>
              <div
                role="separator"
                aria-orientation="vertical"
                aria-hidden="true"
                className="absolute -left-px top-0 bottom-0 z-20 hidden w-px bg-border/60 lg:block"
              />

              {/* Drag-to-resize handle — sits on the left edge just above the collapse arrow */}
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Drag to resize style panel"
                title="Drag to resize"
                onPointerDown={startRightResize}
                className={`group absolute left-0 top-0 z-30 hidden lg:flex w-4 -translate-x-1/2 cursor-col-resize items-center justify-center touch-none select-none ${isResizingRight ? "" : ""}`}
                style={{ height: "calc(50% - 44px)", WebkitUserSelect: "none" }}
              >
                <span
                  aria-hidden
                  className={`block h-full w-[4px] rounded-full transition-colors ${isResizingRight ? "bg-primary" : "bg-primary/40 group-hover:bg-primary/80"}`}
                />
                <span
                  aria-hidden
                  className={`absolute bottom-2 h-14 w-[4px] rounded-full shadow-[0_0_10px_hsl(var(--primary)/0.7)] transition-opacity ${isResizingRight ? "opacity-100 bg-primary" : "opacity-70 group-hover:opacity-100 bg-primary"}`}
                />
              </div>

              <div
                role="button"
                tabIndex={0}
                aria-label="Collapse style panel"
                title="Collapse panel"
                onClick={() => setRightPanelCollapsed(true)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setRightPanelCollapsed(true); } }}
                className="absolute left-0 top-1/2 z-30 hidden h-16 w-6 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-primary/50 bg-card text-primary shadow-[0_2px_10px_hsl(var(--primary)/0.35)] transition hover:bg-primary hover:text-primary-foreground lg:inline-flex select-none"
              >
                <ChevronRight className="h-4 w-4 pointer-events-none" />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3 pb-20">
                <Suspense fallback={<div className="h-full w-full animate-pulse rounded-md bg-muted/20" aria-label="Loading style panel" />}>
                  {id && <MusicMixer projectId={id} videoRef={videoRef} />}
                  <CaptionRightPanel value={capStyle} onChange={setCapStyle} projectId={id} videoRef={videoRef} onTemplateApplied={setActiveTemplateName} />
                </Suspense>
              </div>
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-end bg-background/95 px-3 py-2.5 backdrop-blur">
                <button
                  onClick={async () => {
                    if (quickBusy) return;
                    gateDownload(async () => {
                      setQuickBusy(true);
                      try {
                        await (await loadQuickExport())({ mediaUrl, segs, capStyle, title: project?.title ?? "captioned-video", resolution: "1080p" });
                      } finally { setQuickBusy(false); }
                    });
                  }}
                  disabled={quickBusy}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-60 transition"
                >
                  {quickBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {quickBusy ? "Exporting…" : "Export"}
                </button>
              </div>
            </div>

          </div>


        </div>
        {rightPanelCollapsed && (
          <div
            role="button"
            tabIndex={0}
            data-align-debug="arrow"
            onClick={() => setRightPanelCollapsed(false)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setRightPanelCollapsed(false); } }}
            aria-label="Click to expand style panel"
            title="Click to expand"
            className="fixed right-0 top-0 z-30 hidden h-full w-3 cursor-pointer bg-primary/30 hover:bg-primary/60 transition-colors lg:block select-none touch-none before:absolute before:inset-y-0 before:-left-3 before:content-['']"
          >
            <span
              className="pointer-events-none absolute top-1/2 right-0 -translate-y-1/2 flex h-5 w-3 items-center justify-center rounded-l-sm bg-primary text-primary-foreground shadow shadow-primary/30 ring-1 ring-primary/40"
              aria-hidden="true"
            >
              <ChevronLeft className="h-2 w-2" />
            </span>

          </div>

        )}

      </div>
      <Suspense fallback={null}>
        <PerfHUD videoRef={videoRef} captionCount={segs.length} />
      </Suspense>



    </div>
  );
};

export default ProjectView;

