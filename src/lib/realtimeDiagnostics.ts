// Tiny in-memory registry for Realtime channel diagnostics. Hooks that
// subscribe to Supabase channels register/unregister here and record events
// as they arrive; the diagnostics panel renders the current snapshot.

export interface ChannelDiag {
  id: string;
  topic: string;
  table?: string;
  status: "subscribing" | "subscribed" | "closed" | "error";
  subscribedAt: number;
  eventCount: number;
  lastEventAt: number | null;
  lastEventType: string | null;
}

type Listener = (rows: ChannelDiag[]) => void;

const channels = new Map<string, ChannelDiag>();
const listeners = new Set<Listener>();

function emit() {
  const rows = Array.from(channels.values()).sort((a, b) => a.subscribedAt - b.subscribedAt);
  for (const l of listeners) l(rows);
}

export function registerChannel(init: Omit<ChannelDiag, "eventCount" | "lastEventAt" | "lastEventType" | "subscribedAt" | "status"> & { status?: ChannelDiag["status"] }) {
  channels.set(init.id, {
    ...init,
    status: init.status ?? "subscribing",
    subscribedAt: Date.now(),
    eventCount: 0,
    lastEventAt: null,
    lastEventType: null,
  });
  emit();
}

export function setChannelStatus(id: string, status: ChannelDiag["status"]) {
  const c = channels.get(id);
  if (!c) return;
  c.status = status;
  emit();
}

export function recordChannelEvent(id: string, type: string) {
  const c = channels.get(id);
  if (!c) return;
  c.eventCount += 1;
  c.lastEventAt = Date.now();
  c.lastEventType = type;
  emit();
}

export function unregisterChannel(id: string) {
  channels.delete(id);
  emit();
}

export function subscribeDiagnostics(listener: Listener): () => void {
  listeners.add(listener);
  listener(Array.from(channels.values()));
  return () => { listeners.delete(listener); };
}

export function snapshot(): ChannelDiag[] {
  return Array.from(channels.values());
}
