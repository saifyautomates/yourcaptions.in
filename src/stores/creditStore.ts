import { create } from 'zustand';

interface CreditState {
  balance: number;
  planCredits: number;
  topupCredits: number;
  setCredits: (plan: number, topup: number) => void;
  deductCredits: (amount: number) => void;
}

export const useCreditStore = create<CreditState>((set) => ({
  balance: 0,
  planCredits: 0,
  topupCredits: 0,
  setCredits: (planCredits, topupCredits) => set({ 
    planCredits, 
    topupCredits,
    balance: planCredits + topupCredits
  }),
  deductCredits: (amount) => set((state) => {
    let remaining = amount;
    let newPlan = state.planCredits;
    let newTopup = state.topupCredits;

    if (newPlan >= remaining) {
      newPlan -= remaining;
      remaining = 0;
    } else {
      remaining -= newPlan;
      newPlan = 0;
      newTopup -= remaining;
    }
    
    return {
      planCredits: Math.max(0, newPlan),
      topupCredits: Math.max(0, newTopup),
      balance: Math.max(0, newPlan) + Math.max(0, newTopup)
    };
  })
}));
