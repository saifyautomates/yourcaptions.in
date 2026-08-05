import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  const sizeMap = {
    sm: 14,
    md: 18,
    lg: 24,
    xl: 32,
  };
  return (
    <Loader2 
      size={sizeMap[size]} 
      className={cn('animate-spin', className)} 
    />
  );
}
