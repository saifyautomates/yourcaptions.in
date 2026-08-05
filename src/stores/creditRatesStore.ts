import { create } from 'zustand';

interface CreditRatesState {
  rates: Record<string, number>;
  setRates: (rates: any[]) => void;
}

export const useCreditRatesStore = create<CreditRatesState>((set) => ({
  rates: {},
  setRates: (ratesArray) => {
    const rates = Object.fromEntries(ratesArray.map((r) => [r.feature, r.credits_per_unit]));
    set({ rates });
  }
}));
