// WebAudio engine that mixes background music tracks in sync with the main video.
// Also exposes a MediaStreamAudioDestinationNode for export (MediaRecorder).

import type { MusicState, MusicTrack } from "./musicStore";

type Handle = {
  audio: HTMLAudioElement;
  source: MediaElementAudioSourceNode;
  gain: GainNode;
  track: MusicTrack;
};

export class MusicEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private duckGain: GainNode | null = null;
  private videoSource: MediaStreamAudioSourceNode | null = null;
  private videoEl: HTMLVideoElement | null = null;
  private videoStream: MediaStream | null = null;
  private handles = new Map<string, Handle>();
  private state: MusicState | null = null;
  private raf = 0;
  private analyzer: AnalyserNode | null = null;
  private analyzerBuf: Uint8Array<ArrayBuffer> | null = null;
  private exportDest: MediaStreamAudioDestinationNode | null = null;
  private removeResumeListeners: (() => void) | null = null;

  private resumeContext = () => {
    const ctx = this.ctx;
    if (!ctx) return;
    if (ctx.state === "running") {
      this.removeResumeListeners?.();
      return;
    }
    void ctx.resume()
      .then(() => {
        if (ctx.state === "running") this.removeResumeListeners?.();
      })
      .catch(() => {
        // Browser may reject until the next real user gesture; keep listeners active.
      });
  };

  attach(video: HTMLVideoElement) {
    if (this.videoEl === video) return;
    this.detach();
    this.videoEl = video;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.duckGain = this.ctx.createGain();
      this.duckGain.gain.value = 1;
      this.masterGain.connect(this.ctx.destination);

      // Never use createMediaElementSource(video) for preview playback: once a
      // media element is routed through WebAudio, a suspended/closed context can
      // make the editor video permanently silent. captureStream lets us inspect
      // and export the video's audio without stealing native playback audio.
      const capture = (video as any).captureStream || (video as any).mozCaptureStream;
      if (typeof capture === "function") {
        this.videoStream = capture.call(video) as MediaStream;
        if (this.videoStream.getAudioTracks().length > 0) {
          this.videoSource = this.ctx.createMediaStreamSource(this.videoStream);
          this.analyzer = this.ctx.createAnalyser();
          this.analyzer.fftSize = 512;
          this.analyzerBuf = new Uint8Array(new ArrayBuffer(this.analyzer.frequencyBinCount));
          this.videoSource.connect(this.analyzer);
        }
      }

      // Once a media element is routed through WebAudio, a suspended AudioContext
      // makes the original video sound silent. Capture-phase listeners run before
      // editor buttons call stopPropagation(), so any play/click/touch gesture
      // reliably unlocks the video voice and the music mixer.
      this.removeResumeListeners?.();
      const resume = this.resumeContext;
      window.addEventListener("pointerdown", resume, { capture: true, passive: true });
      window.addEventListener("click", resume, { capture: true, passive: true });
      window.addEventListener("touchstart", resume, { capture: true, passive: true });
      window.addEventListener("keydown", resume, true);
      video.addEventListener("play", resume);
      video.addEventListener("volumechange", resume);
      this.removeResumeListeners = () => {
        window.removeEventListener("pointerdown", resume, true);
        window.removeEventListener("click", resume, true);
        window.removeEventListener("touchstart", resume, true);
        window.removeEventListener("keydown", resume, true);
        video.removeEventListener("play", resume);
        video.removeEventListener("volumechange", resume);
        this.removeResumeListeners = null;
      };

      this.loop();
    } catch (e) {
      console.warn("MusicEngine attach failed", e);
    }
  }

  detach() {
    cancelAnimationFrame(this.raf);
    this.removeResumeListeners?.();
    this.handles.forEach((h) => {
      try {
        h.audio.pause();
        h.source.disconnect();
        h.gain.disconnect();
      } catch {}
    });
    this.handles.clear();
    try { this.videoSource?.disconnect(); } catch {}
    try { this.analyzer?.disconnect(); } catch {}
    try { this.masterGain?.disconnect(); } catch {}
    try { this.duckGain?.disconnect(); } catch {}
    try { this.ctx?.close(); } catch {}
    this.videoEl = null;
    this.videoStream = null;
    this.ctx = null;
    this.videoSource = null;
    this.masterGain = null;
    this.duckGain = null;
    this.analyzer = null;
    this.exportDest = null;
  }

  setState(state: MusicState) {
    this.state = state;
    if (!this.ctx || !this.masterGain) return;
    this.masterGain.gain.value = state.masterVolume;

    // Reconcile handles with tracks
    const seen = new Set<string>();
    for (const t of state.tracks) {
      seen.add(t.id);
      let h = this.handles.get(t.id);
      if (!h || h.track.src !== t.src) {
        if (h) {
          try { h.audio.pause(); h.source.disconnect(); h.gain.disconnect(); } catch {}
        }
        try {
          const audio = new Audio();
          audio.crossOrigin = "anonymous";
          audio.src = t.src;
          audio.preload = "auto";
          audio.loop = false; // manual looping
          const source = this.ctx.createMediaElementSource(audio);
          const gain = this.ctx.createGain();
          gain.gain.value = 0;
          source.connect(gain);
          gain.connect(this.masterGain);
          if (this.exportDest) gain.connect(this.exportDest);
          h = { audio, source, gain, track: t };
          this.handles.set(t.id, h);
        } catch (e) {
          console.warn("music track load failed", t.name, e);
          continue;
        }
      } else {
        h.track = t;
      }
    }
    // Remove tracks no longer present
    for (const [id, h] of this.handles) {
      if (!seen.has(id)) {
        try { h.audio.pause(); h.source.disconnect(); h.gain.disconnect(); } catch {}
        this.handles.delete(id);
      }
    }
  }

  private loop = () => {
    this.tick();
    this.raf = requestAnimationFrame(this.loop);
  };

  private tick() {
    if (!this.videoEl || !this.ctx || !this.state) return;
    const vt = this.videoEl.currentTime;
    const playing = !this.videoEl.paused && !this.videoEl.ended;

    // Speech detection (RMS on analyzer)
    let speechActive = false;
    if (this.analyzer && this.analyzerBuf) {
      this.analyzer.getByteTimeDomainData(this.analyzerBuf);
      let sum = 0;
      for (let i = 0; i < this.analyzerBuf.length; i++) {
        const v = (this.analyzerBuf[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / this.analyzerBuf.length);
      speechActive = rms > 0.04;
    }

    for (const h of this.handles.values()) {
      const t = h.track;
      const trackDur = h.audio.duration || 0;
      const localStart = t.startAt;
      const trimEnd = t.trimEnd ?? trackDur;
      const playableLen = Math.max(0, trimEnd - t.offset);
      const rel = vt - localStart;
      const inWindow = rel >= 0 && (t.loop || rel <= playableLen);
      const shouldPlay = playing && inWindow && !t.muted && playableLen > 0;

      if (shouldPlay) {
        const posInTrack = t.offset + (t.loop ? ((rel % Math.max(0.1, playableLen))) : rel);
        if (Math.abs(h.audio.currentTime - posInTrack) > 0.35) {
          try { h.audio.currentTime = Math.min(posInTrack, Math.max(0, trackDur - 0.05)); } catch {}
        }
        if (h.audio.paused) { h.audio.play().catch(() => {}); }

        // Volume envelope: fade in / fade out
        let env = 1;
        if (t.fadeIn > 0 && rel < t.fadeIn) env *= Math.max(0, rel / t.fadeIn);
        if (!t.loop && t.fadeOut > 0 && rel > playableLen - t.fadeOut) {
          env *= Math.max(0, (playableLen - rel) / t.fadeOut);
        }
        // Ducking
        const duck = t.duck && speechActive ? (1 - (this.state.duckAmount ?? 0.65)) : 1;
        const target = t.volume * env * duck;
        // Smooth
        h.gain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
      } else {
        if (!h.audio.paused) { try { h.audio.pause(); } catch {} }
        h.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
      }
    }
  }

  /** For export: returns a MediaStream containing all mixed music.
   * Combine with videoEl.captureStream().getVideoTracks() to record. */
  getExportAudioStream(includeVideoAudio = true): MediaStream | null {
    if (!this.ctx) return null;
    if (!this.exportDest) {
      this.exportDest = this.ctx.createMediaStreamDestination();
      // Re-wire existing tracks to also feed the export destination
      for (const h of this.handles.values()) {
        try { h.gain.connect(this.exportDest); } catch {}
      }
      if (includeVideoAudio && this.videoSource) {
        try { this.videoSource.connect(this.exportDest); } catch {}
      }
    }
    return this.exportDest.stream;
  }
}

export const musicEngine = new MusicEngine();
