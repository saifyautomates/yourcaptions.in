// Lightweight background-music store per project.
// Uses useSyncExternalStore + localStorage for persistence.

import { useSyncExternalStore } from "react";

export type MusicTrack = {
  id: string;
  name: string;
  src: string;            // audio URL (blob:, http(s):, data:)
  volume: number;         // 0..1
  fadeIn: number;         // seconds
  fadeOut: number;        // seconds
  offset: number;         // seconds into song where playback starts (trim-in)
  trimEnd: number | null; // seconds into song where playback stops (null = end)
  startAt: number;        // when to start on the video timeline (seconds)
  loop: boolean;
  duck: boolean;          // duck under narration
  muted: boolean;
};

export type MusicState = {
  tracks: MusicTrack[];
  duckAmount: number;       // 0..1 how much to reduce during speech
  masterVolume: number;     // 0..1
};

const KEY = (pid: string) => `yc.music.${pid}`;

const DEFAULT_STATE: MusicState = {
  tracks: [],
  duckAmount: 0.65,
  masterVolume: 0.8,
};

const listeners = new Map<string, Set<() => void>>();
const cache = new Map<string, MusicState>();

function load(pid: string): MusicState {
  if (cache.has(pid)) return cache.get(pid)!;
  try {
    const raw = localStorage.getItem(KEY(pid));
    if (raw) {
      const parsed = JSON.parse(raw) as MusicState;
      // strip blob: URLs — they don't survive reloads
      parsed.tracks = (parsed.tracks || []).filter((t) => !t.src.startsWith("blob:"));
      cache.set(pid, parsed);
      return parsed;
    }
  } catch {}
  cache.set(pid, DEFAULT_STATE);
  return DEFAULT_STATE;
}

function save(pid: string, s: MusicState) {
  cache.set(pid, s);
  try {
    // don't persist blob URLs (they don't survive reload)
    const clean = { ...s, tracks: s.tracks.filter((t) => !t.src.startsWith("blob:")) };
    localStorage.setItem(KEY(pid), JSON.stringify(clean));
  } catch {}
  const set = listeners.get(pid);
  if (set) set.forEach((fn) => fn());
}

export function getMusicState(pid: string): MusicState {
  return load(pid);
}

export function setMusicState(pid: string, updater: (s: MusicState) => MusicState) {
  save(pid, updater(load(pid)));
}

export function updateTrack(pid: string, id: string, patch: Partial<MusicTrack>) {
  setMusicState(pid, (s) => ({
    ...s,
    tracks: s.tracks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
  }));
}

export function addTrack(pid: string, t: Omit<MusicTrack, "id">) {
  const id = crypto.randomUUID();
  setMusicState(pid, (s) => ({ ...s, tracks: [...s.tracks, { ...t, id }] }));
  return id;
}

export function removeTrack(pid: string, id: string) {
  setMusicState(pid, (s) => ({ ...s, tracks: s.tracks.filter((t) => t.id !== id) }));
}

export function useMusicState(pid: string): MusicState {
  return useSyncExternalStore(
    (cb) => {
      let set = listeners.get(pid);
      if (!set) {
        set = new Set();
        listeners.set(pid, set);
      }
      set.add(cb);
      return () => set!.delete(cb);
    },
    () => load(pid),
    () => DEFAULT_STATE,
  );
}

export const DEFAULT_TRACK: Omit<MusicTrack, "id" | "name" | "src"> = {
  volume: 0.6,
  fadeIn: 1.5,
  fadeOut: 2,
  offset: 0,
  trimEnd: null,
  startAt: 0,
  loop: true,
  duck: true,
  muted: false,
};
