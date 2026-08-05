import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

interface InsufficientCreditsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  required: number;
  available: number;
  featureName: string;
}

export function InsufficientCreditsModal({ 
  open, 
  onOpenChange, 
  required, 
  available, 
  featureName 
}: InsufficientCreditsModalProps) {
  const missing = Math.max(0, required - available);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" /> Insufficient Credits
          </DialogTitle>
          <DialogDescription>
            You need {required} credits to use {featureName}, but you only have {available} credits.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 space-y-2 text-sm text-destructive font-medium text-center">
            You need {missing} more credits to perform this action.
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button asChild variant="outline" className="w-full sm:w-1/2">
            <Link to="/pricing?topup=1">Buy Credits</Link>
          </Button>
          <Button asChild className="w-full sm:w-1/2 bg-primary text-primary-foreground">
            <Link to="/pricing">
              <Sparkles className="w-4 h-4 mr-2" /> Upgrade Plan
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
