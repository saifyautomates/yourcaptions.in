import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { MoreVertical, Clock, Play, Trash2, Edit2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Project {
  id: string;
  name: string;
  status: 'processing' | 'completed' | 'failed';
  thumbnailUrl?: string;
  duration?: number;
  createdAt: string;
}

interface ProjectCardProps {
  project: Project;
  onDelete?: (id: string) => void;
  onRename?: (id: string) => void;
}

export function ProjectCard({ project, onDelete, onRename }: ProjectCardProps) {
  const formatTime = (seconds?: number) => {
    if (!seconds) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const statusColors = {
    processing: 'warning',
    ready: 'success',
    failed: 'error'
  } as const;

  const statusLabels = {
    processing: 'Processing',
    ready: 'Ready',
    failed: 'Failed'
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
    >
      <Card hoverEffects className="overflow-hidden group h-full flex flex-col relative">
        <Link to={`/editor/${project.id}`} className="absolute inset-0 z-0" aria-label={`Open ${project.name}`} />
        
        {/* Thumbnail Area */}
        <div className="relative aspect-[16/9] bg-[var(--bg-5)] overflow-hidden">
          {project.thumbnailUrl ? (
            <img 
              src={project.thumbnailUrl} 
              alt={project.name} 
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[var(--text-6)]">
              <Play size={32} />
            </div>
          )}
          
          {/* Overlay elements */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-10" />
          
          <div className="absolute top-3 left-3 z-20">
            <Badge variant={statusColors[project.status]} pulse={project.status === 'processing'}>
              {statusLabels[project.status]}
            </Badge>
          </div>

          {project.duration && (
            <div className="absolute bottom-3 right-3 z-20">
              <Badge variant="secondary" className="bg-black/60 backdrop-blur-sm border-none">
                {formatTime(project.duration)}
              </Badge>
            </div>
          )}
        </div>

        {/* Content Area */}
        <CardContent className="p-4 flex flex-col flex-grow z-20 relative pointer-events-none">
          <div className="flex justify-between items-start gap-4 pointer-events-auto">
            <div>
              <h3 className="font-semibold text-[var(--text-1)] line-clamp-1 group-hover:text-[var(--red-3)] transition-colors">
                {project.name || 'Untitled Project'}
              </h3>
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-4)] mt-1.5">
                <Clock size={12} />
                <span>{new Date(project.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 text-[var(--text-4)] hover:text-[var(--text-1)]">
                  <MoreVertical size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40 z-50 bg-[var(--bg-2)] border-[var(--border-3)]">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRename?.(project.id); }} className="hover:bg-[var(--bg-5)] focus:bg-[var(--bg-5)] cursor-pointer">
                  <Edit2 size={14} className="mr-2" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete?.(project.id); }} className="text-[var(--error)] hover:bg-[var(--error)]/10 focus:bg-[var(--error)]/10 focus:text-[var(--error)] cursor-pointer">
                  <Trash2 size={14} className="mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
