import { useEffect, useCallback } from 'react'
import { useEditorStore } from '../store/editorStore'
import { useTimelineStore } from '../store/timelineStore'
import { useHistoryStore } from '../store/historyStore'

export function useKeyboardShortcuts() {
  const editor = useEditorStore()
  const timeline = useTimelineStore()
  const history = useHistoryStore()

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

    const ctrl = e.ctrlKey || e.metaKey
    const shift = e.shiftKey

    switch (e.key) {
      case ' ':
        e.preventDefault()
        editor.setIsPlaying(!editor.isPlaying)
        break
      case 'j':
        editor.setPlaybackSpeed(Math.max(-4, editor.playbackSpeed <= 0 ? editor.playbackSpeed - 1 : -1))
        break
      case 'k':
        editor.setIsPlaying(false)
        editor.setPlaybackSpeed(1)
        break
      case 'l':
        editor.setPlaybackSpeed(Math.min(4, editor.playbackSpeed >= 0 ? editor.playbackSpeed + 1 : 1))
        break
      case 'Home':
        e.preventDefault()
        editor.setCurrentTime(0)
        break
      case 'End':
        e.preventDefault()
        editor.setCurrentTime(timeline.getTotalDuration())
        break
      case 'ArrowLeft':
        e.preventDefault()
        editor.setCurrentTime(editor.currentTime - (shift ? 10 / 30 : 1 / 30))
        break
      case 'ArrowRight':
        e.preventDefault()
        editor.setCurrentTime(editor.currentTime + (shift ? 10 / 30 : 1 / 30))
        break
      case 'i':
        editor.setInPoint(editor.currentTime)
        break
      case 'o':
        editor.setOutPoint(editor.currentTime)
        break
      case 'I':
        editor.setCurrentTime(editor.inPoint || 0)
        break
      case 'O':
        editor.setCurrentTime(editor.outPoint || timeline.getTotalDuration())
        break
      case 'v': editor.setActiveTool('select'); break
      case 'c':
        if (!ctrl) { editor.setActiveTool('razor'); e.preventDefault() }
        break
      case 'h': editor.setActiveTool('hand'); break
      case 'r': if (!ctrl) editor.setActiveTool('ripple'); break
      case 'y': editor.setActiveTool('slip'); break
      case 'u': editor.setActiveTool('slide'); break
      case 'Delete':
      case 'Backspace':
        e.preventDefault()
        if (editor.selectedClipIds.length > 0) {
          if (shift) {
            editor.selectedClipIds.forEach(id => timeline.liftDelete(id))
          } else {
            editor.selectedClipIds.forEach(id => timeline.rippleDelete(id))
          }
          editor.deselectAll()
        }
        break
      case 'm':
        if (!ctrl) editor.addMarker({ time: editor.currentTime, label: 'Marker', color: '#E60000', type: 'custom' })
        break
      case 'M': {
        const nextMarker = editor.markers.find(m => m.time > editor.currentTime + 0.01)
        if (nextMarker) editor.setCurrentTime(nextMarker.time)
        break
      }
      case '[':
        if (!ctrl) {
          editor.selectedClipIds.forEach(id => {
            const clip = timeline.clips.find(c => c.id === id)
            if (clip) timeline.trimClipStart(id, editor.currentTime - clip.startTime)
          })
        }
        break
      case ']':
        if (!ctrl) {
          editor.selectedClipIds.forEach(id => {
            const clip = timeline.clips.find(c => c.id === id)
            if (clip) {
              const remaining = clip.startTime + clip.duration - editor.currentTime
              timeline.trimClipEnd(id, remaining)
            }
          })
        }
        break
      case '+':
      case '=':
        e.preventDefault()
        timeline.zoomIn()
        break
      case '-':
        e.preventDefault()
        timeline.zoomOut()
        break
      case 's':
        if (ctrl) {
          e.preventDefault()
        } else {
          e.preventDefault(); editor.toggleSnap()
        }
        break
      case 'z':
        if (ctrl && shift) { e.preventDefault(); history.redo() }
        else if (ctrl) { e.preventDefault(); history.undo() }
        else { editor.setActiveTool('zoom') }
        break
      case 'a':
        if (ctrl) {
          e.preventDefault()
          timeline.clips.forEach(c => editor.selectClip(c.id, true))
        }
        break
      case 'd':
        if (ctrl) {
          e.preventDefault()
          editor.selectedClipIds.forEach(id => timeline.duplicateClip(id))
        }
        break
      case '1': if (ctrl) { e.preventDefault(); editor.setActiveWorkspace('edit') } break
      case '2': if (ctrl) { e.preventDefault(); editor.setActiveWorkspace('color') } break
      case '3': if (ctrl) { e.preventDefault(); editor.setActiveWorkspace('audio') } break
      case '4': if (ctrl) { e.preventDefault(); editor.setActiveWorkspace('captions') } break
      case 'Tab':
        if (!shift) { e.preventDefault(); editor.toggleLeftPanel() }
        else { e.preventDefault(); editor.toggleRightPanel() }
        break
      case 'f':
        if (!ctrl) editor.setCanvasZoom(editor.canvasZoom === 1 ? 2 : 1)
        break
      case 'Z':
        if (shift) timeline.fitToWindow(800, timeline.getTotalDuration())
        break
      case 'e':
        if (ctrl) e.preventDefault()
        break
    }
  }, [editor, timeline, history])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
