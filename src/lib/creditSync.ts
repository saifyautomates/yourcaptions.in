import { useCreditStore } from '@/stores/creditStore';
import { supabase } from '@/integrations/supabase/client';

export type CreditFeature = keyof typeof CreditSync.RATES;

export const CreditSync = {
  // Calculate cost BEFORE any action
  estimateCost(feature: CreditFeature, durationMinutes: number): number {
    const rate = CreditSync.RATES[feature] || 1;
    const flatRates = ['lip_sync', 'avatar_generation', 'video_generation', 'background_removal'];
    
    if (flatRates.includes(feature)) {
      return rate;
    }
    
    return Math.ceil(durationMinutes) * rate;
  },

  // Check if user can afford an action
  canAfford(feature: CreditFeature, durationMinutes: number): {
    canAfford: boolean;
    cost: number;
    balance: number;
    missing: number;
    planCreditsUsed: number;
    topupCreditsUsed: number;
  } {
    const cost = CreditSync.estimateCost(feature, durationMinutes);
    const { total, planCredits, topupCredits } = useCreditStore.getState();
    
    const missing = Math.max(0, cost - total);
    const canAfford = missing === 0;
    
    let planCreditsUsed = 0;
    let topupCreditsUsed = 0;
    
    if (canAfford) {
      if (planCredits >= cost) {
        planCreditsUsed = cost;
      } else {
        planCreditsUsed = planCredits;
        topupCreditsUsed = cost - planCredits;
      }
    }
    
    return {
      canAfford,
      cost,
      balance: total,
      missing,
      planCreditsUsed,
      topupCreditsUsed
    };
  },

  // Format credit amount for display
  formatCost(credits: number): string {
    return `${credits} credit${credits !== 1 ? 's' : ''}`;
  },

  // Format balance for display
  formatBalance(planCredits: number, topupCredits: number): string {
    const total = planCredits + topupCredits;
    return `${total} credits (${planCredits} plan + ${topupCredits} topup)`;
  },

  // Credit feature rates (must match backend credit_rates table)
  RATES: {
    transcription: 1,        // per minute
    caption_burn: 2,         // per minute
    ai_dubbing: 5,           // per minute
    tts: 2,                  // per minute output
    voice_clone: 3,          // per minute
    audio_enhancement: 1,    // per minute
    lip_sync: 10,            // flat rate per video
    avatar_generation: 5,    // flat rate per image
    video_generation: 20,    // flat rate per video
    background_removal: 2,   // flat rate per image
    translation: 1,          // per minute of transcript
  } as const,

  // Realtime subscription
  subscribeToBalance(userId: string, onChange: (balance: { total: number; planCredits: number; topupCredits: number }) => void): () => void {
    const channel = supabase
      .channel('credit-balance-sync')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'credit_wallets',
        filter: `user_id=eq.${userId}`
      }, (payload: any) => {
        const newRow = payload.new;
        if (newRow) {
           const plan = newRow.plan_credits ?? 0;
           const topup = newRow.topup_credits ?? 0;
           onChange({
             total: plan + topup,
             planCredits: plan,
             topupCredits: topup
           });
        }
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }
};
