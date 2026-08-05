import { create } from 'zustand';

interface PlanPricingState {
  pricing: any[];
  setPricing: (pricing: any[]) => void;
}

export const usePlanPricingStore = create<PlanPricingState>((set) => ({
  pricing: [],
  setPricing: (pricing) => set({ pricing })
}));
