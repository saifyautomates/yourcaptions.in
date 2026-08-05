// Maps our full language catalog (200+ BCP-47 codes) to what each
// provider actually supports. Anything not in a provider's map falls
// through to Whisper Whisper with auto-detect.

// AssemblyAI universal-3/universal-2 supported languages (ISO-639-1 base).
const ASSEMBLYAI_SUPPORTED = new Set([
  "en","en_us","en_gb","en_au","en_uk","es","fr","de","it","pt","nl","hi","ja","zh","ko",
  "fi","pl","ru","tr","uk","vi","he","ar","cs","da","el","hu","id","ms","no","ro","sv","th","fil","af","az","bg","bn","bs","ca","cy","et","gl","hr","hy","is","ka","kk","kn","lt","lv","mi","mk","mr","ne","pa","sk","sl","sr","sw","ta","te","tl","tk","ur","zu","fa","lb","mn","my","gu","kn","mt","si","so"
]);

// Deepgram nova-2 / nova-3 supported codes.
const DEEPGRAM_SUPPORTED = new Set([
  "en","en-US","en-GB","en-AU","en-IN","en-NZ","es","es-419","fr","fr-CA","de","de-CH","it","pt","pt-BR","pt-PT","nl","nl-BE","hi","hi-Latn","ja","zh","zh-CN","zh-TW","ko","ko-KR","ru","tr","uk","vi","pl","sv","da","no","fi","cs","el","he","id","ms","ro","sk","th","ar","bg","ca","et","fa","hu","lt","lv","sl","ta","tl"
]);

// Map any of our regional / non-standard codes to a base code the
// providers understand. Anything mapped to null → auto-detect.
const NORMALIZE: Record<string, string> = {
  "hi-Latn": "hi",
  "en-IN": "en",
  "en-US": "en",
  "en-GB": "en",
  "en-AU": "en",
  "ur-PK": "ur",
  "sd-PK": "sd",
  "hne-CG": "hi",
  "bho": "hi", "mai": "hi", "awa": "hi", "mag": "hi", "raj": "hi",
  "mwr": "hi", "hne": "hi", "sck": "hi", "doi": "hi", "brx": "hi",
  "kok": "hi", "gom": "hi",
  "sat": "hi", "mni": "bn", "lus": "en", "grt": "en", "kha": "en",
  "nag": "en", "gon": "hi", "kru": "hi", "bpy": "bn", "lep": "ne",
  "tcy": "kn",
  "pnb": "pa", "skr": "ur",
};

export function normalizeLang(code: string | null | undefined): string {
  if (!code) return "en";
  return NORMALIZE[code] ?? code.split("-")[0];
}

export function assemblyLang(code: string): string | null {
  const base = normalizeLang(code).toLowerCase();
  if (ASSEMBLYAI_SUPPORTED.has(base)) return base;
  return null; // → use language_detection instead
}

export function deepgramLang(code: string): string | null {
  const base = normalizeLang(code);
  if (DEEPGRAM_SUPPORTED.has(base)) return base;
  const lower = base.toLowerCase();
  if (DEEPGRAM_SUPPORTED.has(lower)) return lower;
  return null; // → detect_language=true
}
