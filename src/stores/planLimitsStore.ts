import { create } from 'zustand';

interface PlanLimitsState {
  limits: Record<string, any>;
  setLimits: (limits: any[]) => void;
}

export const usePlanLimitsStore = create<PlanLimitsState>((set) => ({
  limits: {},
  setLimits: (limitsArray) => {
    const limits = Object.fromEntries(limitsArray.map((p) => [p.plan, p]));
    set({ limits });
  }
}));
