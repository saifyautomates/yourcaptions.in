import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  Sparkles,
  Zap,
  Flame,
  TrendingUp,
  FileVideo,
  Crown,
  ShieldCheck,
  RefreshCw,
  Clock,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Layers,
  Activity,
  CreditCard,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";

import { useAuth } from "@/hooks/useAuth";
import { usePlanInfo } from "@/hooks/usePlanInfo";
import { useCredits } from "@/hooks/useCredits";
import { getPlanCapabilities, PLANS, PlanId } from "@/lib/plans";
import { supabase } from "@/integrations/supabase/client";
import { startPerfMeasure } from "@/lib/perfBudget";
import { useIsAdmin } from "@/hooks/useIsAdmin";

import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { ProjectCardSkeleton } from "@/components/ui/skeleton";
import { ProjectsEmptyState } from "@/components/ui/EmptyState";
import { staggerContainer, scrollReveal } from "@/lib/animations";
import { DashboardTemplatesSection } from "@/components/dashboard/DashboardTemplatesSection";

interface Project {
  id: string;
  name: string;
  status: "processing" | "completed" | "failed";
  thumbnailUrl?: string;
  duration?: number;
  createdAt: string;
}

interface CreditTx {
  id: string;
  type: string;
  amount: number;
  balance_after: number;
  created_at: string;
  status: string;
  reference_type: string | null;
  reference_id: string | null;
}

// Monthly credit limits mapping in seconds
const PLAN_MONTHLY_SECONDS: Record<PlanId, number> = {
  starter: 300, // 5 min
  editor: 7200, // 120 min
  creator: 18000, // 300 min
  studio: 36000, // 600 min
};

