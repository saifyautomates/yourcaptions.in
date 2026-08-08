import { createClient } from "@supabase/supabase-js";
import { enforceRateLimit, makeAdmin, requireCredits, deductCredits } from "../_shared/rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LANG_NAMES: Record<string, string> = {
  "hi": "Hindi (हिन्दी)",
  "hi-Latn": "Hinglish (Hindi written in Latin/Roman script, casually mixed with common English words the way urban Indians speak — do NOT use Devanagari)",
  "en-IN": "English (India) (English)",
  "bn": "Bengali (বাংলা)",
  "ta": "Tamil (தமிழ்)",
  "te": "Telugu (తెలుగు)",
  "mr": "Marathi (मराठी)",
  "gu": "Gujarati (ગુજરાતી)",
  "kn": "Kannada (ಕನ್ನಡ)",
  "ml": "Malayalam (മലയാളം)",
  "pa": "Punjabi (ਪੰਜਾਬੀ)",
  "ur": "Urdu (اُردُو)",
  "or": "Odia (ଓଡ଼ିଆ)",
  "as": "Assamese (অসমীয়া)",
  "ne": "Nepali (नेपाली)",
  "sa": "Sanskrit (संस्कृतम्)",
  "sd": "Sindhi (سنڌي)",
  "ks": "Kashmiri (کٲشُر)",
  "kok": "Konkani (कोंकणी)",
  "mai": "Maithili (मैथिली)",
  "mni": "Manipuri (মৈতৈলোন্)",
  "sat": "Santali (ᱥᱟᱱᱛᱟᱲᱤ)",
  "doi": "Dogri (डोगरी)",
  "brx": "Bodo (बड़ो)",
  "bho": "Bhojpuri (भोजपुरी)",
  "raj": "Rajasthani (राजस्थानी)",
  "awa": "Awadhi (अवधी)",
  "mag": "Magahi (मगही)",
  "hne": "Chhattisgarhi (छत्तीसगढ़ी)",
  "gom": "Goan Konkani (गोंयची कोंकणी)",
  "tcy": "Tulu (ತುಳು)",
  "kha": "Khasi",
  "lus": "Mizo (Mizo ṭawng)",
  "grt": "Garo (A·chik)",
  "nag": "Nagamese",
  "sck": "Sadri (सादरी)",
  "gon": "Gondi (गोंडी)",
  "kru": "Kurukh (कुड़ुख़)",
  "mwr": "Marwari (मारवाड़ी)",
  "hne-CG": "Haryanvi (हरियाणवी)",
  "bpy": "Bishnupriya (বিষ্ণুপ্রিয়া)",
  "lep": "Lepcha (ᰛᰩᰵᰛᰧᰵᰶ)",
  "ur-PK": "Urdu (Pakistan) (اُردُو (پاکستان))",
  "pnb": "Punjabi (Shahmukhi) (پن٘جابی)",
  "skr": "Saraiki (سرائیکی)",
  "sd-PK": "Sindhi (Pakistan) (سنڌي)",
  "bal": "Balochi (بلۏچی)",
  "brh": "Brahui (براہوئی)",
  "hno": "Hindko (ہندکو)",
  "khw": "Khowar (کھوار)",
  "shi": "Shina (ݜݨیاٗ)",
  "bft": "Balti (སྦལ་ཏི།)",
  "wbl": "Wakhi (وخی)",
  "prs": "Dari (دری)",
  "haz": "Hazaragi (هزارگی)",
  "uzb-AF": "Uzbek (Afghanistan) (اوزبیک)",
  "dz": "Dzongkha (རྫོང་ཁ)",
  "bo": "Tibetan (བོད་སྐད་)",
  "dv": "Dhivehi (ދިވެހި)",
  "en": "English",
  "zh": "Chinese (Simplified) (简体中文)",
  "zh-TW": "Chinese (Traditional) (繁體中文)",
  "yue": "Cantonese (粵語)",
  "ja": "Japanese (日本語)",
  "ko": "Korean (한국어)",
  "vi": "Vietnamese (Tiếng Việt)",
  "th": "Thai (ไทย)",
  "id": "Indonesian (Bahasa Indonesia)",
  "ms": "Malay (Bahasa Melayu)",
  "tl": "Tagalog / Filipino (Filipino)",
  "my": "Burmese (မြန်မာ)",
  "km": "Khmer (ខ្មែរ)",
  "lo": "Lao (ລາວ)",
  "si": "Sinhala (සිංහල)",
  "mn": "Mongolian (Монгол)",
  "kk": "Kazakh (Қазақ)",
  "uz": "Uzbek (Oʻzbek)",
  "ky": "Kyrgyz (Кыргызча)",
  "tg": "Tajik (Тоҷикӣ)",
  "tk": "Turkmen (Türkmen)",
  "ps": "Pashto (پښتو)",
  "ps-PK": "Pashto (Pakistan) (پښتو (پاکستان))",
  "ug": "Uyghur (ئۇيغۇرچە)",
  "ii": "Sichuan Yi (ꆈꌠꉙ)",
  "za": "Zhuang (Vahcuengh)",
  "jv": "Javanese (Basa Jawa)",
  "su": "Sundanese (Basa Sunda)",
  "min": "Minangkabau (Baso Minang)",
  "ace": "Acehnese (Bahsa Acèh)",
  "bug": "Buginese (ᨅᨔ ᨕᨘᨁᨗ)",
  "ban": "Balinese (Basa Bali)",
  "ceb": "Cebuano (Sinugbuanon)",
  "ilo": "Ilocano (Ilokano)",
  "hil": "Hiligaynon (Ilonggo)",
  "war": "Waray (Winaray)",
  "pam": "Kapampangan",
  "bcl": "Bikol",
  "ar": "Arabic (العربية)",
  "he": "Hebrew (עברית)",
  "fa": "Persian (Farsi) (فارسی)",
  "tr": "Turkish (Türkçe)",
  "ku": "Kurdish (Kurdî)",
  "az": "Azerbaijani (Azərbaycan)",
  "hy": "Armenian (Հայերեն)",
  "ka": "Georgian (ქართული)",
  "ckb": "Kurdish (Sorani) (کوردیی ناوەندی)",
  "arz": "Egyptian Arabic (مصرى)",
  "ary": "Moroccan Arabic (Darija) (الدارجة)",
  "arq": "Algerian Arabic (دزيرية)",
  "acm": "Iraqi Arabic (عراقي)",
  "apc": "Levantine Arabic (شامي)",
  "ayl": "Libyan Arabic (ليبي)",
  "aeb": "Tunisian Arabic (تونسي)",
  "yi": "Yiddish (ייִדיש)",
  "syr": "Syriac (ܣܘܪܝܝܐ)",
  "es": "Spanish (Español)",
  "es-MX": "Spanish (Mexico) (Español (MX))",
  "pt": "Portuguese (Português)",
  "pt-BR": "Portuguese (Brazil) (Português (BR))",
  "fr": "French (Français)",
  "de": "German (Deutsch)",
  "it": "Italian (Italiano)",
  "nl": "Dutch (Nederlands)",
  "pl": "Polish (Polski)",
  "ru": "Russian (Русский)",
  "uk": "Ukrainian (Українська)",
  "be": "Belarusian (Беларуская)",
  "cs": "Czech (Čeština)",
  "sk": "Slovak (Slovenčina)",
  "hu": "Hungarian (Magyar)",
  "ro": "Romanian (Română)",
  "bg": "Bulgarian (Български)",
  "sr": "Serbian (Српски)",
  "hr": "Croatian (Hrvatski)",
  "bs": "Bosnian (Bosanski)",
  "sl": "Slovenian (Slovenščina)",
  "mk": "Macedonian (Македонски)",
  "sq": "Albanian (Shqip)",
  "el": "Greek (Ελληνικά)",
  "sv": "Swedish (Svenska)",
  "no": "Norwegian (Norsk)",
  "da": "Danish (Dansk)",
  "fi": "Finnish (Suomi)",
  "is": "Icelandic (Íslenska)",
  "et": "Estonian (Eesti)",
  "lv": "Latvian (Latviešu)",
  "lt": "Lithuanian (Lietuvių)",
  "ga": "Irish (Gaeilge)",
  "cy": "Welsh (Cymraeg)",
  "eu": "Basque (Euskara)",
  "ca": "Catalan (Català)",
  "gl": "Galician (Galego)",
  "mt": "Maltese (Malti)",
  "lb": "Luxembourgish (Lëtzebuergesch)",
  "fy": "Frisian (Frysk)",
  "gd": "Scottish Gaelic (Gàidhlig)",
  "kw": "Cornish (Kernewek)",
  "br": "Breton (Brezhoneg)",
  "oc": "Occitan",
  "co": "Corsican (Corsu)",
  "sc": "Sardinian (Sardu)",
  "fo": "Faroese (Føroyskt)",
  "kl": "Greenlandic (Kalaallisut)",
  "se": "Northern Sami (Davvisámegiella)",
  "cnr": "Montenegrin (Crnogorski)",
  "rm": "Romansh (Rumantsch)",
  "an": "Aragonese (Aragonés)",
  "ast": "Asturian (Asturianu)",
  "wa": "Walloon (Walon)",
  "hsb": "Upper Sorbian (Hornjoserbšćina)",
  "cv": "Chuvash (Чӑвашла)",
  "tt": "Tatar (Татарча)",
  "ba": "Bashkir (Башҡортса)",
  "sah": "Yakut (Sakha) (Саха тыла)",
  "sw": "Swahili (Kiswahili)",
  "am": "Amharic (አማርኛ)",
  "ha": "Hausa",
  "yo": "Yoruba (Yorùbá)",
  "ig": "Igbo",
  "zu": "Zulu (isiZulu)",
  "xh": "Xhosa (isiXhosa)",
  "af": "Afrikaans",
  "so": "Somali (Soomaali)",
  "rw": "Kinyarwanda",
  "sn": "Shona (chiShona)",
  "mg": "Malagasy",
  "st": "Sesotho",
  "tn": "Setswana",
  "ss": "Swazi (siSwati)",
  "ve": "Venda (Tshivenḓa)",
  "ts": "Tsonga (Xitsonga)",
  "nr": "Southern Ndebele (isiNdebele)",
  "nso": "Northern Sotho (Sepedi)",
  "lg": "Luganda",
  "ln": "Lingala (Lingála)",
  "kg": "Kongo (Kikongo)",
  "lu": "Luba-Katanga (Tshiluba)",
  "ny": "Chichewa",
  "ff": "Fulah (Fulfulde)",
  "wo": "Wolof",
  "bm": "Bambara (Bamanankan)",
  "ee": "Ewe (Eʋegbe)",
  "tw": "Twi",
  "ak": "Akan",
  "ti": "Tigrinya (ትግርኛ)",
  "om": "Oromo (Afaan Oromoo)",
  "aa": "Afar (Qafaraf)",
  "ber": "Berber (Tamazight) (ⵜⴰⵎⴰⵣⵉⵖⵜ)",
  "kab": "Kabyle (Taqbaylit)",
  "shi-Ma": "Tashelhit (ⵜⴰⵛⵍⵃⵉⵜ)",
  "mi": "Maori (Māori)",
  "sm": "Samoan (Gagana Samoa)",
  "haw": "Hawaiian (ʻŌlelo Hawaiʻi)",
  "to": "Tongan (Lea faka-Tonga)",
  "fj": "Fijian (Na Vosa Vakaviti)",
  "ty": "Tahitian (Reo Tahiti)",
  "mh": "Marshallese (Kajin M̧ajeļ)",
  "na": "Nauruan (Dorerin Naoero)",
  "ho": "Hiri Motu",
  "tpi": "Tok Pisin",
  "bi": "Bislama",
  "ch": "Chamorro (Chamoru)",
  "en-US": "English (US)",
  "en-GB": "English (UK)",
  "en-AU": "English (Australia) (English (AU))",
  "en-CA": "English (Canada) (English (CA))",
  "fr-CA": "French (Canada) (Français (CA))",
  "ht": "Haitian Creole (Kreyòl Ayisyen)",
  "qu": "Quechua (Runa Simi)",
  "ay": "Aymara (Aymar aru)",
  "gn": "Guarani (Avañe'ẽ)",
  "nah": "Nahuatl (Nāhuatl)",
  "yua": "Yucatec Maya (Màaya t'àan)",
  "quc": "K'iche'",
  "arn": "Mapudungun",
  "nv": "Navajo (Diné Bizaad)",
  "chr": "Cherokee (ᏣᎳᎩ)",
  "iu": "Inuktitut (ᐃᓄᒃᑎᑐᑦ)",
  "cr": "Cree (ᓀᐦᐃᔭᐍᐏᐣ)",
  "oj": "Ojibwe (Anishinaabemowin)",
  "eo": "Esperanto",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });

    const supabase = createClient(
      (Deno.env.get("SUPABASE_URL") || "").replace("mqotnflwrgqppbhjkwyq", "mqotnlflwrgqpbhjkwyq"),
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });

    const { project_id, target_language } = await req.json();
    if (!project_id || !target_language) throw new Error("project_id and target_language required");

    const admin = makeAdmin();
    const rl = await enforceRateLimit(admin, userData.user.id, "translate-captions");
    if (!rl.ok) {
      const { trackRateLimitServer } = await import("../_shared/observability.ts");
      trackRateLimitServer(userData.user.id, { fn: "translate-captions", status: rl.status, message: rl.message });
      return new Response(JSON.stringify({ error: rl.message }), {
        status: rl.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: source } = await supabase.from("captions").select("*").eq("project_id", project_id).limit(1).maybeSingle();
    if (!source) throw new Error("No source captions to translate");

    const segs = (source.segments as any[]) ?? [];
    const targetName = LANG_NAMES[target_language] ?? target_language;

    // Estimate cost = transcript duration in seconds (rounded up).
    const durationSec = segs.length
      ? Math.max(1, Math.ceil((segs[segs.length - 1]?.end ?? 0) - (segs[0]?.start ?? 0)))
      : 1;
    const credit = await requireCredits(admin, userData.user.id, durationSec);
    if (!credit.ok) {
      const { trackQuotaExceededServer } = await import("../_shared/observability.ts");
      trackQuotaExceededServer(userData.user.id, { fn: "translate-captions", kind: "credits_seconds", needed: durationSec, message: credit.message });
      return new Response(JSON.stringify({ error: credit.message }), {
        status: credit.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Batch to avoid truncated JSON responses on long transcripts.
    const CHUNK = 30;
    const chunks: any[][] = [];
    for (let i = 0; i < segs.length; i += CHUNK) chunks.push(segs.slice(i, i + CHUNK));

    const translations: { i?: number; text?: string; translation?: string; confidence?: number }[] = [];

    // Dialect / low-resource languages the base model tends to collapse into
    // a more common neighbour (e.g. Haryanvi → Hindi, Bhojpuri → Hindi,
    // Hinglish → English, Darija → MSA). We give the model explicit
    // authenticity guidance so the output actually reads in that dialect.
    const DIALECT_GUIDES: Record<string, string> = {
      "hne-CG": "Write in AUTHENTIC HARYANVI (हरियाणवी) as spoken in Haryana — NOT standard Hindi. Use distinctive Haryanvi markers: 'सै' instead of 'है', 'था' → 'था/थी' with rural intonation, 'म्हारा/थारा' instead of 'हमारा/तुम्हारा', 'के' as question marker, 'ना' at sentence ends, 'रह्या/रही' progressive, 'चाल्या जा' style verbs. Script = Devanagari. Do NOT output pure standard Hindi.",
      "bho": "Write in AUTHENTIC BHOJPURI. Use markers like 'बा/बानी/बाड़ी', 'हऽ', 'रहल', 'तोहार/हमार', 'का हो'. Devanagari. Not standard Hindi.",
      "raj": "Write in AUTHENTIC RAJASTHANI (Marwari/Mewari style). Use 'है' → 'है/छै', 'म्हारो/थारो', 'रो/री/रा' possessive, 'जावै/आवै'. Devanagari. Not Hindi.",
      "mwr": "Write in AUTHENTIC MARWARI. Use 'म्हारो/थारो', 'छै', 'रो/री', 'आवै/जावै'. Devanagari. Not Hindi.",
      "awa": "Write in AUTHENTIC AWADHI. Use 'बा', 'रहा/रही', 'तोहार/हमार', 'का'. Devanagari. Not Hindi.",
      "mag": "Write in AUTHENTIC MAGAHI. Use 'हे/हउ', 'तोहर/हमर', 'बा'. Devanagari. Not Hindi.",
      "hne": "Write in AUTHENTIC CHHATTISGARHI. Use 'हे', 'तोर/मोर', 'हावै', 'बर'. Devanagari. Not Hindi.",
      "mai": "Write in AUTHENTIC MAITHILI. Use 'अछि', 'छथि', 'अहाँक/हमर'. Devanagari. Not Hindi.",
      "hi-Latn": "Write in HINGLISH — Hindi in Roman script mixed casually with common English words the way urban Indians actually text. Do NOT use Devanagari. Do NOT translate to pure English.",
      "ary": "Write in AUTHENTIC MOROCCAN DARIJA, not Modern Standard Arabic. Use dialect markers: 'كاين', 'بزاف', 'واخا', 'شنو', 'دابا'.",
      "arz": "Write in AUTHENTIC EGYPTIAN ARABIC, not MSA. Use 'ازاي', 'كده', 'عايز', 'ايه'.",
      "apc": "Write in AUTHENTIC LEVANTINE ARABIC, not MSA. Use 'شو', 'هيك', 'بدي', 'كتير'.",
      "yue": "Write in AUTHENTIC CANTONESE (粵語) using colloquial characters (咁, 嘅, 咗, 唔, 佢, 冇), NOT Mandarin.",
    };
    const dialectGuide = DIALECT_GUIDES[target_language] ?? "";

    for (let c = 0; c < chunks.length; c++) {
      const batch = chunks[c];
      const offset = c * CHUNK;
      const prompt = `Translate each subtitle segment into ${targetName}.
${dialectGuide ? `\nCRITICAL DIALECT REQUIREMENT: ${dialectGuide}\nIf you output text that reads as a different (more common) language, self-rate confidence < 0.4.\n` : ""}
Rules:
- Translate the MEANING; never leave the source language.
- Never transliterate. Never output English (unless target IS English).
- Match the target script and dialect exactly.
- For every segment, self-rate confidence 0–1 (1 = fluent + authentic dialect; <0.4 = wrong language or literal).

Return JSON: {"translations":[{"i":0,"text":"...","confidence":0.87}, ...]} — one entry per input segment, in order.

Segments:
${JSON.stringify(batch.map((s, i) => ({ i, text: s.text })))}`;

      const aiJson = await callAI({
          model: dialectGuide ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: `You are a professional subtitle translator specializing in regional dialects. Translate to ${targetName}. ${dialectGuide ? "Preserve the dialect's distinctive vocabulary and grammar — do NOT normalize to the nearest standard language. " : ""}Reply with JSON only, including a per-segment confidence score.` },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
          max_tokens: 8192,
        });
      const finishReason = aiJson.choices?.[0]?.finish_reason;
      const content = aiJson.choices?.[0]?.message?.content ?? "{}";
      if (finishReason === "length") {
        throw new Error(`AI output truncated on chunk ${c + 1}/${chunks.length} — reduce transcript length or retry.`);
      }
      let parsed: any;
      try {
        parsed = JSON.parse(content);
      } catch (err) {
        throw new Error(`Malformed AI JSON on chunk ${c + 1}/${chunks.length}: ${(err as Error).message}`);
      }
      let batchTranslations: any[] = [];
      if (Array.isArray(parsed)) batchTranslations = parsed;
      else if (parsed && typeof parsed === "object") {
        const firstArr = Object.values(parsed).find((v) => Array.isArray(v));
        batchTranslations = (parsed.translations ?? parsed.segments ?? parsed.items ?? parsed.data ?? firstArr ?? []) as any[];
      }
      // Re-key indices to the global segment index.
      for (const t of batchTranslations) {
        if (typeof t?.i === "number") t.i = t.i + offset;
        translations.push(t);
      }
    }
    console.log(`translate-captions: got ${translations.length} translations for ${segs.length} segments`);


    const clamp01 = (n: unknown) => {
      const v = typeof n === "number" ? n : Number(n);
      if (!Number.isFinite(v)) return undefined;
      return Math.max(0, Math.min(1, v));
    };

    const translated = segs.map((s, i) => {
      const match = translations.find((t) => t.i === i) ?? translations[i];
      const text = match?.text ?? (match as any)?.translation ?? s.text;
      const confidence = clamp01((match as any)?.confidence);
      // Heuristic penalty: if the translated text is identical to the source
      // (i.e. the model returned it untranslated), floor the confidence.
      const looksUntranslated = text && s.text && text.trim() === s.text.trim();
      const finalConfidence =
        looksUntranslated ? Math.min(confidence ?? 0.3, 0.3)
        : confidence;
      return { ...s, text, ...(finalConfidence !== undefined ? { confidence: finalConfidence } : {}) };
    });

    const fmt = (t: number) => {
      const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = Math.floor(t % 60), ms = Math.floor((t % 1) * 1000);
      return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")},${String(ms).padStart(3,"0")}`;
    };
    const srt = translated.map((s: any, i: number) =>
      `${i + 1}\n${fmt(s.start)} --> ${fmt(s.end)}\n${s.text}\n`
    ).join("\n");

    await supabase.from("captions").insert({
      project_id, language: target_language, segments: translated, srt_text: srt,
    });

    await deductCredits(admin, userData.user.id, durationSec);

    return new Response(JSON.stringify({ ok: true, credits_charged: durationSec }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message ?? String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
