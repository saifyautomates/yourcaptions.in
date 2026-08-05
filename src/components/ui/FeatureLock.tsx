import React from 'react';
import { Lock } from 'lucide-react';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useNavigate } from 'react-router-dom';

interface FeatureLockProps {
  feature: string;
  children: React.ReactNode;
  className?: string;
}

export function FeatureLock({ feature, children, className = "" }: FeatureLockProps) {
  const { canAccess, lockReason } = useFeatureAccess(feature);
  const navigate = useNavigate();

  if (canAccess) {
    return <>{children}</>;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className={`relative inline-block opacity-70 cursor-not-allowed ${className}`}
            onClickCapture={(e) => {
              e.preventDefault();
              e.stopPropagation();
              navigate('/pricing');
            }}
          >
            <div className="pointer-events-none">
              {children}
            </div>
            <div className="absolute -top-1 -right-1 bg-background border border-border rounded-full p-0.5 shadow-sm">
              <Lock className="w-3 h-3 text-muted-foreground" />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{lockReason || "Feature locked"}</p>
          <p className="text-xs text-muted-foreground mt-1 text-center">Click to upgrade</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
