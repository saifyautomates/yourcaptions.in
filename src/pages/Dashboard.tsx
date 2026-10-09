import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, Plus, Sparkles, AlertCircle, FileVideo, Crown } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

import { useAuth } from "@/hooks/useAuth";
import { usePlanInfo } from "@/hooks/usePlanInfo";
import { useCredits } from "@/hooks/useCredits";
import { getPlanCapabilities, PLANS } from "@/lib/plans";
import { supabase } from "@/integrations/supabase/client";
import { startPerfMeasure } from "@/lib/perfBudget";
import { useIsAdmin } from "@/hooks/useIsAdmin";

import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { Skeleton, ProjectCardSkeleton } from "@/components/ui/skeleton";
import { ProjectsEmptyState } from "@/components/ui/EmptyState";
import { staggerContainer, scrollReveal } from "@/lib/animations";
import { DashboardTemplatesSection } from "@/components/dashboard/DashboardTemplatesSection";

interface Project {
  id: string;
  name: string;
  status: 'processing' | 'completed' | 'failed';
  thumbnailUrl?: string;
  duration?: number;
  createdAt: string;
}

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
  const [deletingId, setDeletingId] = useState<string | null>(null);
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
      toast.success(`Selected "${applyTemplate}"! Upload or open a project to style your video.`);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const perf = startPerfMeasure("dashboard_load");
    
    (async () => {
      const { data: pr, error } = await supabase
        .from("projects")
        .select("id, title, status, created_at, media_path, duration_seconds")
        .order("created_at", { ascending: false })
        .limit(24);

      if (!error && pr) {
        // Map data to Project UI format
        const mappedProjects = await Promise.all(pr.map(async (p: any) => {
          let thumbnailUrl;
          if (p.media_path) {
            const { data } = await supabase.storage.from("media").createSignedUrl(p.media_path, 3600);
            thumbnailUrl = data?.signedUrl;
          }
          return {
            id: p.id,
            name: p.title || 'Untitled Project',
            status: p.status as 'processing' | 'completed' | 'failed',
            thumbnailUrl,
            duration: p.duration_seconds,
            createdAt: p.created_at
          };
        }));
        setProjects(mappedProjects);
      }
      setLoading(false);
      perf.end({ project_count: (pr ?? []).length });
    })();

    return () => perf.cancel();
  }, [user]);

  const filteredProjects = useMemo(() => {
    if (!query) return projects;
    return projects.filter(p => p.name.toLowerCase().includes(query.toLowerCase()));
  }, [projects, query]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from("projects").delete().eq("id", id);
    setDeletingId(null);
    if (error) {
      toast.error(error.message);
    } else {
      setProjects(prev => prev.filter(p => p.id !== id));
      toast.success("Project deleted");
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full safe-top">
        
        {/* HEADER SECTION */}
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 mb-10">
          <motion.div variants={scrollReveal} initial="initial" animate="animate">
            <h1 className="text-4xl sm:text-5xl font-display font-bold text-[var(--text-1)] leading-tight tracking-tight">
              Welcome back, <br className="hidden sm:block" />
              <span className="text-[var(--red-3)]">Creator.</span>
            </h1>
          </motion.div>
          <motion.div variants={scrollReveal} initial="initial" animate="animate" className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => navigate('/dashboard/batch')} className="hidden sm:flex">
              Batch Upload
            </Button>
            <Button onClick={() => navigate('/dashboard/new')} size="lg" className="shadow-red-sm gap-2 whitespace-nowrap">
              <Plus size={18} /> New Project
            </Button>
          </motion.div>
        </div>

        {/* VIRAL CREATOR TEMPLATES DIRECTLY IN DASHBOARD */}
        <DashboardTemplatesSection />

        {/* MAIN LAYOUT: PROJECTS & SIDEBAR */}
        <div className="flex flex-col gap-8">
          
          {/* LEFT: PROJECTS GRID */}
          <div className="w-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-[var(--text-1)]">Recent Projects</h2>
              <div className="relative w-full max-w-[200px] sm:max-w-[260px]">
                <Input
                  placeholder="Search projects..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  className="pl-9 h-10"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-6)]" />
              </div>
            </div>

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
                {filteredProjects.map(project => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onDelete={handleDelete}
                  />
                ))}
              </motion.div>
            ) : (
              <ProjectsEmptyState
                onAction={() => navigate('/dashboard/new')}
                actionLabel={appliedTemplateName ? `Upload Video with "${appliedTemplateName}"` : "Upload Video"}
              />
            )}
          </div>

          {/* RIGHT: ACCOUNT SIDEBAR REMOVED AS PER REQUEST */}
          <div className="space-y-6 hidden lg:block">
            {/* The right sidebar was removed, we keep this empty column to maintain layout structure or we can change grid cols. Let's just remove it and let the grid-cols expand. */}
          </div>
          
        </div>
      </div>
    </DashboardLayout>
  );
}
