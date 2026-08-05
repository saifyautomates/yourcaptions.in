import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Wallet, AlertTriangle, Sparkles } from "lucide-react";
import { useCreditStore } from "@/stores/creditStore";
import { Link } from "react-router-dom";

interface CreditCheckModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature: string;
  durationMinutes: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CreditCheckModal({ open, onOpenChange, feature, durationMinutes, onConfirm, onCancel }: CreditCheckModalProps) {
  const { total, estimateCost, planCredits, topupCredits } = useCreditStore();
  const estimatedCost = estimateCost(durationMinutes, feature);
  const remainingAfter = total - estimatedCost;
  const isInsufficient = remainingAfter < 0;

  const featureNames: Record<string, string> = {
    transcription: "Transcription",
    caption_burn: "Caption Burn",
    ai_dubbing: "AI Dubbing",
    voice_clone: "Voice Cloning",
    translation: "Translation",
  };
  
  const featureLabel = featureNames[feature] || feature;

  return (
    <Dialog open={open} onOpenChange={(val) => {
      onOpenChange(val);
      if (!val) onCancel();
    }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isInsufficient ? (
              <><AlertTriangle className="h-5 w-5 text-destructive" /> Insufficient Credits</>
            ) : (
              <><Wallet className="h-5 w-5 text-primary" /> Confirm Action</>
            )}
          </DialogTitle>
          <DialogDescription>
            {isInsufficient 
              ? `You need ${estimatedCost} credits for this ${featureLabel} action, but you only have ${total} credits available.` 
              : `This ${featureLabel} action will use ${estimatedCost} credits.`}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Current Balance</span>
              <span className="font-medium">{total}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Estimated Cost</span>
              <span className="font-medium text-destructive">-{estimatedCost}</span>
            </div>
            <div className="h-px bg-border my-2" />
            <div className="flex justify-between items-center text-sm font-bold">
              <span>Remaining After</span>
              <span className={isInsufficient ? "text-destructive" : ""}>
                {isInsufficient ? 0 : remainingAfter}
              </span>
            </div>
            
            {total > 0 && !isInsufficient && (
              <div className="text-[11px] text-muted-foreground text-center mt-2 pt-2 border-t border-border/50">
                Will use {Math.min(planCredits, estimatedCost)} plan credits
                {estimatedCost > planCredits && ` and ${estimatedCost - planCredits} top-up credits`}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          {isInsufficient ? (
            <div className="flex flex-col sm:flex-row w-full gap-2">
              <Button asChild className="flex-1" variant="outline">
                <Link to="/pricing?topup=1">Buy Credits</Link>
              </Button>
              <Button asChild className="flex-1">
                <Link to="/pricing"><Sparkles className="w-4 h-4 mr-2" />Upgrade Plan</Link>
              </Button>
            </div>
          ) : (
            <>
              <Button variant="outline" onClick={onCancel}>Cancel</Button>
              <Button onClick={() => { onConfirm(); onOpenChange(false); }}>Confirm & Proceed</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
