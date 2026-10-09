import { describe, it, expect } from 'vitest';
import { getCaptionForLanguage, INTRO_CAPTIONS } from '@/lib/demoCaptions';
import { LANGUAGES } from '@/components/public/InteractiveLanguageDemo';

describe('Interactive Language Demo Captions', () => {
  it('covers signature Indian regional languages including Nimadi, Malvi, Shekhawati', () => {
    // Nimadi test
    const nimadiNative = getCaptionForLanguage('Nimadi', 'निमाड़ी', 'intro', 'native');
    const nimadiRoman = getCaptionForLanguage('Nimadi', 'निमाड़ी', 'intro', 'roman');
    expect(nimadiNative.text).toContain('स्वागत');
    expect(nimadiNative.text.length).toBeGreaterThan(10);
    expect(nimadiRoman.text).toContain('thaaro');
    expect(nimadiNative.words.length).toBeGreaterThan(3);

    // Malvi test
    const malviNative = getCaptionForLanguage('Malvi', 'मालवी', 'intro', 'native');
    const malviRoman = getCaptionForLanguage('Malvi', 'मालवी', 'intro', 'roman');
    expect(malviNative.text).toContain('स्वागत');
    expect(malviRoman.text).toContain('thaaro');

    // Shekhawati test
    const shekhawatiNative = getCaptionForLanguage('Shekhawati', 'शेखावाटी', 'intro', 'native');
    const shekhawatiRoman = getCaptionForLanguage('Shekhawati', 'शेखावाटी', 'intro', 'roman');
    expect(shekhawatiNative.text).toContain('मांय');
    expect(shekhawatiRoman.text).toContain('ghano');
  });

  it('guarantees 100% caption coverage for all catalog languages without empty results', () => {
    for (const lang of LANGUAGES) {
      const nativeCap = getCaptionForLanguage(lang.name, lang.native, 'intro', 'native');
      const romanCap = getCaptionForLanguage(lang.name, lang.native, 'intro', 'roman');

      expect(nativeCap.text, `Missing native caption for ${lang.name}`).toBeTruthy();
      expect(romanCap.text, `Missing roman caption for ${lang.name}`).toBeTruthy();
      expect(nativeCap.words.length, `Empty words for native ${lang.name}`).toBeGreaterThan(0);
      expect(romanCap.words.length, `Empty words for roman ${lang.name}`).toBeGreaterThan(0);
    }
  });

  it('provides distinct script modes for bilingual rendering', () => {
    const hindiNative = getCaptionForLanguage('Hindi', 'हिन्दी', 'intro', 'native');
    const hindiRoman = getCaptionForLanguage('Hindi', 'हिन्दी', 'intro', 'roman');

    expect(hindiNative.text).not.toEqual(hindiRoman.text);
    expect(hindiNative.text).toContain('स्वागत');
    expect(hindiRoman.text).toContain('swagat');
  });

  it('provides rich caption templates with distinct styling classes and badges', async () => {
    const { DEMO_CAPTION_TEMPLATES, DEFAULT_DEMO_TEMPLATE } = await import('@/lib/demoTemplates');
    expect(DEMO_CAPTION_TEMPLATES.length).toBeGreaterThanOrEqual(8);
    expect(DEFAULT_DEMO_TEMPLATE.id).toBe('hormozi');

    const hormozi = DEMO_CAPTION_TEMPLATES.find((t) => t.id === 'hormozi');
    expect(hormozi).toBeDefined();
    expect(hormozi?.activeWordClassName).toContain('#FFE600');
    expect(hormozi?.badgeText).toContain('HORMOZI');

    const mrbeast = DEMO_CAPTION_TEMPLATES.find((t) => t.id === 'mrbeast');
    expect(mrbeast).toBeDefined();
    expect(mrbeast?.activeWordClassName).toContain('#22C55E');
    expect(mrbeast?.badgeText).toContain('MRBEAST');

    const cyberNeon = DEMO_CAPTION_TEMPLATES.find((t) => t.id === 'cyber-neon');
    expect(cyberNeon).toBeDefined();
    expect(cyberNeon?.activeWordClassName).toContain('#FF007A');
    expect(cyberNeon?.badgeText).toContain('CYBER NEON');

    const redBox = DEMO_CAPTION_TEMPLATES.find((t) => t.id === 'red-box');
    expect(redBox).toBeDefined();
    expect(redBox?.activeWordClassName).toContain('#E60000');

    // Ensure all templates have valid non-empty container & word classes
    for (const tpl of DEMO_CAPTION_TEMPLATES) {
      expect(tpl.id).toBeTruthy();
      expect(tpl.label).toBeTruthy();
      expect(tpl.containerClassName).toBeTruthy();
      expect(tpl.textClassName).toBeTruthy();
      expect(tpl.activeWordClassName).toBeTruthy();
      expect(tpl.badgeText).toBeTruthy();
    }
  });

  it('provides precise voice-synced segments matching speech in demo-video.mp4', async () => {
    const { getVoiceSyncedSegments, ENGLISH_VOICE_SYNCED_SEGMENTS } = await import('@/lib/demoCaptions');
    
    // English voice-synced segments
    const enSegments = getVoiceSyncedSegments('English');
    expect(enSegments).toEqual(ENGLISH_VOICE_SYNCED_SEGMENTS);
    expect(enSegments.length).toBe(4);
    expect(enSegments[0].start).toBe(0.0);
    expect(enSegments[3].end).toBe(10.0);

    // Check that each word in English segments has strictly valid timing
    for (const seg of enSegments) {
      expect(seg.words.length).toBeGreaterThan(0);
      for (const w of seg.words) {
        expect(w.start).toBeLessThan(w.end);
        expect(w.word).toBeTruthy();
      }
    }

    // Hindi voice-synced segments (native & roman)
    const hiNative = getVoiceSyncedSegments('Hindi', 'हिन्दी', 'native');
    const hiRoman = getVoiceSyncedSegments('Hindi', 'हिन्दी', 'roman');
    expect(hiNative.length).toBe(4);
    expect(hiRoman.length).toBe(4);
    expect(hiNative[0].text).toContain('परेशान');
    expect(hiRoman[0].text).toContain('pareshan');

    // Any regional language returns 4 bite-sized timed segments
    const malviSegments = getVoiceSyncedSegments('Malvi', 'मालवी', 'native');
    expect(malviSegments.length).toBe(4);
    expect(malviSegments[0].words.length).toBeGreaterThan(0);
  });

  it('correctly chunks words according to wordsPerChunk (1W, 2W, 3W, 4W, 5W)', async () => {
    const { ENGLISH_VOICE_SYNCED_SEGMENTS } = await import('@/lib/demoCaptions');
    const seg = ENGLISH_VOICE_SYNCED_SEGMENTS[0]; // e.g. "Create viral captions that get millions of views"
    const words = seg.words;

    // Helper chunking function matching InteractiveLanguageDemo.tsx
    const chunkWords = (allWords: typeof words, wordsPerChunk: number | 'auto', currentTime: number) => {
      if (wordsPerChunk === 'auto' || wordsPerChunk >= allWords.length) {
        return { words: allWords, activeIndex: 0 };
      }
      const chunks: Array<typeof allWords> = [];
      for (let i = 0; i < allWords.length; i += wordsPerChunk) {
        chunks.push(allWords.slice(i, i + wordsPerChunk));
      }
      let chunkIdx = chunks.findIndex((c) => currentTime < c[c.length - 1].end + 0.04);
      if (chunkIdx < 0) chunkIdx = chunks.length - 1;
      const currentChunk = chunks[chunkIdx];
      const wordIdx = currentChunk.findIndex((w) => currentTime >= w.start && currentTime < w.end);
      const activeIdx = wordIdx !== -1 ? wordIdx : (currentTime < currentChunk[0].start ? -1 : currentChunk.length - 1);
      return { words: currentChunk, activeIndex: activeIdx };
    };

    // Before speech starts (<0.16s), activeIndex must be -1 (no premature lighting)
    const preSpeechChunk = chunkWords(words, 1, 0.05);
    expect(preSpeechChunk.activeIndex).toBe(-1);

    // 1 Word chunking test during speech (t = 0.2s is within word 0)
    const oneWordChunk = chunkWords(words, 1, 0.2);
    expect(oneWordChunk.words.length).toBe(1);
    expect(oneWordChunk.words[0].word).toBe(words[0].word);
    expect(oneWordChunk.activeIndex).toBe(0);

    // 2 Words chunking test
    const twoWordsChunk = chunkWords(words, 2, 0.2);
    expect(twoWordsChunk.words.length).toBe(2);

    // 3 Words chunking test
    const threeWordsChunk = chunkWords(words, 3, 0.2);
    expect(threeWordsChunk.words.length).toBe(3);

    // 4 Words chunking test
    const fourWordsChunk = chunkWords(words, 4, 0.2);
    expect(fourWordsChunk.words.length).toBe(4);

    // 5 Words chunking test
    const fiveWordsChunk = chunkWords(words, 5, 0.2);
    expect(fiveWordsChunk.words.length).toBeLessThanOrEqual(5);

    // Auto chunking returns all words in segment
    const autoChunk = chunkWords(words, 'auto', 0.2);
    expect(autoChunk.words.length).toBe(words.length);
  });

  it('guarantees compact, tasteful font sizing for all templates without covering the video', async () => {
    const { DEMO_CAPTION_TEMPLATES } = await import('@/lib/demoTemplates');
    for (const tpl of DEMO_CAPTION_TEMPLATES) {
      // Must not use oversized font classes
      expect(tpl.textClassName).not.toContain('text-[36px]');
      expect(tpl.textClassName).not.toContain('text-[40px]');
      expect(tpl.textClassName).not.toContain('text-[48px]');
      expect(tpl.textClassName).not.toContain('scale-125');
      expect(tpl.textClassName).not.toContain('scale-150');
    }
  });
});