export default function Dashboard() {
  const { user } = useAuth();
  const { planId, planName, isPaid } = usePlanInfo();
  const { balance, planCredits, topupCredits } = useCredits();
  const { isAdmin } = useIsAdmin();

  const caps = getPlanCapabilities(planId);
  const navigate = useNavigate();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [projectStatusFilter, setProjectStatusFilter] = useState<"all" | "completed" | "processing">("all");
  const [activeTab, setActiveTab] = useState<"projects" | "usage" | "templates">("projects");

  // Real credit transactions state
  const [transactions, setTransactions] = useState<CreditTx[]>([]);
  const [loadingTxs, setLoadingTxs] = useState(false);
  const [txFilter, setTxFilter] = useState<"all" | "deduct" | "refund" | "topup">("all");
  const [walletResetAt, setWalletResetAt] = useState<string | null>(null);

  const [appliedTemplateName, setAppliedTemplateName] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("applyTemplate") || localStorage.getItem("captions:appliedTemplate");
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const applyTemplate = params.get("applyTemplate");
    if (applyTemplate) {
      localStorage.setItem("captions:appliedTemplate", applyTemplate);
      setAppliedTemplateName(applyTemplate);
      toast.success(`Selected "${applyTemplate}"! Upload or open a project to apply style.`);
    }
  }, []);

  // Fetch projects and compute stats
  const fetchProjects = useCallback(async () => {
    if (!user) return;
    const perf = startPerfMeasure("dashboard_load");

    const { data: pr, error } = await supabase
      .from("projects")
      .select("id, title, status, created_at, media_path, duration_seconds")
      .order("created_at", { ascending: false })
      .limit(30);

    if (!error && pr) {
      const mapped = await Promise.all(
        pr.map(async (p: any) => {
          let thumbnailUrl;
          if (p.media_path) {
            const { data } = await supabase.storage.from("media").createSignedUrl(p.media_path, 3600);
            thumbnailUrl = data?.signedUrl;
          }
          return {
            id: p.id,
            name: p.title || "Untitled Video",
            status: (p.status === "ready" ? "completed" : p.status) as "processing" | "completed" | "failed",
            thumbnailUrl,
            duration: p.duration_seconds,
            createdAt: p.created_at,
          };
        })
      );
      setProjects(mapped);
    }
    setLoading(false);
    perf.end({ project_count: (pr ?? []).length });
  }, [user]);

  // Fetch real credit wallet data and transaction history
  const fetchCreditData = useCallback(async () => {
    if (!user) return;
    setLoadingTxs(true);

    try {
      // 1. Fetch wallet details (reset date)
      const { data: wallet } = await supabase
        .from("credit_wallets")
        .select("plan_credits, topup_credits, plan_credits_reset_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (wallet?.plan_credits_reset_at) {
        setWalletResetAt(wallet.plan_credits_reset_at);
      }

      // 2. Fetch actual credit transaction history (100% real ledger)
      const { data: txData, error: txErr } = await supabase
        .from("credit_transactions")
        .select("id, type, amount, balance_after, created_at, status, reference_type, reference_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(25);

      if (!txErr && txData) {
        setTransactions(txData);
      }
    } catch (err) {
      console.warn("Could not fetch full credit transaction ledger:", err);
    } finally {
      setLoadingTxs(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProjects();
    fetchCreditData();
  }, [fetchProjects, fetchCreditData]);

  // Subscribe to real-time credit transactions
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("dashboard:credit_transactions")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "credit_transactions",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setTransactions((prev) => [payload.new as CreditTx, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Compute 100% real credit usage metrics
  const totalAllocatedSeconds = PLAN_MONTHLY_SECONDS[planId] || 300;

  // Real credits deducted from transactions
  const totalDeductedSeconds = useMemo(() => {
    const fromTx = transactions
      .filter((t) => t.type === "deduct" && t.status !== "reversed")
      .reduce((acc, t) => acc + (t.amount || 0), 0);

    // If transactions table doesn't have records yet, fallback to sum of project durations
    if (fromTx === 0 && projects.length > 0) {
      return projects.reduce((acc, p) => acc + (p.duration || 0), 0);
    }
    return fromTx;
  }, [transactions, projects]);

  const usedPercentage = useMemo(() => {
    const totalPotential = Math.max(totalAllocatedSeconds, totalDeductedSeconds + balance);
    if (totalPotential <= 0) return 0;
    return Math.min(100, Math.round((totalDeductedSeconds / totalPotential) * 100));
  }, [totalAllocatedSeconds, totalDeductedSeconds, balance]);

  const totalCapDurationSec = useMemo(() => {
    return projects.reduce((acc, p) => acc + (p.duration || 0), 0);
  }, [projects]);

  const completedCount = useMemo(() => {
    return projects.filter((p) => p.status === "completed").length;
  }, [projects]);

  const processingCount = useMemo(() => {
    return projects.filter((p) => p.status === "processing").length;
  }, [projects]);

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchesQuery = p.name.toLowerCase().includes(query.toLowerCase());
      const matchesStatus =
        projectStatusFilter === "all" || p.status === projectStatusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [projects, query, projectStatusFilter]);

  const filteredTransactions = useMemo(() => {
    if (txFilter === "all") return transactions;
    if (txFilter === "deduct") return transactions.filter((t) => t.type === "deduct");
    if (txFilter === "refund") return transactions.filter((t) => t.type === "refund");
    if (txFilter === "topup") return transactions.filter((t) => t.type.includes("topup") || t.type.includes("grant"));
    return transactions;
  }, [transactions, txFilter]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      setProjects((prev) => prev.filter((p) => p.id !== id));
      toast.success("Project deleted");
    }
  };

  // Helper formatting
  const fmtTimeSpan = (seconds: number) => {
    const sec = Math.max(0, Math.round(seconds));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s > 0 ? `${s}s` : ""}`.trim();
  };

  const getResetDateText = () => {
    if (!walletResetAt) return "Monthly cycle active";
    try {
      const d = new Date(walletResetAt);
      return `Refreshes on ${format(d, "MMM d, yyyy")}`;
    } catch {
      return "Monthly cycle active";
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full safe-top space-y-8">
        
        {/* 🔥 HEADER & ACTION BAR (KALAKAR STYLE) 🔥 */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-2 border-b border-white/5">
          <motion.div variants={scrollReveal} initial="initial" animate="animate">
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="flex h-2.5 w-2.5 rounded-full bg-[#E60000] animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Creator Studio Dashboard
              </span>
              <span className="text-[10px] bg-white/10 text-white font-extrabold px-2 py-0.5 rounded-full">
                {planName} Plan
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black font-display text-white tracking-tight">
              Welcome back, <span className="text-[#E60000]">{user?.user_metadata?.full_name?.split(" ")[0] || "Creator"}</span>
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              AI caption generation, viral kinetic typography & vocal audio enhancement.
            </p>
          </motion.div>

          {/* Quick Action CTAs */}
          <motion.div variants={scrollReveal} initial="initial" animate="animate" className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => navigate("/dashboard/batch")}
              className="bg-white/5 hover:bg-white/10 text-white border border-white/10 text-xs sm:text-sm font-semibold h-11"
            >
              <Layers className="w-4 h-4 mr-1.5 text-zinc-400" />
              Batch Upload
            </Button>
            <Button
              onClick={() => navigate("/dashboard/new")}
              size="lg"
              className="bg-[#E60000] hover:bg-[#ff1a1a] text-white font-black text-sm h-11 px-5 shadow-[0_0_30px_rgba(230,0,0,0.5)] transition-all active:scale-95 gap-2"
            >
              <Plus className="w-4 h-4" />
              New Project
            </Button>
          </motion.div>
        </div>

        {/* 📊 100% REAL CREDITS & USAGE METRIC CARDS (KALAKAR STYLE) 📊 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          
          {/* CARD 1: AVAILABLE CREDITS / BALANCE */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#161618] to-[#0d0d0f] border border-white/10 p-5 shadow-xl group hover:border-[#E60000]/40 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Credits Remaining
              </span>
              <div className="w-8 h-8 rounded-xl bg-[#E60000]/15 flex items-center justify-center text-[#E60000]">
                <Flame className="w-4 h-4 fill-[#E60000]" />
              </div>
            </div>

            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                {fmtTimeSpan(balance)}
              </span>
              <span className="text-xs text-zinc-400 font-semibold">
                ({balance}s)
              </span>
            </div>

            {/* Plan vs Top-up breakdown */}
            <div className="flex items-center gap-2 text-[11px] text-zinc-400 mb-3 font-medium">
              <span className="bg-white/5 px-2 py-0.5 rounded border border-white/5">
                Plan: {fmtTimeSpan(planCredits)}
              </span>
              <span className="bg-white/5 px-2 py-0.5 rounded border border-white/5">
                Top-up: {fmtTimeSpan(topupCredits)}
              </span>
            </div>

            <div className="pt-2 border-t border-white/5 flex items-center justify-between">
              <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                <Clock className="w-3 h-3 text-[#E60000]" />
                {getResetDateText()}
              </span>
              <Link
                to="/pricing"
                className="text-[11px] font-bold text-[#E60000] hover:text-[#ff4d4d] flex items-center gap-0.5 transition-colors"
              >
                + Top-up
              </Link>
            </div>
          </div>

          {/* CARD 2: REAL CREDITS USED THIS MONTH */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#161618] to-[#0d0d0f] border border-white/10 p-5 shadow-xl group hover:border-emerald-500/40 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Credits Used
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-400">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                {fmtTimeSpan(totalDeductedSeconds)}
              </span>
              <span className="text-xs text-zinc-400 font-semibold">
                / {fmtTimeSpan(totalAllocatedSeconds)}
              </span>
            </div>

            {/* Dynamic Progress Meter */}
            <div className="space-y-1.5 mb-3">
              <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-400">
                <span>Monthly Quota</span>
                <span className={usedPercentage > 85 ? "text-[#E60000]" : "text-emerald-400"}>
                  {usedPercentage}% Used
                </span>
              </div>
              <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    usedPercentage > 85
                      ? "bg-gradient-to-r from-amber-500 to-[#E60000]"
                      : "bg-gradient-to-r from-emerald-500 to-emerald-400"
                  }`}
                  style={{ width: `${Math.max(4, usedPercentage)}%` }}
                />
              </div>
            </div>

            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-400">
              <span>Transcriptions & Audio</span>
              <span className="text-zinc-300 font-bold">{transactions.length} operations</span>
            </div>
          </div>

          {/* CARD 3: TOTAL VIDEOS & CAPTION DURATION */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#161618] to-[#0d0d0f] border border-white/10 p-5 shadow-xl group hover:border-sky-500/40 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Projects Created
              </span>
              <div className="w-8 h-8 rounded-xl bg-sky-500/15 flex items-center justify-center text-sky-400">
                <FileVideo className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                {projects.length}
              </span>
              <span className="text-xs text-zinc-400 font-semibold">
                Videos
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-zinc-400 mb-3 font-medium">
              <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-bold">
                ✓ {completedCount} Done
              </span>
              {processingCount > 0 && (
                <span className="bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20 font-bold animate-pulse">
                  ● {processingCount} Rendering
                </span>
              )}
            </div>

            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-400">
              <span>Total Captioned Time</span>
              <span className="text-white font-bold">{fmtTimeSpan(totalCapDurationSec)}</span>
            </div>
          </div>

          {/* CARD 4: ACTIVE PLAN & RESOLUTION LIMIT */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#161618] to-[#0d0d0f] border border-white/10 p-5 shadow-xl group hover:border-amber-500/40 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Plan & Quality
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-400">
                <Crown className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
                {planName}
              </span>
              {isPaid && (
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-extrabold uppercase">
                  Active
                </span>
              )}
            </div>

            <div className="text-[11px] text-zinc-400 mb-3 font-medium flex items-center gap-1.5">
              <span className="text-amber-400 font-bold">Max Quality:</span>
              <span className="text-white font-extrabold bg-white/5 px-2 py-0.5 rounded border border-white/10">
                {caps.maxExportResolution.toUpperCase()}
              </span>
              <span className="text-[10px] text-zinc-400">
                {caps.watermarkRequired ? "(Watermarked)" : "(Clean)"}
              </span>
            </div>

            <div className="pt-2 border-t border-white/5 flex items-center justify-between">
              <span className="text-[11px] text-zinc-400">
                {!isPaid ? "Upgrade for 1080p/4K" : "Full Creator Access"}
              </span>
              <Link
                to="/pricing"
                className="text-[11px] font-bold text-[#E60000] hover:text-[#ff4d4d] flex items-center gap-0.5 transition-colors"
              >
                {!isPaid ? "Upgrade →" : "Manage →"}
              </Link>
            </div>
          </div>

        </div>

        {/* 🚀 QUICK TEMPLATE STRIP (VIRAL CREATOR STYLES) 🚀 */}
        <div className="rounded-2xl border border-white/10 bg-[#101012] p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#E60000]" />
              <h3 className="text-sm sm:text-base font-extrabold text-white">
                One-Click Viral Caption Styles
              </h3>
            </div>
            <Link
              to="/templates"
              className="text-xs font-bold text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
            >
              View all 8 templates →
            </Link>
          </div>
          <DashboardTemplatesSection />
        </div>

        {/* 🗂️ MAIN CONTENT SECTION WITH INTERACTIVE TABS 🗂️ */}
        <div className="space-y-6">
          
          {/* TAB BAR NAVIGATION */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2 bg-[#121214] p-1 rounded-xl border border-white/10">
              <button
                onClick={() => setActiveTab("projects")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === "projects"
                    ? "bg-[#E60000] text-white shadow-[0_0_15px_rgba(230,0,0,0.4)]"
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <FileVideo className="w-3.5 h-3.5" />
                Recent Projects ({projects.length})
              </button>
              <button
                onClick={() => setActiveTab("usage")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === "usage"
                    ? "bg-[#E60000] text-white shadow-[0_0_15px_rgba(230,0,0,0.4)]"
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                Live Credit Usage History ({transactions.length})
              </button>
            </div>

            {/* Filter / Search Controls for Projects */}
            {activeTab === "projects" && (
              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-60">
                  <Input
                    placeholder="Search projects..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="bg-[#121214] border-white/10 text-white placeholder-zinc-500 text-xs pl-8 h-9 rounded-xl focus:border-[#E60000]"
                  />
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                </div>
                <div className="flex items-center gap-1 bg-[#121214] border border-white/10 rounded-xl p-0.5">
                  {(["all", "completed", "processing"] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => setProjectStatusFilter(st)}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg capitalize transition-all ${
                        projectStatusFilter === st
                          ? "bg-white/15 text-white"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Filter Controls for Usage History */}
            {activeTab === "usage" && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-[#121214] border border-white/10 rounded-xl p-0.5">
                  {(["all", "deduct", "topup", "refund"] as const).map((flt) => (
                    <button
                      key={flt}
                      onClick={() => setTxFilter(flt)}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg capitalize transition-all ${
                        txFilter === flt
                          ? "bg-white/15 text-white"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      {flt === "deduct" ? "Deductions" : flt === "topup" ? "Top-ups" : flt}
                    </button>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchCreditData}
                  disabled={loadingTxs}
                  className="h-8 px-2 text-zinc-400 hover:text-white"
                  title="Refresh usage history"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingTxs ? "animate-spin text-[#E60000]" : ""}`} />
                </Button>
              </div>
            )}
          </div>

          {/* TAB 1: PROJECTS GRID */}
          {activeTab === "projects" && (
            <div>
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  <ProjectCardSkeleton />
                  <ProjectCardSkeleton />
                  <ProjectCardSkeleton />
                </div>
              ) : filteredProjects.length > 0 ? (
                <motion.div
                  variants={staggerContainer}
                  initial="initial"
                  animate="animate"
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                  {filteredProjects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      onDelete={handleDelete}
                    />
                  ))}
                </motion.div>
              ) : (
                <ProjectsEmptyState
                  onAction={() => navigate("/dashboard/new")}
                  actionLabel={
                    appliedTemplateName
                      ? `Upload Video with "${appliedTemplateName}"`
                      : "Upload Video"
                  }
                />
              )}
            </div>
          )}

          {/* TAB 2: 100% REAL CREDIT USAGE HISTORY / LEDGER (KALAKAR STYLE) */}
          {activeTab === "usage" && (
            <div className="rounded-2xl border border-white/10 bg-[#121214] overflow-hidden shadow-2xl">
              <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                <div>
                  <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#E60000]" />
                    Real-time Credit Consumption Ledger
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Live record of video transcriptions, audio enhancements, and plan refills.
                  </p>
                </div>
                <span className="text-xs font-bold text-zinc-400 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
                  Balance: {fmtTimeSpan(balance)} ({balance}s)
                </span>
              </div>

              {filteredTransactions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/[0.01] text-zinc-400 uppercase font-black tracking-wider text-[10px]">
                        <th className="px-5 py-3">Activity / Operation</th>
                        <th className="px-5 py-3">Timestamp</th>
                        <th className="px-5 py-3">Credits Deducted / Added</th>
                        <th className="px-5 py-3">Balance After</th>
                        <th className="px-5 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredTransactions.map((tx) => {
                        const isDeduct = tx.type === "deduct";
                        const isRefund = tx.type === "refund";
                        const isGrant = tx.type.includes("grant") || tx.type.includes("topup");

                        let typeLabel = "Video Transcription";
                        if (tx.reference_type === "audio_enhance") typeLabel = "AI Vocal Audio Enhancement";
                        else if (isRefund) typeLabel = "Credit Refund (Failed Job)";
                        else if (isGrant) typeLabel = "Plan Credits / Top-up Refill";
                        else if (tx.type === "admin_adjust") typeLabel = "System Adjustment";

                        return (
                          <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="px-5 py-3.5 font-bold text-white flex items-center gap-2.5">
                              <div
                                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                  isDeduct
                                    ? "bg-[#E60000]/15 text-[#E60000]"
                                    : isRefund
                                    ? "bg-sky-500/15 text-sky-400"
                                    : "bg-emerald-500/15 text-emerald-400"
                                }`}
                              >
                                {isDeduct ? (
                                  <ArrowDownRight className="w-4 h-4" />
                                ) : isRefund ? (
                                  <RefreshCw className="w-3.5 h-3.5" />
                                ) : (
                                  <ArrowUpRight className="w-4 h-4" />
                                )}
                              </div>
                              <div>
                                <div className="text-white font-extrabold">{typeLabel}</div>
                                <div className="text-[10px] text-zinc-400 font-mono">
                                  {tx.reference_id ? `Ref: ${tx.reference_id.slice(0, 8)}…` : `ID: ${tx.id.slice(0, 8)}…`}
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-zinc-400">
                              <div>{formatDistanceToNow(new Date(tx.created_at), { addSuffix: true })}</div>
                              <div className="text-[10px] text-zinc-400">
                                {format(new Date(tx.created_at), "MMM d, yyyy · HH:mm:ss")}
                              </div>
                            </td>
                            <td className="px-5 py-3.5 font-extrabold">
                              <span
                                className={
                                  isDeduct
                                    ? "text-[#E60000] bg-[#E60000]/10 px-2 py-0.5 rounded border border-[#E60000]/20"
                                    : "text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20"
                                }
                              >
                                {isDeduct ? `-${tx.amount}s (${fmtTimeSpan(tx.amount)})` : `+${tx.amount}s (${fmtTimeSpan(tx.amount)})`}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 font-mono text-zinc-300 font-bold">
                              {tx.balance_after !== undefined ? `${tx.balance_after}s (${fmtTimeSpan(tx.balance_after)})` : "--"}
                            </td>
                            <td className="px-5 py-3.5">
                              <span
                                className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                                  tx.status === "completed"
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                    : tx.status === "reserved"
                                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                    : "bg-zinc-800 text-zinc-400"
                                }`}
                              >
                                {tx.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 px-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3 text-zinc-400">
                    <Activity className="w-6 h-6 text-[#E60000]" />
                  </div>
                  <h4 className="text-sm font-extrabold text-white">No Credit Deductions Yet</h4>
                  <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1">
                    Your monthly credit allowance is completely fresh! Upload your first video to start generating AI captions.
                  </p>
                  <Button
                    onClick={() => navigate("/dashboard/new")}
                    size="sm"
                    className="mt-4 bg-[#E60000] hover:bg-[#ff1a1a] text-white font-bold"
                  >
                    Start First Project
                  </Button>
                </div>
              )}
            </div>
          )}

        </div>

      </div>
    </DashboardLayout>
  );
}
