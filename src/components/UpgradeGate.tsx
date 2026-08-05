// Global listener for HTTP 402 events and explicit feature gating.
import { useEffect, useRef, useState, ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UpgradeModal } from "@/components/UpgradeModal";
import { HTTP_402_EVENT, type Http402Detail } from "@/lib/http402";

export function UpgradeGate() {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Http402Detail | null>(null);
  const lastFiredRef = useRef(0);
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();

  useEffect(() => {
    const handler = (ev: Event) => {
      const d = (ev as CustomEvent<Http402Detail>).detail;
      const now = Date.now();
      if (now - lastFiredRef.current < 1500) return;
      lastFiredRef.current = now;

      void qc.invalidateQueries({ queryKey: ["credits"] });
      void qc.invalidateQueries({ queryKey: ["wallet"] });
      void qc.invalidateQueries({ queryKey: ["plan-info"] });
      setDetail(d);

      if (location.pathname.startsWith("/pricing")) {
        toast.error(d?.message || "This action requires more credits or a higher plan.");
        return;
      }

      const inApp = location.pathname.startsWith("/dashboard") || location.pathname.startsWith("/admin");
      if (!inApp) {
        toast.error(d?.message || "Upgrade required to continue.");
        navigate("/pricing");
        return;
      }

      setOpen(true);
    };

    window.addEventListener(HTTP_402_EVENT, handler as EventListener);
    return () => window.removeEventListener(HTTP_402_EVENT, handler as EventListener);
  }, [location.pathname, navigate, qc]);

  return (
    <UpgradeModal
      open={open}
      onOpenChange={setOpen}
      action={detail?.action}
      hint={detail?.message || detail?.reason}
    />
  );
}

// Wrapper component to proactively check credits and tier before allowing consumption
export function FeatureGate({ 
  children, 
  requiredTier = 'editor',
  requiredCredits = 0,
  fallback
}: { 
  children: ReactNode; 
  requiredTier?: 'editor' | 'creator' | 'studio';
  requiredCredits?: number;
  fallback?: ReactNode;
}) {
  const qc = useQueryClient();
  
  // Use existing cached plan-info and credits
  const planInfo = qc.getQueryData<any>(["plan-info"]);
  const credits = qc.getQueryData<any>(["credits"]);
  
  const currentTier = planInfo?.plan || 'editor';
  const availableCredits = credits?.balance || 0;
  
  const tierWeight: Record<string, number> = {
    'editor': 1,
    'creator': 2,
    'studio': 3,
    'starter': 1 // map old starter to editor
  };

  const hasRequiredTier = (tierWeight[currentTier] || 1) >= tierWeight[requiredTier];
  const hasRequiredCredits = availableCredits >= requiredCredits;

  if (!hasRequiredTier || !hasRequiredCredits) {
    return fallback ? <>{fallback}</> : (
      <div className="p-4 rounded-md border border-dashed border-orange-200 bg-orange-50/50 text-orange-800 text-sm">
        This feature requires the <strong>{requiredTier.charAt(0).toUpperCase() + requiredTier.slice(1)}</strong> plan 
        and at least {requiredCredits} credits. Please upgrade to access it.
      </div>
    );
  }

  return <>{children}</>;
}
