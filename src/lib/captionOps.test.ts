import { describe, it, expect } from "vitest";
import {
  shiftDelay,
  removeGaps,
  removeEmojis,
  removePunctuation,
  splitSegmentAt,
  deleteSegment,
  deleteWord,
  moveWord,
  searchReplace,
  editSegmentTime,
  type Segment,
} from "./captionOps";

const seg = (start: number, end: number, text: string, extra: Partial<Segment> = {}): Segment => ({
  start, end, text, ...extra,
});

const base: Segment[] = [
  seg(0.0, 1.0, "Hello there friend"),
  seg(1.2, 2.0, "How are you"),
  seg(2.5, 4.0, "I am fine, thanks!"),
];

describe("captionOps — smoke suite", () => {
  describe("shiftDelay (Caption Delay slider)", () => {
    it("shifts every segment by +1s", () => {
      const out = shiftDelay(base, 1);
      expect(out[0]).toMatchObject({ start: 1.0, end: 2.0 });
      expect(out[2]).toMatchObject({ start: 3.5, end: 5.0 });
    });
    it("clamps at 0 when going negative past zero", () => {
      const out = shiftDelay(base, -5);
      expect(out.every((s) => s.start >= 0 && s.end >= 0)).toBe(true);
    });
    it("does not mutate input", () => {
      const snap = JSON.stringify(base);
      shiftDelay(base, 2);
      expect(JSON.stringify(base)).toBe(snap);
    });
  });

  describe("removeGaps", () => {
    it("snaps each next segment to the previous end", () => {
      const out = removeGaps(base);
      expect(out[1].start).toBe(out[0].end);
      expect(out[2].start).toBe(out[1].end);
    });
  });

  describe("removeEmojis", () => {
    it("strips emojis but keeps text", () => {
      const out = removeEmojis([seg(0, 1, "Hello 👋 world 🌍")]);
      expect(out[0].text).toBe("Hello world");
    });
  });

  describe("removePunctuation", () => {
    it("removes periods, commas, quotes and brackets", () => {
      const out = removePunctuation([seg(0, 1, 'Hello, "world"! (yes)')]);
      expect(out[0].text).toBe("Hello world yes");
    });
  });

  describe("splitSegmentAt (Split / Split here)", () => {
    it("splits into two segments at word index", () => {
      const out = splitSegmentAt(base, 0, 1);
      expect(out).toHaveLength(4);
      expect(out[0].text).toBe("Hello");
      expect(out[1].text).toBe("there friend");
      expect(out[0].end).toBe(out[1].start);
    });
    it("uses per-word timings when available for frame-accurate cuts", () => {
      const withWords: Segment[] = [{
        start: 0, end: 3, text: "one two three",
        words: [
          { text: "one",   start: 0.0, end: 0.8 },
          { text: "two",   start: 1.0, end: 1.8 },
          { text: "three", start: 2.0, end: 2.9 },
        ],
      }];
      const out = splitSegmentAt(withWords, 0, 2);
      // cut should be between "two".end (1.8) and "three".start (2.0) → 1.9
      expect(out[0].end).toBeCloseTo(1.9, 5);
      expect(out[1].start).toBeCloseTo(1.9, 5);
      expect(out[0].words?.map((w) => w.text)).toEqual(["one", "two"]);
      expect(out[1].words?.map((w) => w.text)).toEqual(["three"]);
    });
    it("no-ops when fewer than 2 words", () => {
      const only = [seg(0, 1, "Hello")];
      expect(splitSegmentAt(only, 0)).toEqual(only);
    });
    it("midpoint split when wordIdx omitted", () => {
      const out = splitSegmentAt(base, 0);
      expect(out[0].text).toBe("Hello");
      expect(out[1].text).toBe("there friend");
    });
  });

  describe("deleteSegment / deleteWord", () => {
    it("deletes a whole segment", () => {
      const out = deleteSegment(base, 1);
      expect(out).toHaveLength(2);
      expect(out[1].text).toBe("I am fine, thanks!");
    });
    it("deletes a single word", () => {
      const out = deleteWord(base, 0, 1);
      expect(out[0].text).toBe("Hello friend");
    });
    it("drops the row when the last word is deleted", () => {
      const one = [seg(0, 1, "Only")];
      expect(deleteWord(one, 0, 0)).toEqual([]);
    });
  });

  describe("moveWord (Previous Line / Next Line)", () => {
    it("moves a word to the next segment (prepend)", () => {
      const out = moveWord(base, 0, 2, +1); // move "friend" to seg 1
      expect(out[0].text).toBe("Hello there");
      expect(out[1].text).toBe("friend How are you");
    });
    it("moves a word to the previous segment (append)", () => {
      const out = moveWord(base, 1, 0, -1); // move "How" back to seg 0
      expect(out[0].text).toBe("Hello there friend How");
      expect(out[1].text).toBe("are you");
    });
    it("no-ops at boundaries", () => {
      expect(moveWord(base, 0, 0, -1)).toEqual(base);
      expect(moveWord(base, base.length - 1, 0, +1)).toEqual(base);
    });
  });

  describe("searchReplace", () => {
    it("case-insensitive global replace", () => {
      const { segs, count } = searchReplace(base, "you", "YOU");
      expect(count).toBe(1);
      expect(segs[1].text).toBe("How are YOU");
    });
    it("case-sensitive skip", () => {
      const { count } = searchReplace(base, "hello", "HI", { caseSensitive: true });
      expect(count).toBe(0);
    });
    it("whole-word only", () => {
      const s = [seg(0, 1, "cat cathedral scatter")];
      const { segs, count } = searchReplace(s, "cat", "DOG", { wholeWord: true });
      expect(count).toBe(1);
      expect(segs[0].text).toBe("DOG cathedral scatter");
    });
    it("escapes regex metacharacters in query", () => {
      const s = [seg(0, 1, "price is $5.00 (final)")];
      const { count } = searchReplace(s, "$5.00", "$4");
      expect(count).toBe(1);
    });
  });

  describe("editSegmentTime (timeline word-block drag)", () => {
    it("clamps against previous segment end", () => {
      const out = editSegmentTime(base, 1, { start: 0.5 }, 10);
      expect(out[1].start).toBeGreaterThanOrEqual(base[0].end);
    });
    it("clamps against next segment start", () => {
      const out = editSegmentTime(base, 1, { end: 3.0 }, 10);
      expect(out[1].end).toBeLessThanOrEqual(base[2].start);
    });
    it("enforces minimum duration", () => {
      const out = editSegmentTime(base, 0, { end: 0.05 }, 10);
      expect(out[0].end - out[0].start).toBeGreaterThanOrEqual(0.2 - 1e-9);
    });
    it("clamps end against total duration", () => {
      const out = editSegmentTime(base, 2, { end: 999 }, 5);
      expect(out[2].end).toBeLessThanOrEqual(5);
    });
  });

  describe("regression — full workflow", () => {
    it("delay → split → replace pipeline preserves invariants", () => {
      let segs = shiftDelay(base, 0.5);
      segs = splitSegmentAt(segs, 0, 1);
      const { segs: next, count } = searchReplace(segs, "friend", "buddy");
      expect(count).toBe(1);
      // starts stay monotonic
      for (let i = 1; i < next.length; i++) {
        expect(next[i].start).toBeGreaterThanOrEqual(next[i - 1].start);
      }
    });
  });
});
