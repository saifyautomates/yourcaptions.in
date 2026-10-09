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
});
