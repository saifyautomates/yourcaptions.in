import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export type JobStatus = 'pending' | 'processing' | 'ready' | 'failed';

export function StatusBadge({ status, message }: { status: JobStatus; message?: string }) {
  if (status === 'processing' || status === 'pending') {
    return (
      <Badge variant="warning" className="gap-1.5 py-1">
        <Loader2 size={12} className="animate-spin" />
        {message || 'Processing...'}
      </Badge>
    );
  }
  
  if (status === 'ready') {
    return (
      <Badge variant="success" className="gap-1.5 py-1">
        <CheckCircle2 size={12} />
        {message || 'Ready'}
      </Badge>
    );
  }

  if (status === 'failed') {
    return (
      <Badge variant="destructive" className="gap-1.5 py-1">
        <AlertCircle size={12} />
        {message || 'Failed'}
      </Badge>
    );
  }

  return <Badge variant="outline">Unknown</Badge>;
}
