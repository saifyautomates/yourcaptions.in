import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Track, Clip, TransitionConfig } from '../types/editor.types'
import { DEFAULT_COLOR_GRADE, DEFAULT_AUDIO_SETTINGS, DEFAULT_TRANSFORM } from '../types/editor.types'

interface TimelineState {
  tracks: Track[]
  clips: Clip[]
  zoom: number
  scrollX: number
  scrollY: number
  addTrack: (type: Track['type'], name?: string) => Track
  removeTrack: (id: string) => void
  updateTrack: (id: string, updates: Partial<Track>) => void
  reorderTrack: (id: string, newOrder: number) => void
  toggleMute: (id: string) => void
  toggleSolo: (id: string) => void
  toggleLock: (id: string) => void
  toggleVisibility: (id: string) => void
  setTrackHeight: (id: string, height: number) => void
  addClip: (clip: Omit<Clip, 'id'>) => Clip
  removeClip: (id: string) => void
  removeClips: (ids: string[]) => void
  updateClip: (id: string, updates: Partial<Clip>) => void
  moveClip: (id: string, trackId: string, startTime: number) => void
  trimClipStart: (id: string, trimIn: number) => void
  trimClipEnd: (id: string, trimOut: number) => void
  splitClip: (id: string, time: number) => [Clip, Clip] | null
  duplicateClip: (id: string) => Clip
  rippleDelete: (id: string) => void
  liftDelete: (id: string) => void
  setClipSpeed: (id: string, speed: number) => void
  reverseClip: (id: string) => void
  linkClips: (id1: string, id2: string) => void
  unlinkClip: (id: string) => void
  addTransition: (clipId: string, side: 'in' | 'out', config: TransitionConfig) => void
  removeTransition: (clipId: string, side: 'in' | 'out') => void
  nestClips: (ids: string[]) => Clip
  setZoom: (zoom: number) => void
  zoomIn: () => void
  zoomOut: () => void
  fitToWindow: (containerWidth: number, totalDuration: number) => void
  setScrollX: (x: number) => void
  setScrollY: (y: number) => void
  getClipAtTime: (trackId: string, time: number) => Clip | null
  getClipsInRange: (startTime: number, endTime: number) => Clip[]
  getTrackClips: (trackId: string) => Clip[]
  getTotalDuration: () => number
  snapToGrid: (time: number) => number
}

const DEFAULT_TRACK_COLORS: Record<Track['type'], string> = {
  video: '#1A3A5C',
  audio: '#1A4A2A',
  caption: '#3A1A5C',
  overlay: '#5C3A1A',
  sfx: '#1A4A4A',
  music: '#4A1A3A'
}

