import { create } from 'zustand';

interface FeatureFlagsState {
  flags: Record<string, any>;
  setFlags: (flags: any[]) => void;
}

export const useFeatureFlagsStore = create<FeatureFlagsState>((set) => ({
  flags: {},
  setFlags: (flagsArray) => {
    const flags = Object.fromEntries(flagsArray.map((f) => [f.feature_name, f]));
    set({ flags });
  }
}));
