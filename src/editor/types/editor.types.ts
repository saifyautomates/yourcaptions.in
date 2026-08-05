export type Tool = 'select' | 'razor' | 'hand' | 'ripple' | 'slip' | 'slide' | 'zoom'
export type Workspace = 'edit' | 'color' | 'audio' | 'captions'
export type TrackType = 'video' | 'audio' | 'caption' | 'overlay' | 'sfx' | 'music'
export type ClipType = 'video' | 'audio' | 'image' | 'caption' | 'text' | 'shape' | 'effect'
export type TransitionType =
  | 'cut' | 'cross_dissolve' | 'dip_black' | 'dip_white'
  | 'wipe_left' | 'wipe_right' | 'wipe_up' | 'wipe_down'
  | 'slide_left' | 'slide_right' | 'zoom_in' | 'zoom_out'
  | 'spin' | 'glitch' | 'film_burn' | 'light_leak'
export type BlendMode =
  | 'normal' | 'multiply' | 'screen' | 'overlay'
  | 'soft_light' | 'hard_light' | 'difference' | 'exclusion'

export interface EditorProject {
  id: string
  userId: string
  name: string
  duration: number
  width: number
  height: number
  fps: number
  sampleRate: number
  colorSpace: 'srgb' | 'rec709' | 'rec2020'
  backgroundColor: string
  createdAt: string
  updatedAt: string
  version: number
}

export interface Track {
  id: string
  projectId: string
  name: string
  type: TrackType
  order: number
  height: number
  muted: boolean
  solo: boolean
  locked: boolean
  visible: boolean
  color: string
}

export interface Clip {
  id: string
  trackId: string
  mediaId: string | null
  type: ClipType
  startTime: number
  duration: number
  trimIn: number
  trimOut: number
  speed: number
  reversed: boolean
  opacity: number
  blendMode: BlendMode
  transform: Transform
  colorGrade: ColorGrade
  effects: Effect[]
  audioSettings: AudioSettings
  textSettings: TextSettings | null
  captionData: CaptionSegment[] | null
  keyframes: Keyframe[]
  linkedClipId: string | null
  transitionIn: TransitionConfig | null
  transitionOut: TransitionConfig | null
}

export interface Transform {
  x: number
  y: number
  scaleX: number
  scaleY: number
  rotation: number
  anchorX: number
  anchorY: number
  flipH: boolean
  flipV: boolean
}

export interface ColorGrade {
  exposure: number
  contrast: number
  highlights: number
  shadows: number
  whites: number
  blacks: number
  temperature: number
  tint: number
  saturation: number
  vibrance: number
  hue: number
  vignette: number
  vignetteFeather: number
  sharpness: number
  noiseReduction: number
  lift: ColorWheel
  gamma: ColorWheel
  gain: ColorWheel
  curves: CurveData
  hsl: HSLData
  lutId: string | null
  lutIntensity: number
}

export interface ColorWheel {
  r: number
  g: number
  b: number
  master: number
}

export interface CurveData {
  luma: CurvePoint[]
  red: CurvePoint[]
  green: CurvePoint[]
  blue: CurvePoint[]
}

export interface CurvePoint {
  x: number
  y: number
}

export interface HSLData {
  red: HSLRange
  orange: HSLRange
  yellow: HSLRange
  green: HSLRange
  aqua: HSLRange
  blue: HSLRange
  purple: HSLRange
  magenta: HSLRange
}

export interface HSLRange {
  hue: number
  saturation: number
  luminance: number
}

export interface Effect {
  id: string
  type: string
  enabled: boolean
  params: Record<string, number | string | boolean>
  order: number
}

export interface AudioSettings {
  volume: number
  pan: number
  fadeIn: number
  fadeOut: number
  fadeInCurve: 'linear' | 'ease' | 'logarithmic'
  fadeOutCurve: 'linear' | 'ease' | 'logarithmic'
  pitch: number
  muted: boolean
  eq: EQSettings
  compressor: CompressorSettings
  noiseReduction: boolean
  normalized: boolean
}

export interface EQSettings {
  subBass: number
  bass: number
  lowMid: number
  mid: number
  highMid: number
  presence: number
  brilliance: number
}

export interface CompressorSettings {
  threshold: number
  ratio: number
  attack: number
  release: number
  makeupGain: number
  enabled: boolean
}

export interface TextSettings {
  content: string
  fontFamily: string
  fontSize: number
  fontWeight: number
  fontStyle: 'normal' | 'italic'
  color: string
  backgroundColor: string
  backgroundOpacity: number
  backgroundRadius: number
  padding: { top: number; right: number; bottom: number; left: number }
  letterSpacing: number
  lineHeight: number
  textAlign: 'left' | 'center' | 'right' | 'justify'
  textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize'
  direction: 'ltr' | 'rtl'
  outlineColor: string
  outlineWidth: number
  shadowColor: string
  shadowX: number
  shadowY: number
  shadowBlur: number
  animationIn: TextAnimation
  animationOut: TextAnimation
}

