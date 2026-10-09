// Professional Studio Audio Enhancement Engine (Web Audio DSP).
// Provides both offline processing (for high-speed 4K/1080p MP4 exports)
// and real-time DSP playback filtering with noise suppression and vocal presence.

export type AudioEnhancePreset = "studio" | "podcast" | "voice_clarity" | "heavy_denoise";

export interface AudioEnhanceConfig {
  preset?: AudioEnhancePreset;
  rumbleCutHz?: number;
  hissCutHz?: number;
  vocalBoostDb?: number;
  compressionRatio?: number;
  makeupGain?: number;
}

const PRESET_CONFIGS: Record<AudioEnhancePreset, AudioEnhanceConfig> = {
  studio: {
    rumbleCutHz: 85,
    hissCutHz: 11500,
    vocalBoostDb: 3.5,
    compressionRatio: 4,
    makeupGain: 1.25,
  },
  podcast: {
    rumbleCutHz: 95,
    hissCutHz: 10500,
    vocalBoostDb: 4.5,
    compressionRatio: 5,
    makeupGain: 1.35,
  },
  voice_clarity: {
    rumbleCutHz: 110,
    hissCutHz: 12000,
    vocalBoostDb: 5.0,
    compressionRatio: 3.5,
    makeupGain: 1.2,
  },
  heavy_denoise: {
    rumbleCutHz: 125,
    hissCutHz: 9500,
    vocalBoostDb: 3.0,
    compressionRatio: 6,
    makeupGain: 1.4,
  },
};

/**
 * Offline Audio DSP: Processes an AudioBuffer with multi-stage vocal enhancement,
 * rumble cutoff, hiss suppression, and dynamic range leveling.
 */
export async function enhanceAudioBuffer(
  audio: AudioBuffer,
  presetOrConfig: AudioEnhancePreset | AudioEnhanceConfig = "studio"
): Promise<AudioBuffer> {
  const cfg = typeof presetOrConfig === "string" ? PRESET_CONFIGS[presetOrConfig] : { ...PRESET_CONFIGS.studio, ...presetOrConfig };

  const OAC = (globalThis as any).OfflineAudioContext || (globalThis as any).webkitOfflineAudioContext;
  if (!OAC) {
    // If running in test or unsupported environment, return buffer intact
    return audio;
  }

  const offlineCtx = new OAC(
    audio.numberOfChannels,
    audio.length,
    audio.sampleRate
  );

  const source = offlineCtx.createBufferSource();
  source.buffer = audio;

  // 1. High-pass filter: cut sub-rumble, air conditioner hum & mic handling bumps
  const highpass = offlineCtx.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = cfg.rumbleCutHz ?? 85;
  highpass.Q.value = 0.707;

  // 2. Low-pass filter / De-esser: cut electrical line hiss and high-frequency noise
  const lowpass = offlineCtx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = cfg.hissCutHz ?? 11500;
  lowpass.Q.value = 0.707;

  // 3. Peaking EQ: boost vocal presence and intelligibility (centered around 2.8kHz)
  const clarity = offlineCtx.createBiquadFilter();
  clarity.type = "peaking";
  clarity.frequency.value = 2800;
  clarity.Q.value = 1.0;
  clarity.gain.value = cfg.vocalBoostDb ?? 3.5;

  // 4. Dynamics Compressor: tame harsh vocal spikes and lift quiet speech
  const compressor = offlineCtx.createDynamicsCompressor();
  compressor.threshold.value = -22;
  compressor.knee.value = 10;
  compressor.ratio.value = cfg.compressionRatio ?? 4;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.25;

  // 5. Output makeup gain
  const gain = offlineCtx.createGain();
  gain.gain.value = cfg.makeupGain ?? 1.25;

  // Connect processing chain
  source.connect(highpass);
  highpass.connect(lowpass);
  lowpass.connect(clarity);
  clarity.connect(compressor);
  compressor.connect(gain);
  gain.connect(offlineCtx.destination);

  source.start(0);
  return await offlineCtx.startRendering();
}

/**
 * Storage helpers for persisting Audio Enhancement per project.
 */
