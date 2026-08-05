import { useState, useEffect } from 'react';
import { useCreditStore } from '@/stores/creditStore';
import { usePlanStore } from '@/stores/planStore';
import { InsufficientCreditsModal } from '../credits/InsufficientCreditsModal';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

interface UploadValidatorProps {
  file: File;
  durationSeconds?: number;
  onValidationPassed: () => void;
  onCancel: () => void;
}

export function UploadValidator({ file, durationSeconds, onValidationPassed, onCancel }: UploadValidatorProps) {
  const { total, estimateCost } = useCreditStore();
  const { getMaxVideoDuration, getStorageLimit } = usePlanStore();
  
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [error, setError] = useState<{ type: 'duration' | 'size' | 'storage' | 'credits', message: string } | null>(null);
  const [isValidated, setIsValidated] = useState(false);

  useEffect(() => {
    if (isValidated) return;

    const maxDurationSeconds = getMaxVideoDuration();
    const maxSizeBytes = 2 * 1024 * 1024 * 1024; // Default 2GB for example
    
    // Storage limit in bytes
    const storageLimitBytes = getStorageLimit() * 1024 * 1024 * 1024; 
    const currentStorageUsed = 0; // In a real app, fetch this from context/store

    // 1. Check Duration
    if (durationSeconds && durationSeconds > maxDurationSeconds) {
      setError({
        type: 'duration',
        message: `Your video is ${Math.round(durationSeconds / 60)} min long. Your plan supports up to ${Math.round(maxDurationSeconds / 60)} min.`
      });
      return;
    }

    // 2. Check File Size
    if (file.size > maxSizeBytes) {
      setError({
        type: 'size',
        message: `This file is ${(file.size / (1024 * 1024 * 1024)).toFixed(2)} GB. Max allowed is ${(maxSizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB.`
      });
      return;
    }

    // 3. Check Storage Quota
    if (currentStorageUsed + file.size > storageLimitBytes) {
      setError({
        type: 'storage',
        message: `You've used ${(currentStorageUsed / (1024*1024*1024)).toFixed(2)} GB of your ${getStorageLimit()} GB storage. This file needs ${Math.ceil(file.size / (1024*1024*1024))} GB.`
      });
      return;
    }

    // 4. Check Credits
    if (durationSeconds) {
      const cost = estimateCost(durationSeconds / 60, 'transcription');
      if (total < cost) {
        setShowCreditModal(true);
        return;
      }
    }

    setIsValidated(true);
    onValidationPassed();
  }, [file, durationSeconds, total, estimateCost, getMaxVideoDuration, getStorageLimit, onValidationPassed, isValidated]);

  if (showCreditModal && durationSeconds) {
    const cost = estimateCost(durationSeconds / 60, 'transcription');
    return (
      <InsufficientCreditsModal 
        open={showCreditModal} 
        onOpenChange={(v) => { setShowCreditModal(v); if (!v) onCancel(); }}
        required={cost}
        available={total}
        featureName="Transcription"
      />
    );
  }

  if (error) {
    return (
      <div className="p-4 border border-destructive bg-destructive/5 rounded-lg flex flex-col items-center justify-center text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-destructive" />
        <p className="text-sm font-medium">{error.message}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button asChild>
            <Link to="/pricing">Upgrade Plan</Link>
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
