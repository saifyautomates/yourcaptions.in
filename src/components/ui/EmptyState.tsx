import React from 'react';
import { motion } from 'framer-motion';
import { scrollReveal } from '@/lib/animations';
import { cn } from '@/lib/utils';
import { FileVideo, UploadCloud, FolderOpen } from 'lucide-react';
import { Button } from './button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className
}: EmptyStateProps) {
  return (
    <motion.div
      variants={scrollReveal}
      initial="initial"
      animate="animate"
      className={cn(
        'flex flex-col items-center justify-center p-12 text-center',
        'border border-dashed border-[var(--border-4)] rounded-2xl bg-[var(--bg-2)]',
        className
      )}
    >
      <div className="w-16 h-16 bg-[var(--bg-5)] rounded-full flex items-center justify-center text-[var(--red-3)] mb-6">
        {icon || <FolderOpen size={32} />}
      </div>
      <h3 className="text-xl font-bold text-[var(--text-1)] mb-2 font-display">{title}</h3>
      <p className="text-[var(--text-4)] text-sm max-w-[280px] mx-auto mb-6">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button onClick={onAction} variant="outline" className="gap-2">
          <UploadCloud size={18} />
          {actionLabel}
        </Button>
      )}
    </motion.div>
  );
}

export function ProjectsEmptyState({ onAction, actionLabel }: { onAction: () => void; actionLabel?: string }) {
  return (
    <EmptyState
      icon={<FileVideo size={32} />}
      title="No projects yet"
      description="Upload your first video to generate AI-powered captions instantly."
      actionLabel={actionLabel || "Upload Video"}
      onAction={onAction}
    />
  );
}
