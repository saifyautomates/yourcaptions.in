// Inline "Upgrade plan" pill shown wherever a paid action is blocked
// because the user's credit balance hit zero. Includes a rich tooltip
// explaining exactly why the action is disabled and what unlocks after
// upgrading, plus a live remaining-credits readout so users always see
// what's left in their wallet.

import { useState } from "react";
import { Sparkles, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCredits } from "@/hooks/useCredits";
import UpgradeModal from "@/components/UpgradeModal";


const DEFAULT_HINT = "You're out of credits";

function RemainingLine({ action }: { action?: string }) {
  const { loading, balance, planCredits, topupCredits, legacySeconds } = useCredits();
  if (loading) return null;
  // Transcription = 1 credit / minute. Legacy seconds still count.
  const min = balance + Math.floor(legacySeconds / 60);
  return (
    <div className="mt-1 space-y-0.5 text-[10.5px] text-muted-foreground">
      <div>
        <span className="font-semibold text-foreground tabular-nums">{balance.toLocaleString()}</span>{" "}
        credits left · <span className="tabular-nums">{min.toLocaleString()}</span> min transcription
      </div>
      <div className="text-[10px] opacity-80">
        Plan {planCredits.toLocaleString()} · Top-up {topupCredits.toLocaleString()}
        {legacySeconds > 0 && <> · Legacy {Math.floor(legacySeconds / 60)}m</>}
      </div>
    </div>
  );
}

function TooltipBody({ hint, action }: { hint: string; action?: string }) {
  return (
    <div className="max-w-[260px] space-y-1.5 text-left text-[11px] leading-relaxed">
      <div className="text-[12px] font-semibold text-foreground">Credits reached 0</div>
      <div className="text-muted-foreground">{hint}</div>
      <RemainingLine action={action} />
      <div className="border-t border-border/60 pt-1.5 text-muted-foreground">
        <span className="font-medium text-foreground">After upgrading:</span>{" "}
        {action ? `${action} unlocks instantly` : "this action unlocks instantly"},
        your new plan credits are added to your wallet, and any top-ups you buy
        stay available even after the plan resets.
      </div>
    </div>
  );
}

export default function UpgradeCTA({
  label = "Upgrade plan",
  hint = DEFAULT_HINT,
  className = "",
  compact = false,
  action,
}: {
  label?: string;
  hint?: string;
  className?: string;
  compact?: boolean;
  /** Short verb describing the blocked action, e.g. "Transcription", "Dubbing". */
  action?: string;
}) {
  const { balance, loading } = useCredits();
  const [open, setOpen] = useState(false);
  const remainingChip = loading
    ? null
    : <span className="rounded-full bg-background/60 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-foreground">{balance.toLocaleString()} left</span>;

  if (compact) {
    return (
      <>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className={`inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground shadow-sm hover:brightness-110 ${className}`}
              aria-label={`${label} — ${hint}`}
            >
              <Sparkles className="h-3 w-3" /> {label}
              {remainingChip}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="p-2.5">
            <TooltipBody hint={hint} action={action} />
          </TooltipContent>
        </Tooltip>
        <UpgradeModal open={open} onOpenChange={setOpen} action={action} hint={hint} />
      </>
    );
  }
  return (
    <>
      <div
        role="status"
        className={`flex items-start justify-between gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs ${className}`}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-1 font-semibold text-primary">
            Out of credits
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Why is this disabled?"
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full text-primary/70 hover:text-primary"
                >
                  <Info className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="p-2.5">
                <TooltipBody hint={hint} action={action} />
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>
          <RemainingLine action={action} />
          <div className="mt-1 text-[10.5px] text-muted-foreground/90">
            Upgrading instantly restores access and tops up your wallet.
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground hover:brightness-110"
          title={hint}
        >
          <Sparkles className="h-3 w-3" /> {label}
        </button>
      </div>
      <UpgradeModal open={open} onOpenChange={setOpen} action={action} hint={hint} />
    </>
  );
}

