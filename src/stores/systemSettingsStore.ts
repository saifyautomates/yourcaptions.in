import { create } from 'zustand';

interface SystemSettingsState {
  settings: Record<string, any>;
  announcement_bar: any;
  setSettings: (settings: any[]) => void;
  updateAnnouncementBar: (bar: any) => void;
}

export const useSystemSettingsStore = create<SystemSettingsState>((set) => ({
  settings: {},
  announcement_bar: null,
  setSettings: (settingsArray) => {
    const settings = Object.fromEntries(settingsArray.map((s) => [s.key, s.value]));
    set({ settings, announcement_bar: settings['announcement_bar'] });
  },
  updateAnnouncementBar: (bar) => set({ announcement_bar: bar })
}));
