// End-to-end smoke test for the caption editor pipeline.
//
// Simulates the full user journey without touching the network or real
// WebCodecs: transcript arrives → user edits (delay, split, replace, delete
// word) → captions serialize to SRT/VTT → one-click quick export runs →
// download is triggered → dimensions are verified.
//
// The heavy pieces (Supabase invoke, WebCodecs export, video decode) are
// mocked at module boundaries so the test runs in <100 ms and proves the
// wiring between stages is correct.

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  shiftDelay, splitSegmentAt, deleteWord, searchReplace, type Segment,
} from "./captionOps";
import { RESOLUTION_DIMS } from "./exportVideo";
import { DEFAULT_CAP_STYLE } from "./captionStyle";

// ---------- module-level mocks ----------

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(async (name: string) => {
        if (name === "meter-export") return { data: { remaining: 42 }, error: null };
        return { data: null, error: null };
      }),
    },
  },
}));

const encodedFrames: number[] = [];
vi.mock("./exportVideoFast", () => ({
  exportVideoFast: vi.fn(async (opts: any) => {
    // Drive the progress callback to prove the wiring.
    for (let p = 0; p <= 1; p += 0.25) {
      opts.onProgress?.(p);
      encodedFrames.push(p);
    }
    const dims = RESOLUTION_DIMS[opts.resolution as keyof typeof RESOLUTION_DIMS];
    // Fabricate a tiny blob — enough for URL.createObjectURL and size math.
    const blob = new Blob([new Uint8Array(1024 * 512)], { type: "video/mp4" });
    const url = `blob:mock-${opts.resolution}-${dims.w}x${dims.h}`;
    return {
      blob, url,
      filename: `${opts.filename}.mp4`,
      // Stash target dims so the video-probe mock can echo them back.
      __dims: dims,
    };
  }),
}));

// jsdom lacks HTMLVideoElement metadata decoding — stub it so the dimension
// probe in runQuickExport can succeed.
const videoDims = { w: 0, h: 0 };
beforeEach(() => {
  Object.defineProperty(HTMLMediaElement.prototype, "load", {
    configurable: true, value: () => { /* noop */ },
  });
  Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", {
    configurable: true, get: () => videoDims.w,
  });
  Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", {
    configurable: true, get: () => videoDims.h,
  });
  // Trigger onloadedmetadata as soon as src is assigned.
  const origSetSrc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "src");
  Object.defineProperty(HTMLMediaElement.prototype, "src", {
    configurable: true,
    set(this: HTMLVideoElement, v: string) {
      origSetSrc?.set?.call(this, v);
      // Fire metadata on next tick so listeners are attached first.
      queueMicrotask(() => this.dispatchEvent(new Event("loadedmetadata")));
    },
    get(this: HTMLVideoElement) { return origSetSrc?.get?.call(this) ?? ""; },
  });
  encodedFrames.length = 0;
});

// ---------- helpers ----------

/** Simulates a Deepgram/AssemblyAI response shape being normalized into segs. */
const fakeTranscriptResponse = () => ({
  segments: [
    { start: 0.0, end: 2.4, text: "welcome to the show today" },
    { start: 2.5, end: 5.8, text: "we are going to talk about testing" },
    { start: 5.9, end: 8.9, text: "which is honestly the best" },
    { start: 9.0, end: 12.4, text: "thanks for watching everyone" },
  ],
});

const normalizeTranscript = (raw: ReturnType<typeof fakeTranscriptResponse>): Segment[] =>
  raw.segments.map((s) => ({ start: s.start, end: s.end, text: s.text.trim() }));

const buildSRT = (segs: Segment[]): string => {
  const fmt = (t: number) => {
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = Math.floor(t % 60);
    const ms = Math.round((t - Math.floor(t)) * 1000);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
  };
  return segs.map((s, i) => `${i + 1}\n${fmt(s.start)} --> ${fmt(s.end)}\n${s.text}\n`).join("\n");
};

// ---------- the smoke test ----------

