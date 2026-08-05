// Lightweight pub/sub for caption animation timing samples.
// Emitted whenever a caption chunk mounts (i.e. a word entrance animation fires).
// Consumers (PerfHUD) subscribe to display drift between expected vs actual fire time.

export type AnimSample = {
  segIdx: number;
  expected: number;   // segment.start seconds — when the animation should fire
  actual: number;     // video.currentTime seconds at the moment of mount
  drift: number;      // actual - expected (ms). Positive = late, negative = early.
  duration: number;   // configured --cap-dur in ms
  transition: string; // transition name
  at: number;         // performance.now() timestamp
};

type Listener = (s: AnimSample) => void;
const listeners = new Set<Listener>();
const recent: AnimSample[] = [];
const MAX = 20;

export function emitAnimSample(s: AnimSample) {
  recent.push(s);
  if (recent.length > MAX) recent.shift();
  listeners.forEach((l) => l(s));
}

export function subscribeAnimSamples(l: Listener): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function getRecentAnimSamples(): AnimSample[] {
  return recent.slice();
}
