import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { Tool, Workspace, Marker } from '../types/editor.types'

interface EditorState {
  currentTime: number
  isPlaying: boolean
  playbackSpeed: number
  loop: boolean
  inPoint: number | null
  outPoint: number | null
  duration: number
  activeTool: Tool
  activeWorkspace: Workspace
  selectedClipIds: string[]
  selectedTrackId: string | null
  multiSelectActive: boolean
  snapEnabled: boolean
  showWaveforms: boolean
  showThumbnails: boolean
  showSafeZones: boolean
  showGrid: boolean
  showRulers: boolean
  canvasZoom: number
  leftPanelWidth: number
  rightPanelWidth: number
  timelineHeight: number
  leftPanelTab: string
  isLeftPanelOpen: boolean
  isRightPanelOpen: boolean
  markers: Marker[]
  setCurrentTime: (time: number) => void
  setIsPlaying: (playing: boolean) => void
  setPlaybackSpeed: (speed: number) => void
  toggleLoop: () => void
  setInPoint: (time: number | null) => void
  setOutPoint: (time: number | null) => void
  setDuration: (duration: number) => void
  setActiveTool: (tool: Tool) => void
  setActiveWorkspace: (workspace: Workspace) => void
  selectClip: (id: string, multi?: boolean) => void
  deselectAll: () => void
  selectTrack: (id: string | null) => void
  toggleSnap: () => void
  toggleWaveforms: () => void
  toggleThumbnails: () => void
  setCanvasZoom: (zoom: number) => void
  setLeftPanelWidth: (width: number) => void
  setRightPanelWidth: (width: number) => void
  setTimelineHeight: (height: number) => void
  setLeftPanelTab: (tab: string) => void
  toggleLeftPanel: () => void
  toggleRightPanel: () => void
  addMarker: (marker: Omit<Marker, 'id'>) => void
  removeMarker: (id: string) => void
  updateMarker: (id: string, updates: Partial<Marker>) => void
}

export const useEditorStore = create<EditorState>()(
  devtools(
    persist(
      (set, get) => ({
        currentTime: 0,
        isPlaying: false,
        playbackSpeed: 1,
        loop: false,
        inPoint: null,
        outPoint: null,
        duration: 0,
        activeTool: 'select',
        activeWorkspace: 'edit',
        selectedClipIds: [],
        selectedTrackId: null,
        multiSelectActive: false,
        snapEnabled: true,
        showWaveforms: true,
        showThumbnails: true,
        showSafeZones: false,
        showGrid: false,
        showRulers: true,
        canvasZoom: 1,
        leftPanelWidth: 280,
        rightPanelWidth: 320,
        timelineHeight: 220,
        leftPanelTab: 'media',
        isLeftPanelOpen: true,
        isRightPanelOpen: true,
        markers: [],
        setCurrentTime: (time) => set({ currentTime: Math.max(0, time) }),
        setIsPlaying: (playing) => set({ isPlaying: playing }),
        setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
        toggleLoop: () => set((s) => ({ loop: !s.loop })),
        setInPoint: (time) => set({ inPoint: time }),
        setOutPoint: (time) => set({ outPoint: time }),
        setDuration: (duration) => set({ duration }),
        setActiveTool: (tool) => set({ activeTool: tool }),
        setActiveWorkspace: (workspace) => set({ activeWorkspace: workspace }),
        selectClip: (id, multi = false) => set((s) => ({
          selectedClipIds: multi
            ? s.selectedClipIds.includes(id)
              ? s.selectedClipIds.filter(i => i !== id)
              : [...s.selectedClipIds, id]
            : [id]
        })),
        deselectAll: () => set({ selectedClipIds: [], selectedTrackId: null }),
        selectTrack: (id) => set({ selectedTrackId: id }),
        toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),
        toggleWaveforms: () => set((s) => ({ showWaveforms: !s.showWaveforms })),
        toggleThumbnails: () => set((s) => ({ showThumbnails: !s.showThumbnails })),
        setCanvasZoom: (zoom) => set({ canvasZoom: Math.max(0.1, Math.min(4, zoom)) }),
        setLeftPanelWidth: (width) => set({ leftPanelWidth: Math.max(200, Math.min(500, width)) }),
        setRightPanelWidth: (width) => set({ rightPanelWidth: Math.max(240, Math.min(500, width)) }),
        setTimelineHeight: (height) => set({ timelineHeight: Math.max(120, Math.min(600, height)) }),
        setLeftPanelTab: (tab) => set({ leftPanelTab: tab }),
        toggleLeftPanel: () => set((s) => ({ isLeftPanelOpen: !s.isLeftPanelOpen })),
        toggleRightPanel: () => set((s) => ({ isRightPanelOpen: !s.isRightPanelOpen })),
        addMarker: (marker) => set((s) => ({
          markers: [...s.markers, { ...marker, id: crypto.randomUUID() }]
            .sort((a, b) => a.time - b.time)
        })),
        removeMarker: (id) => set((s) => ({ markers: s.markers.filter(m => m.id !== id) })),
        updateMarker: (id, updates) => set((s) => ({
          markers: s.markers.map(m => m.id === id ? { ...m, ...updates } : m)
        })),
      }),
      { name: 'editor-ui-state', partialize: (s) => ({
        leftPanelWidth: s.leftPanelWidth,
        rightPanelWidth: s.rightPanelWidth,
        timelineHeight: s.timelineHeight,
        snapEnabled: s.snapEnabled,
        showWaveforms: s.showWaveforms,
        showThumbnails: s.showThumbnails,
      })}
    )
  )
)