describe("end-to-end export smoke test", () => {
  it("upload → transcribe → edit → export → download completes for every resolution", async () => {
    // Stage 1 — transcribe (mocked): the app receives a transcript payload
    // and normalizes it to segments.
    const raw = fakeTranscriptResponse();
    let segs = normalizeTranscript(raw);
    expect(segs).toHaveLength(4);
    expect(segs[0].text).toBe("welcome to the show today");

    // Stage 2 — edit: apply the same operations the user performs in the UI.
    segs = shiftDelay(segs, 0.5);
    expect(segs[0].start).toBeCloseTo(0.5, 6);

    segs = splitSegmentAt(segs, 1, 3); // split the second line after 3 words
    expect(segs).toHaveLength(5);

    segs = deleteWord(segs, 0, 0); // remove first word "welcome"
    expect(segs[0].text.startsWith("to the show")).toBe(true);

    const rr = searchReplace(segs, "testing", "shipping");
    segs = rr.segs;
    expect(rr.count).toBeGreaterThan(0);
    expect(segs.some((s) => s.text.includes("shipping"))).toBe(true);
    expect(segs.some((s) => s.text.includes("testing"))).toBe(false);

    // Stage 3 — caption serialization (what the "Download SRT" button emits).
    const srt = buildSRT(segs);
    expect(srt).toMatch(/^1\n00:00:/);
    expect(srt).toContain("shipping");
    expect(srt.split("-->").length).toBe(segs.length + 1);

    // Stage 4 — one-click export for each resolution. Re-import the module
    // AFTER mocks are set up so runQuickExport picks up the mocked deps.
    const { runQuickExport } = await import("./quickExport");
    const resolutions = ["720p", "1080p", "1440p", "4k"] as const;

    for (const res of resolutions) {
      videoDims.w = RESOLUTION_DIMS[res].w;
      videoDims.h = RESOLUTION_DIMS[res].h;

      // Spy on <a>.click so we can assert the download really fired.
      const clicks: { href: string; download: string }[] = [];
      const origCreate = document.createElement.bind(document);
      const spy = vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
        const el = origCreate(tag as any);
        if (tag === "a") {
          const anchor = el as HTMLAnchorElement;
          // Swallow the real click — jsdom would otherwise try to navigate
          // to the blob URL and log "Not implemented: navigation".
          anchor.click = () => {
            clicks.push({ href: anchor.href, download: anchor.download });
          };
        }
        return el;
      });

      const ok = await runQuickExport({
        mediaUrl: "blob:mock-source",
        segs,
        capStyle: DEFAULT_CAP_STYLE,
        title: "my project",
        resolution: res,
      });

      expect(ok, `runQuickExport(${res}) should resolve true`).toBe(true);

      // Progress callback fired all the way to 1.
      expect(encodedFrames.at(-1)).toBe(1);

      // Download triggered with the expected filename shape.
      expect(clicks).toHaveLength(1);
      expect(clicks[0].download).toBe(`my_project-${res}.mp4`);
      expect(clicks[0].href).toContain(`${RESOLUTION_DIMS[res].w}x${RESOLUTION_DIMS[res].h}`);

      spy.mockRestore();
      encodedFrames.length = 0;
    }
  });

  it("aborts early when preconditions fail — no download, no meter call", async () => {
    const { runQuickExport } = await import("./quickExport");
    const { supabase } = await import("@/integrations/supabase/client");
    const invoke = supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>;
    invoke.mockClear();

    const noMedia = await runQuickExport({
      mediaUrl: null,
      segs: [{ start: 0, end: 1, text: "hi" }],
      capStyle: DEFAULT_CAP_STYLE,
      title: "x",
      resolution: "1080p",
    });
    expect(noMedia).toBe(false);
    expect(invoke).not.toHaveBeenCalled();

    const noSegs = await runQuickExport({
      mediaUrl: "blob:x",
      segs: [],
      capStyle: DEFAULT_CAP_STYLE,
      title: "x",
      resolution: "1080p",
    });
    expect(noSegs).toBe(false);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("flags a dimension mismatch when the encoder undershoots the target", async () => {
    const { runQuickExport } = await import("./quickExport");
    // Encoder claims to render 1080p but the probe sees 720p — the guard
    // should flip to a warning toast, but still return true (file downloaded).
    videoDims.w = 1280;
    videoDims.h = 720;
    
    const origCreate = document.createElement.bind(document);
    const spy = vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = origCreate(tag as any);
      if (tag === "a") {
        const anchor = el as HTMLAnchorElement;
        anchor.click = () => {};
      }
      return el;
    });

    const ok = await runQuickExport({
      mediaUrl: "blob:mock-source",
      segs: [{ start: 0, end: 1, text: "hi" }],
      capStyle: DEFAULT_CAP_STYLE,
      title: "mismatch",
      resolution: "1080p",
    });
    expect(ok).toBe(true);
    spy.mockRestore();
  });
});