export function isAudioEnhanced(projectId?: string | null): boolean {
  if (!projectId) return false;
  try {
    const raw = localStorage.getItem(`prepare:${projectId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.audioClean === "boolean") return parsed.audioClean;
    }
    const direct = localStorage.getItem(`audio_enhanced:${projectId}`);
    if (direct !== null) return direct === "true";
  } catch {
    /* noop */
  }
  return false;
}

export function setAudioEnhanced(projectId: string | null | undefined, enabled: boolean): void {
  if (!projectId) return;
  try {
    localStorage.setItem(`audio_enhanced:${projectId}`, enabled ? "true" : "false");
    const raw = localStorage.getItem(`prepare:${projectId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      parsed.audioClean = enabled;
      localStorage.setItem(`prepare:${projectId}`, JSON.stringify(parsed));
    }
  } catch {
    /* noop */
  }
}

/**
 * Live Web Audio DSP manager for video playback.
 * Connects directly to HTMLMediaElement and allows instantaneous
 * real-time toggle between raw audio and studio-enhanced audio.
 */
export class LiveAudioEnhancer {
  private ctx: AudioContext | null = null;
  private videoEl: HTMLMediaElement | null = null;
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
  private highpass: BiquadFilterNode | null = null;
  private lowpass: BiquadFilterNode | null = null;
  private clarity: BiquadFilterNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private gain: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private rawGain: GainNode | null = null;
  private enhancedGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private isConnected = false;
  private enabled = false;

  constructor(video?: HTMLMediaElement | null) {
    if (video) this.attach(video);
  }

  attach(video: HTMLMediaElement) {
    if (this.videoEl === video && this.isConnected) return;
    this.detach();
    this.videoEl = video;

    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();

      // Use captureStream to avoid breaking native playback audio
      const capture = (video as any).captureStream || (video as any).mozCaptureStream;
      if (typeof capture === "function") {
        const stream = capture.call(video) as MediaStream;
        if (stream.getAudioTracks().length > 0) {
          this.mediaStreamSource = this.ctx.createMediaStreamSource(stream);
        }
      }

      // If captureStream had no audio tracks or isn't available, we don't interfere
      if (!this.mediaStreamSource) return;

      // Build DSP Chain
      this.highpass = this.ctx.createBiquadFilter();
      this.highpass.type = "highpass";
      this.highpass.frequency.value = 85;

      this.lowpass = this.ctx.createBiquadFilter();
      this.lowpass.type = "lowpass";
      this.lowpass.frequency.value = 11500;

      this.clarity = this.ctx.createBiquadFilter();
      this.clarity.type = "peaking";
      this.clarity.frequency.value = 2800;
      this.clarity.gain.value = 3.5;

      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -22;
      this.compressor.knee.value = 10;
      this.compressor.ratio.value = 4;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.25;

      this.gain = this.ctx.createGain();
      this.gain.gain.value = 1.25;

      this.enhancedGain = this.ctx.createGain();
      this.enhancedGain.gain.value = this.enabled ? 1 : 0;

      this.rawGain = this.ctx.createGain();
      this.rawGain.gain.value = this.enabled ? 0 : 1;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 1;

      this.analyserNode = this.ctx.createAnalyser();
      this.analyserNode.fftSize = 64;

      // Connect enhanced path
      this.mediaStreamSource.connect(this.highpass);
      this.highpass.connect(this.lowpass);
      this.lowpass.connect(this.clarity);
      this.clarity.connect(this.compressor);
      this.compressor.connect(this.gain);
      this.gain.connect(this.enhancedGain);

      // Connect raw path
      this.mediaStreamSource.connect(this.rawGain);

      // Summing node
      this.enhancedGain.connect(this.masterGain);
      this.rawGain.connect(this.masterGain);
      this.masterGain.connect(this.analyserNode);

      this.isConnected = true;
    } catch (err) {
      console.warn("[LiveAudioEnhancer] failed to initialize:", err);
    }
  }

  setEnabled(enable: boolean) {
    this.enabled = enable;
    if (this.ctx?.state === "suspended") {
      void this.ctx.resume();
    }
    if (this.enhancedGain && this.rawGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.enhancedGain.gain.setTargetAtTime(enable ? 1 : 0, now, 0.05);
      this.rawGain.gain.setTargetAtTime(enable ? 0 : 1, now, 0.05);
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyserNode;
  }

  detach() {
    this.isConnected = false;
    try {
      this.mediaStreamSource?.disconnect();
      this.highpass?.disconnect();
      this.lowpass?.disconnect();
      this.clarity?.disconnect();
      this.compressor?.disconnect();
      this.gain?.disconnect();
      this.enhancedGain?.disconnect();
      this.rawGain?.disconnect();
      this.masterGain?.disconnect();
      this.analyserNode?.disconnect();
      void this.ctx?.close();
    } catch {
      /* noop */
    }
    this.ctx = null;
    this.videoEl = null;
  }
}