export interface TextAnimation {
  type: 'none' | 'fade' | 'slide_up' | 'slide_left' | 'typewriter' | 'scale' | 'bounce' | 'blur'
  duration: number
  delay: number
  easing: string
}

export interface CaptionSegment {
  id: string
  start: number
  end: number
  text: string
  words: WordSegment[]
  style: Partial<TextSettings>
}

export interface WordSegment {
  word: string
  start: number
  end: number
  confidence: number
  highlighted: boolean
  highlightColor: string
}

export interface Keyframe {
  id: string
  clipId: string
  property: string
  time: number
  value: number | string
  easing: 'linear' | 'ease_in' | 'ease_out' | 'ease_in_out' | 'bezier'
  bezierHandle?: { x1: number; y1: number; x2: number; y2: number }
}

export interface TransitionConfig {
  type: TransitionType
  duration: number
  params: Record<string, number>
}

export interface Marker {
  id: string
  time: number
  label: string
  color: string
  type: 'chapter' | 'comment' | 'custom'
}

export interface MediaItem {
  id: string
  projectId: string
  userId: string
  name: string
  type: 'video' | 'audio' | 'image'
  url: string
  thumbnailUrl: string
  duration: number
  width: number
  height: number
  fileSize: number
  mimeType: string
  createdAt: string
}

export interface ExportSettings {
  format: 'mp4' | 'webm' | 'mov' | 'gif' | 'mp3' | 'wav'
  resolution: '4k' | '1080p' | '720p' | '480p' | '360p' | 'source' | 'custom'
  customWidth?: number
  customHeight?: number
  fps: 23.976 | 24 | 25 | 29.97 | 30 | 50 | 59.94 | 60
  videoBitrate: 'auto' | number
  audioBitrate: 128 | 192 | 256 | 320
  audioChannels: 'mono' | 'stereo'
  colorSpace: 'srgb' | 'rec709'
  burnCaptions: boolean
  captionLanguage: string
  watermark: boolean
  watermarkUrl?: string
  watermarkPosition: 'top_left' | 'top_right' | 'bottom_left' | 'bottom_right' | 'center'
  watermarkOpacity: number
  exportRange: 'full' | 'inout' | 'selected'
  includeChapters: boolean
  crf: number
  preset: 'ultrafast' | 'fast' | 'medium' | 'slow'
}

export interface RenderJob {
  id: string
  projectId: string
  userId: string
  settings: ExportSettings
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  progress: number
  outputUrl: string | null
  error: string | null
  creditsUsed: number
  createdAt: string
  completedAt: string | null
}

export const DEFAULT_COLOR_GRADE: ColorGrade = {
  exposure: 0, contrast: 0, highlights: 0, shadows: 0,
  whites: 0, blacks: 0, temperature: 0, tint: 0,
  saturation: 0, vibrance: 0, hue: 0,
  vignette: 0, vignetteFeather: 0.5,
  sharpness: 0, noiseReduction: 0,
  lift: { r: 0, g: 0, b: 0, master: 0 },
  gamma: { r: 1, g: 1, b: 1, master: 1 },
  gain: { r: 1, g: 1, b: 1, master: 1 },
  curves: {
    luma: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    red: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    green: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    blue: [{ x: 0, y: 0 }, { x: 1, y: 1 }]
  },
  hsl: {
    red: { hue: 0, saturation: 0, luminance: 0 },
    orange: { hue: 0, saturation: 0, luminance: 0 },
    yellow: { hue: 0, saturation: 0, luminance: 0 },
    green: { hue: 0, saturation: 0, luminance: 0 },
    aqua: { hue: 0, saturation: 0, luminance: 0 },
    blue: { hue: 0, saturation: 0, luminance: 0 },
    purple: { hue: 0, saturation: 0, luminance: 0 },
    magenta: { hue: 0, saturation: 0, luminance: 0 }
  },
  lutId: null,
  lutIntensity: 1
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  volume: 1, pan: 0, fadeIn: 0, fadeOut: 0,
  fadeInCurve: 'linear', fadeOutCurve: 'linear',
  pitch: 0, muted: false,
  eq: { subBass: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, presence: 0, brilliance: 0 },
  compressor: { threshold: -24, ratio: 4, attack: 3, release: 250, makeupGain: 0, enabled: false },
  noiseReduction: false, normalized: false
}

export const DEFAULT_TRANSFORM: Transform = {
  x: 0, y: 0, scaleX: 1, scaleY: 1,
  rotation: 0, anchorX: 0.5, anchorY: 0.5,
  flipH: false, flipV: false
}
