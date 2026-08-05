import { create } from 'zustand'

interface HistoryState {
  past: any[]
  future: any[]
  undo: () => void
  redo: () => void
  pushState: (state: any) => void
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],
  undo: () => {
    const { past, future } = get()
    if (past.length === 0) return
    const previous = past[past.length - 1]
    const newPast = past.slice(0, past.length - 1)
    // NOTE: Requires external linkage to timelineStore for true undo/redo in complex state
    // We mock the state store array here
    set({ past: newPast, future: [previous, ...future] })
  },
  redo: () => {
    const { past, future } = get()
    if (future.length === 0) return
    const next = future[0]
    const newFuture = future.slice(1)
    set({ past: [...past, next], future: newFuture })
  },
  pushState: (state) => {
    set((s) => ({
      past: [...s.past, state],
      future: []
    }))
  }
}))
