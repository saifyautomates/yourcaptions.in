import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  enhanceAudioBuffer,
  isAudioEnhanced,
  setAudioEnhanced,
  LiveAudioEnhancer,
  AudioEnhancePreset,
} from "@/lib/audioEnhancer";

describe("Audio Enhancement Engine", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("Storage and Project State", () => {
    it("returns false by default when no audio enhancement is saved", () => {
      expect(isAudioEnhanced("proj-123")).toBe(false);
      expect(isAudioEnhanced(null)).toBe(false);
    });

    it("correctly sets and retrieves audio enhancement state", () => {
      setAudioEnhanced("proj-123", true);
      expect(isAudioEnhanced("proj-123")).toBe(true);

      setAudioEnhanced("proj-123", false);
      expect(isAudioEnhanced("proj-123")).toBe(false);
    });

    it("reads audioClean from prepare:projectId localStorage key", () => {
      localStorage.setItem(
        "prepare:proj-456",
        JSON.stringify({ script: "devanagari", audioClean: true })
      );
      expect(isAudioEnhanced("proj-456")).toBe(true);
    });
  });

  describe("Offline Audio DSP", () => {
    it("safely handles enhanceAudioBuffer without throwing", async () => {
      // Mock minimal AudioBuffer for node/vitest environment
      const mockBuffer = {
        numberOfChannels: 2,
        length: 44100,
        sampleRate: 44100,
        duration: 1,
        getChannelData: vi.fn(() => new Float32Array(44100)),
      } as unknown as AudioBuffer;

      const out = await enhanceAudioBuffer(mockBuffer, "studio");
      expect(out).toBeDefined();
    });

    it("supports all studio presets without configuration errors", async () => {
      const presets: AudioEnhancePreset[] = ["studio", "podcast", "voice_clarity", "heavy_denoise"];
      const mockBuffer = {
        numberOfChannels: 1,
        length: 22050,
        sampleRate: 44100,
        getChannelData: vi.fn(() => new Float32Array(22050)),
      } as unknown as AudioBuffer;

      for (const p of presets) {
        const res = await enhanceAudioBuffer(mockBuffer, p);
        expect(res).toBeDefined();
      }
    });
  });

  describe("LiveAudioEnhancer", () => {
    it("instantiates cleanly without attached video", () => {
      const enhancer = new LiveAudioEnhancer();
      expect(enhancer.isEnabled()).toBe(false);
      enhancer.setEnabled(true);
      expect(enhancer.isEnabled()).toBe(true);
      enhancer.detach();
    });

    it("attaches to mock video element safely", () => {
      const mockVideo = {
        captureStream: vi.fn(() => ({
          getAudioTracks: () => [{}],
        })),
      } as unknown as HTMLMediaElement;

      const enhancer = new LiveAudioEnhancer(mockVideo);
      expect(enhancer).toBeDefined();
      enhancer.detach();
    });
  });
});