export const useTimelineStore = create<TimelineState>()(
  devtools((set, get) => ({
    tracks: [],
    clips: [],
    zoom: 100,
    scrollX: 0,
    scrollY: 0,
    addTrack: (type, name) => {
      const tracks = get().tracks
      const track: Track = {
        id: crypto.randomUUID(),
        projectId: '',
        name: name || `${type.charAt(0).toUpperCase() + type.slice(1)} ${tracks.filter(t => t.type === type).length + 1}`,
        type,
        order: tracks.length,
        height: type === 'audio' || type === 'music' || type === 'sfx' ? 60 : 80,
        muted: false,
        solo: false,
        locked: false,
        visible: true,
        color: DEFAULT_TRACK_COLORS[type]
      }
      set((s) => ({ tracks: [...s.tracks, track] }))
      return track
    },
    removeTrack: (id) => set((s) => ({
      tracks: s.tracks.filter(t => t.id !== id),
      clips: s.clips.filter(c => c.trackId !== id)
    })),
    updateTrack: (id, updates) => set((s) => ({
      tracks: s.tracks.map(t => t.id === id ? { ...t, ...updates } : t)
    })),
    reorderTrack: (id, newOrder) => set((s) => {
      const tracks = [...s.tracks]
      const idx = tracks.findIndex(t => t.id === id)
      const [track] = tracks.splice(idx, 1)
      tracks.splice(newOrder, 0, track)
      return { tracks: tracks.map((t, i) => ({ ...t, order: i })) }
    }),
    toggleMute: (id) => set((s) => ({
      tracks: s.tracks.map(t => t.id === id ? { ...t, muted: !t.muted } : t)
    })),
    toggleSolo: (id) => set((s) => ({
      tracks: s.tracks.map(t => t.id === id ? { ...t, solo: !t.solo } : t)
    })),
    toggleLock: (id) => set((s) => ({
      tracks: s.tracks.map(t => t.id === id ? { ...t, locked: !t.locked } : t)
    })),
    toggleVisibility: (id) => set((s) => ({
      tracks: s.tracks.map(t => t.id === id ? { ...t, visible: !t.visible } : t)
    })),
    setTrackHeight: (id, height) => set((s) => ({
      tracks: s.tracks.map(t => t.id === id ? { ...t, height: Math.max(40, Math.min(200, height)) } : t)
    })),
    addClip: (clipData) => {
      const clip: Clip = { ...clipData, id: crypto.randomUUID() }
      set((s) => ({ clips: [...s.clips, clip] }))
      return clip
    },
    removeClip: (id) => set((s) => ({ clips: s.clips.filter(c => c.id !== id) })),
    removeClips: (ids) => set((s) => ({ clips: s.clips.filter(c => !ids.includes(c.id)) })),
    updateClip: (id, updates) => set((s) => ({
      clips: s.clips.map(c => c.id === id ? { ...c, ...updates } : c)
    })),
    moveClip: (id, trackId, startTime) => {
      const clip = get().clips.find(c => c.id === id)
      if (!clip) return
      set((s) => ({
        clips: s.clips.map(c => {
          if (c.id === id) return { ...c, trackId, startTime: Math.max(0, startTime) }
          if (c.id === clip.linkedClipId) return { ...c, startTime: Math.max(0, startTime) }
          return c
        })
      }))
    },
    trimClipStart: (id, trimIn) => set((s) => ({
      clips: s.clips.map(c => {
        if (c.id !== id) return c
        const maxTrim = c.trimIn + c.duration - 0.1
        const newTrimIn = Math.max(0, Math.min(trimIn, maxTrim))
        const diff = newTrimIn - c.trimIn
        return { ...c, trimIn: newTrimIn, startTime: c.startTime + diff, duration: c.duration - diff }
      })
    })),
    trimClipEnd: (id, trimOut) => set((s) => ({
      clips: s.clips.map(c => {
        if (c.id !== id) return c
        const maxDuration = c.duration - 0.1
        return { ...c, trimOut: Math.max(0, Math.min(trimOut, maxDuration)), duration: Math.max(0.1, c.duration - trimOut) }
      })
    })),
    splitClip: (id, time) => {
      const clip = get().clips.find(c => c.id === id)
      if (!clip) return null
      if (time <= clip.startTime || time >= clip.startTime + clip.duration) return null
      const splitPoint = time - clip.startTime
      const clip1: Clip = { ...clip, id: crypto.randomUUID(), duration: splitPoint }
      const clip2: Clip = {
        ...clip,
        id: crypto.randomUUID(),
        startTime: time,
        trimIn: clip.trimIn + splitPoint,
        duration: clip.duration - splitPoint
      }
      set((s) => ({
        clips: s.clips.filter(c => c.id !== id).concat([clip1, clip2])
      }))
      return [clip1, clip2]
    },
    duplicateClip: (id) => {
      const clip = get().clips.find(c => c.id === id)
      if (!clip) throw new Error('Clip not found')
      const newClip: Clip = {
        ...clip,
        id: crypto.randomUUID(),
        startTime: clip.startTime + clip.duration,
        linkedClipId: null
      }
      set((s) => ({ clips: [...s.clips, newClip] }))
      return newClip
    },
    rippleDelete: (id) => {
      const clip = get().clips.find(c => c.id === id)
      if (!clip) return
      const gapStart = clip.startTime
      const gapSize = clip.duration
      set((s) => ({
        clips: s.clips
          .filter(c => c.id !== id)
          .map(c => c.startTime >= gapStart ? { ...c, startTime: c.startTime - gapSize } : c)
      }))
    },
    liftDelete: (id) => set((s) => ({ clips: s.clips.filter(c => c.id !== id) })),
    setClipSpeed: (id, speed) => set((s) => ({
      clips: s.clips.map(c => c.id === id
        ? { ...c, speed, duration: (c.duration / c.speed) * speed }
        : c)
    })),
    reverseClip: (id) => set((s) => ({
      clips: s.clips.map(c => c.id === id ? { ...c, reversed: !c.reversed } : c)
    })),
    linkClips: (id1, id2) => set((s) => ({
      clips: s.clips.map(c =>
        c.id === id1 ? { ...c, linkedClipId: id2 }
        : c.id === id2 ? { ...c, linkedClipId: id1 }
        : c
      )
    })),
    unlinkClip: (id) => {
      const clip = get().clips.find(c => c.id === id)
      if (!clip) return
      set((s) => ({
        clips: s.clips.map(c =>
          c.id === id ? { ...c, linkedClipId: null }
          : c.id === clip.linkedClipId ? { ...c, linkedClipId: null }
          : c
        )
      }))
    },
    addTransition: (clipId, side, config) => set((s) => ({
      clips: s.clips.map(c => c.id === clipId
        ? { ...c, [side === 'in' ? 'transitionIn' : 'transitionOut']: config }
        : c)
    })),
    removeTransition: (clipId, side) => set((s) => ({
      clips: s.clips.map(c => c.id === clipId
        ? { ...c, [side === 'in' ? 'transitionIn' : 'transitionOut']: null }
        : c)
    })),
    nestClips: (ids) => {
      const clips = get().clips.filter(c => ids.includes(c.id))
      if (!clips.length) throw new Error('No clips to nest')
      const startTime = Math.min(...clips.map(c => c.startTime))
      const endTime = Math.max(...clips.map(c => c.startTime + c.duration))
      const track = get().tracks[0]
      const compound: Clip = {
        id: crypto.randomUUID(),
        trackId: track.id,
        mediaId: null,
        type: 'video',
        startTime,
        duration: endTime - startTime,
        trimIn: 0, trimOut: 0,
        speed: 1, reversed: false, opacity: 1,
        blendMode: 'normal',
        transform: DEFAULT_TRANSFORM,
        colorGrade: DEFAULT_COLOR_GRADE,
        effects: [], audioSettings: DEFAULT_AUDIO_SETTINGS,
        textSettings: null, captionData: null,
        keyframes: [], linkedClipId: null,
        transitionIn: null, transitionOut: null
      }
      set((s) => ({
        clips: s.clips.filter(c => !ids.includes(c.id)).concat([compound])
      }))
      return compound
    },
    setZoom: (zoom) => set({ zoom: Math.max(10, Math.min(2000, zoom)) }),
    zoomIn: () => set((s) => ({ zoom: Math.min(2000, s.zoom * 1.25) })),
    zoomOut: () => set((s) => ({ zoom: Math.max(10, s.zoom * 0.8) })),
    fitToWindow: (containerWidth, totalDuration) => {
      if (totalDuration <= 0) return
      set({ zoom: containerWidth / totalDuration })
    },
    setScrollX: (x) => set({ scrollX: Math.max(0, x) }),
    setScrollY: (y) => set({ scrollY: Math.max(0, y) }),
    getClipAtTime: (trackId, time) =>
      get().clips.find(c => c.trackId === trackId && c.startTime <= time && c.startTime + c.duration > time) || null,
    getClipsInRange: (startTime, endTime) =>
      get().clips.filter(c => c.startTime < endTime && c.startTime + c.duration > startTime),
    getTrackClips: (trackId) =>
      get().clips.filter(c => c.trackId === trackId).sort((a, b) => a.startTime - b.startTime),
    getTotalDuration: () => {
      const clips = get().clips
      if (!clips.length) return 0
      return Math.max(...clips.map(c => c.startTime + c.duration))
    },
    snapToGrid: (time) => {
      const { zoom } = get()
      const gridSize = zoom < 50 ? 1 : zoom < 200 ? 0.5 : 0.1
      return Math.round(time / gridSize) * gridSize
    }
  }))
)
