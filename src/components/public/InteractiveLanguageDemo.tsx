import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Check, Volume2, VolumeX, Sparkles, Search, Play, Pause, Captions, Upload, Video, Mic, RefreshCw, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { LANGUAGES as ALL_LANGUAGES } from '@/lib/languages';
import { getCaptionForLanguage } from '@/lib/demoCaptions';
import { DEMO_CAPTION_TEMPLATES, DEFAULT_DEMO_TEMPLATE, type DemoCaptionTemplate } from '@/lib/demoTemplates';


export interface LanguageInfo {
  name: string;
  category: 'Indian' | 'Global' | 'MiddleEast' | 'Roman';
  native?: string;
}

export const LANGUAGES: LanguageInfo[] = ALL_LANGUAGES.map(lang => {
  let category: 'Indian' | 'Global' | 'MiddleEast' | 'Roman' = 'Global';
  
  if (lang.region === 'India') {
    category = 'Indian';
  } else if (lang.region === 'Middle East' || lang.rtl) {
    category = 'MiddleEast';
  } else if (lang.region === 'Africa' || lang.region === 'Oceania' || lang.region === 'Americas' || lang.region === 'Europe' || lang.region === 'Asia') {
    category = 'Global';
  }

  // Handle manual Roman languages based on 'Latn' suffix or names in demo
  if (lang.code.includes('-Latn')) {
    category = 'Roman';
  }

  return { name: lang.name, category, native: lang.native };
}).concat([
  { name: 'Hinglish', category: 'Roman', native: 'Hinglish' },
  { name: 'Tanglish', category: 'Roman', native: 'Tanglish' },
  { name: 'Teluglish', category: 'Roman', native: 'Teluglish' },
  { name: 'Minglish', category: 'Roman', native: 'Minglish' },
  { name: 'Gujlish', category: 'Roman', native: 'Gujlish' },
  { name: 'Kanglish', category: 'Roman', native: 'Kanglish' },
  { name: 'Manglish', category: 'Roman', native: 'Manglish' },
  { name: 'Punglish', category: 'Roman', native: 'Punglish' }
]).filter((v, i, a) => a.findIndex(t => (t.name === v.name)) === i); // Unique by name

export interface VideoPreset {
  id: string;
  title: string;
  spokenVoice: string;
  sources: string[];
  captions: Record<string, { native: string; roman: string }>;
}

export const VIDEO_PRESETS: VideoPreset[] = [
  {
    id: 'intro',
    title: 'Intro & Welcome',
    spokenVoice: '"Welcome to Yourcaptions.in — Auto-generate viral video captions in seconds!"',
    sources: [
      "/demo-video.mp4",
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
      "https://vjs.zencdn.net/v/oceans.mp4"
    ],
    captions: {
      English: { native: 'Welcome to Yourcaptions.in — Auto-generate viral captions!', roman: 'Welcome to Yourcaptions.in — Auto-generate viral captions!' },
      Spanish: { native: '¡Bienvenido a Yourcaptions.in — Genera subtítulos virales en segundos!', roman: 'Bienvenido a Yourcaptions.in — Genera subtitulos virales en segundos!' },
      French: { native: 'Bienvenue sur Yourcaptions.in — Générez des sous-titres viraux en quelques secondes !', roman: 'Bienvenue sur Yourcaptions.in — Generez des sous-titres viraux en quelques secondes !' },
      German: { native: 'Willkommen bei Yourcaptions.in — Erstelle virale Untertitel in Sekunden!', roman: 'Willkommen bei Yourcaptions.in — Erstelle virale Untertitel in Sekunden!' },
      Italian: { native: 'Benvenuto su Yourcaptions.in — Genera sottotitoli virali in pochi secondi!', roman: 'Benvenuto su Yourcaptions.in — Genera sottotitoli virali in pochi secondi!' },
      Portuguese: { native: 'Bem-vindo ao Yourcaptions.in — Gere legendas virais em segundos!', roman: 'Bem-vindo ao Yourcaptions.in — Gere legendas virais em segundos!' },
      Japanese: { native: 'Yourcaptions.in へようこそ — 数秒でバズる字幕を自動生成！', roman: 'Yourcaptions.in he yokoso — subyou de bazuru jimaku wo jidou seisei!' },
      Korean: { native: 'Yourcaptions.in에 오신 것을 환영합니다 — 몇 초 만에 바이럴 자막 생성!', roman: 'Yourcaptions.in e osin geos-eul hwanyeonghabnida — myeot cho mane baireol jamak saengseong!' },
      Chinese: { native: '欢迎来到 Yourcaptions.in — 几秒钟内自动生成爆款字幕！', roman: 'Huanying laidao Yourcaptions.in — ji miaozhong nei zidong shengcheng baokuan zimu!' },
      Russian: { native: 'Добро пожаловать в Yourcaptions.in — автогенерация вирусных субтитров!', roman: 'Dobro pozhalovat v Yourcaptions.in — avtogeneraciya virusnyh subtitrov!' },
      Hindi: { native: 'Yourcaptions.in में आपका स्वागत है — सेकंडों में ऑटो-वायरल कैप्शंस बनाएं!', roman: 'Yourcaptions.in mein aapka swagat hai — seconds mein auto-viral captions banayein!' },
      Tamil: { native: 'Yourcaptions.in-க்கு வரவேற்கிறோம் — நொடிகளில் வைரல் தலைப்புகளை உருவாக்குங்கள்!', roman: 'Yourcaptions.in ku varaverkirom — nodigalil viral captions uruvaakkungal!' },
      Telugu: { native: 'Yourcaptions.in కు స్వాగతం — క్షణాల్లో ఆటో-వైరల్ క్యాప్షన్‌లను సృష్టించండి!', roman: 'Yourcaptions.in ku swagatam — kshanallo auto-viral captions srushtinchandi!' },
      Malayalam: { native: 'Yourcaptions.in ലേക്ക് സ്വാഗതം — നിമിഷങ്ങൾക്കുള്ളിൽ വൈറൽ അടിക്കുറിപ്പുകൾ ഉണ്ടാക്കൂ!', roman: 'Yourcaptions.in lekk svagatam — nimishangalkkullil viral captions undakku!' },
      Gujarati: { native: 'Yourcaptions.in માં આપનું સ્વાગત છે — સેકન્ડોમાં વાયરલ કૅપ્શન્સ બનાવો!', roman: 'Yourcaptions.in ma aapnu swagat che — seconds ma viral captions banavo!' },
      Bengali: { native: 'Yourcaptions.in এ আপনাকে স্বাগতম — সেকেন্ডে ভাইরাল ক্যাপশন তৈরি করুন!', roman: 'Yourcaptions.in e apnake swagatom — second e viral caption tairi korun!' },
      Punjabi: { native: 'Yourcaptions.in ਵਿੱਚ ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ — ਸਕਿੰਟਾਂ ਵਿੱਚ ਵਾਇਰਲ ਕੈਪਸ਼ਨ ਬਣਾਓ!', roman: 'Yourcaptions.in vich tuhada swagat hai — seconds vich viral captions banao!' },
      Marathi: { native: 'Yourcaptions.in मध्ये आपले स्वागत आहे — सेकंदात व्हायरल कॅप्शन तयार करा!', roman: 'Yourcaptions.in madhye aaple swagat aahe — secondat viral caption tayar kara!' },
      Kannada: { native: 'Yourcaptions.in ಗೆ ಸ್ವಾಗತ — ಸೆಕೆಂಡುಗಳಲ್ಲಿ ವೈರಲ್ ಶೀರ್ಷಿಕೆಗಳನ್ನು ರಚಿಸಿ!', roman: 'Yourcaptions.in ge swagatha — secondugalalli viral captions rachisi!' },
      Odia: { native: 'Yourcaptions.in କୁ ସ୍ୱାଗତ — ସେକେଣ୍ଡରେ ଭାଇରାଲ୍ କ୍ୟାପସନ୍ ତିଆରି କରନ୍ତୁ!', roman: 'Yourcaptions.in ku swagata — second re viral caption tiari karantu!' },
      Assamese: { native: 'Yourcaptions.in লৈ স্বাগতম — ছেকেণ্ডতে ভাইৰেল কেপচন সৃষ্টি কৰক!', roman: 'Yourcaptions.in loi swagatom — second te viral caption srishti korok!' },
      Nepali: { native: 'Yourcaptions.in मा स्वागत छ — सेकेन्डमै भाइरल क्याप्सनहरू बनाउनुहोस्!', roman: 'Yourcaptions.in ma swagat cha — second mai viral captions banaunuhos!' },
      Bhojpuri: { native: 'Yourcaptions.in में स्वागत बा — सेकेंडन में वायरल कैप्शन बनाईं!', roman: 'Yourcaptions.in mein swagat ba — seconds mein viral caption banai!' },
      Rajasthani: { native: 'Yourcaptions.in में स्वागत है — सेकंडां मांय वायरल कैप्शन बणावो!', roman: 'Yourcaptions.in mein swagat hai — seconds maay viral caption banavo!' },
      Konkani: { native: 'Yourcaptions.in ात स्वागत — सेकंदांनी व्हायरल कॅप्शन तयार करा!', roman: 'Yourcaptions.in ant swagat — secondani viral caption tayar kara!' },
      Arabic: { native: 'أهلاً بك في Yourcaptions.in — أنشئ تسميات توضيحية انتشارية في ثوانٍ!', roman: 'Ahlan bik fi Yourcaptions.in — anshi tasmiyat tudihiya intishariya fi thawani!' },
      Urdu: { native: 'Yourcaptions.in میں خوش آمدید — سیکنڈوں میں وائرل کیپشنز بنائیں!', roman: 'Yourcaptions.in mein khush aamdeed — seconds mein viral captions banayein!' },
      Persian: { native: 'به Yourcaptions.in خوش آمدید — در چند ثانیه زیرنویس ویروسی بسازید!', roman: 'Be Yourcaptions.in khosh aamadid — dar chand saniye zirnevis virosi besazid!' },
      Kashmiri: { native: 'Yourcaptions.in منز خوش آمدید — کینھن ثانیین منز وائرل کیپشن بناوِو!', roman: 'Yourcaptions.in manz khush aamdeed — kehn thaniyen manz viral caption banaviv!' },
      Pashto: { native: 'Yourcaptions.in ته ښه راغلاست — په څو ثانیو کې ویروسي سپټTitles جوړ کړئ!', roman: 'Yourcaptions.in ta shah raghlast — pa tso thanyo ke virosi captions jor krai!' },
      Hinglish: { native: 'Yourcaptions.in me aapka swagat hai — seconds me auto viral captions banayein!', roman: 'Yourcaptions.in me aapka swagat hai — seconds me auto viral captions banayein!' },
      Tanglish: { native: 'Yourcaptions.in ku ungalai varaverkirom — seconds la viral captions pannunga!', roman: 'Yourcaptions.in ku ungalai varaverkirom — seconds la viral captions pannunga!' },
      Minglish: { native: 'Yourcaptions.in madhe tumche swagat aahe — seconds madhe viral captions banva!', roman: 'Yourcaptions.in madhe tumche swagat aahe — seconds madhe viral captions banva!' },
    }
  },
  {
    id: 'accuracy',
    title: 'AI Voice Accuracy',
    spokenVoice: '"Supercharge your audience reach with 99.2% subtitle accuracy and automated Roman script!"',
    sources: [
      "/demo-video.mp4",
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4"
    ],
    captions: {
      English: { native: 'Supercharge your reach with 99.2% subtitle accuracy!', roman: 'Supercharge your reach with 99.2% subtitle accuracy!' },
      Spanish: { native: '¡Potencia tu alcance con un 99.2% de precisión en subtítulos!', roman: 'Potencia tu alcance con un 99.2% de precision en subtitulos!' },
      French: { native: 'Booster votre audience avec une précision de sous-titres de 99,2 % !', roman: 'Booster votre audience avec une precision de sous-titres de 99,2 % !' },
      German: { native: 'Erhöhe deine Reichweite mit 99,2% Genauigkeit bei Untertiteln!', roman: 'Erhohe deine Reichweite mit 99,2% Genauigkeit bei Untertiteln!' },
      Italian: { native: 'Aumenta la tua portata con il 99,2% di precisione dei sottotitoli!', roman: 'Aumenta la tua portata con il 99,2% di precisione dei sottotitoli!' },
      Portuguese: { native: 'Aumente seu alcance com 99,2% de precisão nas legendas!', roman: 'Aumente seu alcance com 99,2% de precisao nas legendas!' },
      Japanese: { native: '99.2%の高精度字幕で視聴者のリーチを爆発的に拡大！', roman: '99.2% no kouseido jimaku de shichousha no riichi wo bakuhatsuteki ni kakudai!' },
      Korean: { native: '99.2% 자막 정확도로 도달률을 극대화하세요!', roman: '99.2% jamak jeonghwagdoro dodallyeorul geukdaehwahasatgo!' },
      Chinese: { native: '利用 99.2% 精准字幕，让您的视频曝光率翻倍！', roman: 'Liyong 99.2% jingzhun zimu, rang nin de shipin baoguanglu fanbei!' },
      Russian: { native: 'Увеличьте охват аудитории с точностью субтитров 99,2%!', roman: 'Uvelich\'te ohvat auditorii s tochnost\'yu subtitrov 99,2%!' },
      Hindi: { native: '99.2% सटीक सबटाइटल्स के साथ अपनी ऑडियंस तक पहुंच बढ़ाएं!', roman: '99.2% sateek subtitles ke saath apni audience reach badhayein!' },
      Tamil: { native: '99.2% துல்லியமான துணைத் தலைப்புகளுடன் உங்கள் பார்வையாளர்களை உயர்த்துங்கள்!', roman: '99.2% thulliyamaana subtitles udan ungal audience reach ai uyarthungal!' },
      Telugu: { native: '99.2% ఖచ్చితమైన సబ్‌టైటిల్స్‌తో మీ ప్రేక్షకుల చేరువను పెంచుకోండి!', roman: '99.2% khachitamaina subtitles tho mee audience reach ni penchukondi!' },
      Malayalam: { native: '99.2% കൃത്യതയുള്ള സബ്‌ടൈറ്റിലുകൾ ഉപയോഗിച്ച് നിങ്ങളുടെ ഓഡിയൻസ് റീച്ച് വർദ്ധിപ്പിക്കൂ!', roman: '99.2% krithyathayulla subtitles upayogichu ningalude audience reach vardhippikku!' },
      Gujarati: { native: '99.2% સચોટ સબટાઈટલ સાથે તમારા પ્રેક્ષકો સુધી પહોંચ વધારો!', roman: '99.2% sachot subtitles sathe tamara audience sudhi pahonch vadharo!' },
      Bengali: { native: '99.2% নিখুঁত সাবটাইটেল সহ আপনার দর্শকের কাছে পৌঁছান!', roman: '99.2% nikhut subtitle sho apnar audience er kache pouchan!' },
      Punjabi: { native: '99.2% ਸਹੀ ਸਬਟਾਈਟਲਾਂ ਨਾਲ ਆਪਣੀ ਆਡੀਅੰਸ ਪਹੁੰਚ ਵਧਾਓ!', roman: '99.2% sahi subtitles naal apni audience reach vadhao!' },
      Marathi: { native: '99.2% तंतोतंत सबटायटल्ससह तुमची ऑडिअन्स रीच वाढवा!', roman: '99.2% tantotant subtitles saha tumchi audience reach vadhva!' },
      Kannada: { native: '99.2% ನಿಖರವಾದ ಉಪಶೀರ್ಷಿಕೆಗಳೊಂದಿಗೆ ನಿಮ್ಮ ವೀಕ್ಷಕರ ತಲುಪುವಿಕೆಯನ್ನು ಹೆಚ್ಚಿಸಿ!', roman: '99.2% nikharavada subtitles nondige nimma audience reach nannu hechisi!' },
      Odia: { native: '99.2% ସଠିକ୍ ସବଟାଇଟଲ୍ ସହିତ ଆପଣଙ୍କର ଦର୍ଶକ ପହଞ୍ଚ ବୃଦ୍ଧି କରନ୍ତୁ!', roman: '99.2% sathik subtitles sahita apankara audience reach bruddhi karantu!' },
      Assamese: { native: '99.2% নিখুঁত উপশীৰ্ষকৰ সৈতে আপোনাৰ দৰ্শকৰ প্ৰসাৰ বৃদ্ধি কৰক!', roman: '99.2% nikhut subtitles r hoite aponar audience reach briddhi korok!' },
      Nepali: { native: '99.2% सही उपशीर्षकहरूको साथ आफ्नो दर्शक पहुँच बढाउनुहोस्!', roman: '99.2% sahi subtitles haruko saath aafno audience reach badaunuhos!' },
      Bhojpuri: { native: '99.2% सटीक सबटाइटल्स के साथ आपन रीच बढ़ाईं!', roman: '99.2% sateek subtitles ke saath aapan reach badhai!' },
      Rajasthani: { native: '99.2% सटीक सबटाइटल्स सूं आपरी रीच बढ़ावो!', roman: '99.2% sateek subtitles soo aapri reach banavo!' },
      Konkani: { native: '99.2% तंतोतंत सबटायटलींसहित तुमची ऑडिअन्स रीच वाडोवयात!', roman: '99.2% tantotant subtitles sahith tumchi audience reach vadovyat!' },
      Arabic: { native: 'زد من وصول جمهورك بدقة ترجمة تصل إلى 99.2%!', roman: 'Zid min wusul jumhurik bidiqqat tarjama tasil ila 99.2%!' },
      Urdu: { native: '99.2% درست سب ٹائٹلز کے ساتھ اپنی سامعین تک رسائی بڑھائیں!', roman: '99.2% durust subtitles ke saath apni audience reach badhayein!' },
      Persian: { native: 'با دقت 99.2٪ زیرنویس، میزان دسترسی به مخاطبان خود را افزایش دهید!', roman: 'Ba deqqat 99.2% zirnevis, mizan dastrasi be mukhataban khod ra afzayesh dahid!' },
      Kashmiri: { native: '99.2% صحیح سب ٹائٹلن سیتھ بڑھیو پنن ریچ!', roman: '99.2% sahih subtitles saath badhiv panun reach!' },
      Pashto: { native: 'د 99.2٪ دقیق سپټTitلو سره د خپلو لیدونکو لاسرسی زیات کړئ!', roman: 'Da 99.2% daqeeoq subtitles سره da khpalo ledoonko lasrasi zyat krai!' },
      Hinglish: { native: '99.2% accurate subtitles ke saath apni audience reach badhayein!', roman: '99.2% accurate subtitles ke saath apni audience reach badhayein!' },
      Tanglish: { native: '99.2% accurate subtitles vachi ungal audience reach a adhigam aakunga!', roman: '99.2% accurate subtitles vachi ungal audience reach a adhigam aakunga!' },
      Minglish: { native: '99.2% accurate subtitles sobat tumchi audience reach mothi kara!', roman: '99.2% accurate subtitles sobat tumchi audience reach mothi kara!' },
    }
  },
  {
    id: 'reels',
    title: 'Viral Shorts & Reels',
    spokenVoice: '"Create high-converting video captions for YouTube Shorts, Instagram Reels, and TikTok!"',
    sources: [
      "/demo-video.mp4",
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
      "https://vjs.zencdn.net/v/oceans.mp4"
    ],
    captions: {
      English: { native: 'Create high-converting captions for YouTube Shorts & Reels!', roman: 'Create high-converting captions for YouTube Shorts & Reels!' },
      Spanish: { native: '¡Crea subtítulos de alta conversión para Shorts y Reels!', roman: 'Crea subtitulos de alta conversion para Shorts y Reels!' },
      French: { native: 'Créez des sous-titres à fort taux de conversion pour Shorts et Reels !', roman: 'Creez des sous-titres a fort taux de conversion pour Shorts et Reels !' },
      German: { native: 'Erstelle hochkonvertierende Untertitel für Shorts & Reels!', roman: 'Erstelle hochkonvertierende Untertitel fur Shorts & Reels!' },
      Italian: { native: 'Crea sottotitoli ad alta conversione per Shorts e Reels!', roman: 'Crea sottotitoli ad alta conversione per Shorts e Reels!' },
      Portuguese: { native: 'Crie legendas de alta conversão para Shorts e Reels!', roman: 'Crie legendas de alta conversao para Shorts e Reels!' },
      Japanese: { native: 'YouTube ShortsとReels用に最高転換率の字幕を作成！', roman: 'YouTube Shorts to Reels you ni saikou tenkanritsu no jimaku wo sakusei!' },
      Korean: { native: 'YouTube Shorts 및 Reels를 위한 고효율 자막을 제작하세요!', roman: 'YouTube Shorts mhit Reels rur wihan gohyoyul jamak ur jejakhasatgo!' },
      Chinese: { native: '为 YouTube Shorts 和 Reels 打造高转化率字幕！', roman: 'Wei YouTube Shorts he Reels dazao gao zhuanhualv zimu!' },
      Russian: { native: 'Создавайте конверсионные субтитры для Shorts и Reels!', roman: 'Sozdavajte konversionnye subtitry dlya Shorts i Reels!' },
      Hindi: { native: 'YouTube Shorts और Instagram Reels के लिए हाई-कन्वर्टिंग कैप्शंस बनाएं!', roman: 'YouTube Shorts aur Instagram Reels ke liye high-converting captions banayein!' },
      Tamil: { native: 'YouTube Shorts மற்றும் Reels க்கான உயர் மாற்ற தலைப்புகளை உருவாக்குங்கள்!', roman: 'YouTube Shorts matrum Reels kaana high-converting captions uruvaakkungal!' },
      Telugu: { native: 'YouTube Shorts మరియు Reels కోసం హై-కన్వర్టింగ్ క్యాప్షన్‌లను సృష్టించండి!', roman: 'YouTube Shorts mariyu Reels kosam high-converting captions srushtinchandi!' },
      Malayalam: { native: 'Shorts, Reels എന്നിവയ്ക്കായി മികച്ച രീതിയിൽ പരിവർത്തനം ചെയ്യുന്ന അടിക്കുറിപ്പുകൾ നിർമ്മിക്കൂ!', roman: 'Shorts, Reels ennivaykkayi mikacha reethiyil conversion nalkunna captions undakku!' },
      Gujarati: { native: 'YouTube Shorts અને Reels માટે ઉચ્ચ-રૂપાંતરિત કૅપ્શન્સ બનાવો!', roman: 'YouTube Shorts ane Reels mate high-converting captions banavo!' },
      Bengali: { native: 'YouTube Shorts এবং Reels-এর জন্য দারুণ কনভার্টিং ক্যাপশন তৈরি করুন!', roman: 'YouTube Shorts ebong Reels-er jonno darun converting caption tairi korun!' },
      Punjabi: { native: 'YouTube Shorts ਅਤੇ Reels ਲਈ ਉੱਚ-ਕਨਵਰਟਿੰਗ ਕੈਪਸ਼ਨ ਬਣਾਓ!', roman: 'YouTube Shorts aur Reels layi high-converting captions banao!' },
      Marathi: { native: 'YouTube Shorts आणि Reels साठी हाय-कन्व्हर्टिंग कॅप्शन तयार करा!', roman: 'YouTube Shorts aani Reels sathi high-converting caption tayar kara!' },
      Kannada: { native: 'YouTube Shorts ಮತ್ತು Reels ಗಾಗಿ ಹೆಚ್ಚಿನ ಪರಿವರ್ತನೆ ನೀಡುವ ಶೀರ್ಷಿಕೆಗಳನ್ನು ರಚಿಸಿ!', roman: 'YouTube Shorts matthu Reels gagi hechina conversion needuva captions rachisi!' },
      Odia: { native: 'YouTube Shorts ଏବଂ Reels ପାଇଁ ଉଚ୍ଚ-ପରିବର୍ତ୍ତନଶୀଳ କ୍ୟାପସନ୍ ତିଆରି କରନ୍ତୁ!', roman: 'YouTube Shorts ebanga Reels pain high-converting caption tiari karantu!' },
      Assamese: { native: 'YouTube Shorts আৰু Reels ৰ বাবে ভাইৰেল কেপচন সৃষ্টি কৰক!', roman: 'YouTube Shorts aru Reels r babe viral caption srishti korok!' },
      Nepali: { native: 'YouTube Shorts र Reels को लागि उच्च-कन्भर्टिङ क्याप्सनहरू बनाउनुहोस्!', roman: 'YouTube Shorts ra Reels ko lagi high-converting captions banaunuhos!' },
      Bhojpuri: { native: 'Shorts आ Reels खातिर धांसू कैप्शन बनाईं!', roman: 'Shorts aat Reels khati dhaansu caption banai!' },
      Rajasthani: { native: 'Shorts अर Reels खातर हाई-कन्वर्टिंग कैप्शन बणावो!', roman: 'Shorts ar Reels khatar high-converting caption banavo!' },
      Konkani: { native: 'Shorts आणी Reels खातीर मस्त कॅप्शन तयार करा!', roman: 'Shorts aani Reels khatir mast caption tayar kara!' },
      Arabic: { native: 'أنشئ تسميات توضيحية عالية التحويل لـ Shorts و Reels!', roman: 'Anshi tasmiyat tudihiya aaliyat al-tahwil li Shorts wa Reels!' },
      Urdu: { native: 'YouTube Shorts اور Reels کے لیے اعلیٰ کنورٹنگ کیپشنز بنائیں!', roman: 'YouTube Shorts aur Reels ke liye high-converting captions banayein!' },
      Persian: { native: 'برای YouTube Shorts و Reels زیرنویس‌های پربازدید بسازید!', roman: 'Baraye YouTube Shorts va Reels zirnevis-haye porbazdid besazid!' },
      Kashmiri: { native: 'Shorts تے Reels خٲطرٕ بناوِو بہترین کیپشن!', roman: 'Shorts te Reels khatra banaviv behtareen caption!' },
      Pashto: { native: 'د YouTube Shorts او Reels لپاره د لوړ بدلون سپټTitل جوړ کړئ!', roman: 'Da YouTube Shorts او Reels لپاره د لوړ بدلون captions جوړ کړئ!' },
      Hinglish: { native: 'YouTube Shorts aur Instagram Reels ke liye high-converting captions banayein!', roman: 'YouTube Shorts aur Instagram Reels ke liye high-converting captions banayein!' },
      Tanglish: { native: 'YouTube Shorts matrum Instagram Reels ku semma converting captions pannunga!', roman: 'YouTube Shorts matrum Instagram Reels ku semma converting captions pannunga!' },
      Minglish: { native: 'YouTube Shorts aani Instagram Reels sathi high-converting captions banva!', roman: 'YouTube Shorts aani Instagram Reels sathi high-converting captions banva!' },
    }
  }
];

export default function InteractiveLanguageDemo() {
  const [selectedLang, setSelectedLang] = useState<LanguageInfo>(LANGUAGES[10]); // Hindi default
  const [scriptMode, setScriptMode] = useState<'native' | 'roman'>('native');
  const [activeCategory, setActiveCategory] = useState<'All' | 'Indian' | 'Global' | 'MiddleEast' | 'Roman'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);

  // Video Selection & Custom Upload State
  const [selectedPresetId, setSelectedPresetId] = useState<string>('intro');
  const [customVideoUrl, setCustomVideoUrl] = useState<string | null>(null);
  const [customVideoName, setCustomVideoName] = useState<string | null>(null);
  const [videoSourceIndex, setVideoSourceIndex] = useState(0);
  const [videoFailed, setVideoFailed] = useState(false);

  // Caption Template Style State
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('hormozi');
  const [isTemplateMenuOpen, setIsTemplateMenuOpen] = useState(false);

  const currentTemplate = useMemo(() => {
    return DEMO_CAPTION_TEMPLATES.find((t) => t.id === selectedTemplateId) || DEFAULT_DEMO_TEMPLATE;
  }, [selectedTemplateId]);

  const handleSelectTemplate = (tpl: DemoCaptionTemplate) => {
    setSelectedTemplateId(tpl.id);
    setIsTemplateMenuOpen(false);
    try {
      localStorage.setItem('captions:appliedTemplate', tpl.name);
    } catch {
      /* noop */
    }
  };

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentPreset = useMemo(() => {
    return VIDEO_PRESETS.find((p) => p.id === selectedPresetId) || VIDEO_PRESETS[0];
  }, [selectedPresetId]);

  // Handle Video Time Progress
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateProgress = () => {
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };

    video.addEventListener('timeupdate', updateProgress);
    return () => video.removeEventListener('timeupdate', updateProgress);
  }, [selectedPresetId, customVideoUrl, videoSourceIndex]);

  // When changing video preset
  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    setCustomVideoUrl(null);
    setCustomVideoName(null);
    setVideoSourceIndex(0);
    setVideoFailed(false);
    setIsPlaying(true);
  };

  // Custom Video File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCustomVideoUrl(url);
      setCustomVideoName(file.name);
      setVideoFailed(false);
      setIsPlaying(true);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch(() => {
          setIsPlaying(false);
        });
      }
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const handleVideoError = () => {
    if (!customVideoUrl && videoSourceIndex < currentPreset.sources.length - 1) {
      setVideoSourceIndex((prev) => prev + 1);
    } else {
      setVideoFailed(true);
    }
  };

  const filteredLanguages = useMemo(() => {
    return LANGUAGES.filter((lang) => {
      const matchesCategory = activeCategory === 'All' || lang.category === activeCategory;
      const matchesSearch = lang.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  const handleSelectLang = (lang: LanguageInfo) => {
    setSelectedLang(lang);
  };

  // Dynamic Spoken Voice Caption Lookup with 100% language coverage
  const captionData = useMemo(() => {
    if (customVideoUrl) {
      const isEnglish = selectedLang.name === 'English';
      const isHindi = selectedLang.name === 'Hindi' || selectedLang.name === 'Hinglish';
      let text = '';
      if (isEnglish) {
        text = `Auto-captions for ${customVideoName || 'video'}: High accuracy voice subtitles generated in real-time!`;
      } else if (isHindi) {
        text = scriptMode === 'native'
          ? `${customVideoName || 'वीडियो'} के ऑडियो कैप्शंस: ऑटो-सिंक्ड वायरल सबटाइटल्स!`
          : `${customVideoName || 'video'} ke audio captions: auto-synced viral subtitles!`;
      } else {
        text = `${selectedLang.name} subtitles for ${customVideoName || 'video'} — powered by Yourcaptions.in!`;
      }
      return { text, words: text.split(/\s+/).filter(Boolean) };
    }

    return getCaptionForLanguage(
      selectedLang.name,
      selectedLang.native,
      selectedPresetId,
      scriptMode
    );
  }, [customVideoUrl, customVideoName, selectedLang, selectedPresetId, scriptMode]);

  // Active word index calculated from video playback progress (0% - 100%)
  const activeWordIndex = useMemo(() => {
    if (!captionData.words.length) return 0;
    const idx = Math.floor((progress / 100) * captionData.words.length);
    return Math.min(idx, captionData.words.length - 1);
  }, [progress, captionData.words.length]);

  return (
    <div id="playground" className="relative w-full max-w-[1150px] mx-auto mt-12 p-[2px] rounded-[28px] overflow-hidden bg-gradient-to-b from-[#222] via-[#111] to-[#0a0a0a] shadow-[0_0_100px_rgba(230,0,0,0.12)]">
      {/* Red rotating border glow effect */}
      <div className="absolute inset-0 rounded-[28px] overflow-hidden pointer-events-none">
        <motion.div 
          className="absolute left-1/2 top-1/2 aspect-square w-[300%] bg-[conic-gradient(from_0deg,transparent_0_330deg,rgba(230,0,0,0.35)_345deg,rgba(230,0,0,0.95)_358deg,white_360deg)] opacity-70"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 5, ease: "linear" }}
          style={{ x: "-50%", y: "-50%" }}
        />
      </div>

      <div className="relative z-10 bg-[#0A0A0A] rounded-[26px] p-5 sm:p-7 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left Side: Interactive Animated Language Selector */}
          <div className="lg:col-span-6 bg-[#111111] border border-[#222222] rounded-[22px] p-5 sm:p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#E60000]" />
                  <h3 className="text-[18px] sm:text-[21px] font-extrabold text-white tracking-tight">
                    Select Caption Language
                  </h3>
                </div>
                <span className="text-[11px] font-semibold text-[#888] bg-[#181818] border border-[#2A2A2A] px-2.5 py-1 rounded-full">
                  {filteredLanguages.length} Languages
                </span>
              </div>

              {/* Search + Category Tabs */}
              <div className="space-y-3 mb-4">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#666]" />
                  <input
                    type="text"
                    placeholder="Search language (e.g. Hindi, Spanish, Arabic)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#181818] border border-[#262626] text-white placeholder-[#666] text-[12px] pl-8 pr-3 py-2 rounded-xl focus:outline-none focus:border-[#E60000] transition-colors"
                  />
                </div>

                {/* Category Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {[
                    { id: 'All', label: 'All' },
                    { id: 'Indian', label: 'Indian Desi' },
                    { id: 'Global', label: 'US & Global' },
                    { id: 'MiddleEast', label: 'Arabic & RTL' },
                    { id: 'Roman', label: 'Roman / Hinglish' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id as any)}
                      className={`text-[11px] px-3 py-1 rounded-full whitespace-nowrap transition-all font-semibold ${
                        activeCategory === cat.id
                          ? 'bg-[#E60000] text-white shadow-[0_0_12px_rgba(230,0,0,0.4)]'
                          : 'bg-[#181818] text-[#888] hover:text-white hover:bg-[#222]'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Language Grid with Animation */}
              <motion.div 
                layout
                className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[220px] sm:max-h-[260px] overflow-y-auto pr-1 custom-scrollbar"
              >
                <AnimatePresence>
                  {filteredLanguages.map((lang) => {
                    const isSelected = selectedLang.name === lang.name;
                    return (
                      <motion.button
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.15 }}
                        key={lang.name}
                        onClick={() => handleSelectLang(lang)}
                        className={`relative flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-full text-[12px] font-semibold transition-all duration-200 select-none ${
                          isSelected
                            ? 'bg-[#E60000]/15 text-[#FF4D4D] border border-[#E60000] shadow-[0_0_14px_rgba(230,0,0,0.35)] scale-[1.02]'
                            : 'bg-[#181818] text-[#999999] border border-[#262626] hover:text-white hover:border-[#444444] hover:bg-[#202020]'
                        }`}
                      >
                        {isSelected && (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          >
                            <Check className="w-3.5 h-3.5 text-[#E60000]" />
                          </motion.span>
                        )}
                        <span className="truncate">{lang.name}</span>
                      </motion.button>
                    );
                  })}
                </AnimatePresence>
              </motion.div>
            </div>

            <div className="mt-5 pt-3.5 border-t border-[#222222] flex items-center justify-between text-[12px] text-[#777777]">
              <span>100+ global languages auto-detected</span>
              <span className="text-[#E60000] font-bold">99.2% accuracy</span>
            </div>
          </div>

          {/* Right Side: High-Quality Video Player Component */}
          <div 
            className="lg:col-span-6 bg-black rounded-[22px] border border-[#222222] overflow-hidden relative flex flex-col justify-center items-center min-h-[340px] sm:min-h-[400px] shadow-2xl group cursor-pointer"
            onClick={togglePlay}
          >
            {!videoFailed ? (
              <video
                key={customVideoUrl || selectedPresetId}
                ref={videoRef}
                autoPlay
                loop
                muted={isMuted}
                playsInline
                onError={handleVideoError}
                className="absolute inset-0 w-full h-full object-cover"
                src={customVideoUrl || currentPreset.sources[videoSourceIndex]}
              />
            ) : (
              /* Animated Cinematic Video Simulation Fallback if network blocks external mp4s */
              <div className="absolute inset-0 bg-[#0d0d0d] flex items-center justify-center overflow-hidden">
                <motion.div
                  className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(230,0,0,0.25)_0%,transparent_70%)]"
                  animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.8, 0.4] }}
                  transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                />
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:24px_24px]" />
                <div className="relative z-10 text-center px-4">
                  <div className="w-16 h-16 rounded-full bg-[#E60000]/20 border border-[#E60000]/50 flex items-center justify-center mx-auto mb-3 text-[#E60000]">
                    <Captions className="w-8 h-8" />
                  </div>
                  <p className="text-white font-extrabold text-sm tracking-wide">Interactive Caption Video Player</p>
                  <p className="text-[#888] text-xs mt-1">Live voice & subtitle sync demonstration</p>
                </div>
              </div>
            )}

            {/* Video Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/40 pointer-events-none" />

            {/* ✨ INTERACTIVE CAPTION TEMPLATE SELECTOR (Top Left) ✨ */}
            <div className="absolute top-4 left-4 z-40" onClick={(e) => e.stopPropagation()}>
              <div className="relative">
                <button
                  onClick={() => setIsTemplateMenuOpen((prev) => !prev)}
                  className="bg-black/75 hover:bg-black/95 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 hover:border-white/40 text-white flex items-center gap-1.5 text-[11px] sm:text-[12px] font-bold shadow-xl transition-all active:scale-95 group"
                  title="Select Caption Template Style"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#E60000]" />
                  <span className="text-zinc-400 font-medium hidden xs:inline">Style:</span>
                  <span className="text-white font-extrabold flex items-center gap-1">
                    <span>{currentTemplate.icon}</span>
                    <span>{currentTemplate.label}</span>
                  </span>
                  <ChevronDown className={`w-3 h-3 text-zinc-400 transition-transform duration-200 ${isTemplateMenuOpen ? 'rotate-180 text-white' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                <AnimatePresence>
                  {isTemplateMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-10 left-0 w-64 sm:w-72 bg-[#0c0c0e]/95 backdrop-blur-xl border border-white/20 rounded-2xl p-2 shadow-[0_20px_50px_rgba(0,0,0,0.9)] z-50 space-y-1"
                    >
                      <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 flex items-center justify-between">
                        <span>Caption Templates</span>
                        <span className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded text-zinc-300">8 Styles</span>
                      </div>
                      <div className="max-h-[260px] overflow-y-auto custom-scrollbar space-y-1 pr-1">
                        {DEMO_CAPTION_TEMPLATES.map((tpl) => {
                          const isTplActive = tpl.id === selectedTemplateId;
                          return (
                            <button
                              key={tpl.id}
                              onClick={() => handleSelectTemplate(tpl)}
                              className={`w-full text-left px-2.5 py-2 rounded-xl flex items-center justify-between text-xs transition-all ${
                                isTplActive
                                  ? 'bg-white/15 text-white font-black border border-white/20'
                                  : 'text-zinc-300 hover:bg-white/10 hover:text-white border border-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <span className="text-base">{tpl.icon}</span>
                                <div>
                                  <div className="font-bold flex items-center gap-1.5 text-white">
                                    <span>{tpl.label}</span>
                                    {isTplActive && (
                                      <span className="text-[9px] bg-[#E60000] text-white px-1.5 py-0.2 rounded-full font-extrabold">Active</span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-zinc-400 truncate max-w-[170px]">{tpl.description}</div>
                                </div>
                              </div>
                              {isTplActive && <Check className="w-3.5 h-3.5 text-[#E60000] shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* 🔥 HIGH-IMPACT STUDIO VIRAL CAPTION OVERLAY WITH DYNAMIC TEMPLATE STYLING 🔥 */}
            <div className="absolute bottom-16 sm:bottom-20 left-3 right-3 z-30 flex flex-col items-center justify-center pointer-events-none text-center px-2">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${selectedLang.name}-${scriptMode}-${currentTemplate.id}`}
                  initial={{ opacity: 0, y: 12, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className={`max-w-[96%] px-4 sm:px-6 py-2.5 sm:py-3.5 rounded-2xl flex flex-col items-center transition-all duration-200 ${currentTemplate.containerClassName}`}
                >
                  {/* Active Template & Language Badge */}
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span
                      className="w-2 h-2 rounded-full animate-pulse"
                      style={{ backgroundColor: currentTemplate.dotColor, boxShadow: `0 0 8px ${currentTemplate.dotColor}` }}
                    />
                    <span className={`text-[10px] sm:text-[11px] font-black uppercase tracking-wider ${currentTemplate.badgeClassName}`}>
                      {currentTemplate.badgeText} · {selectedLang.name} · {scriptMode === 'roman' ? 'Roman Script' : 'Native Script'}
                    </span>
                  </div>

                  {/* Dynamic Word-by-Word Viral Subtitles with Real-Time Karaoke Sync in currentTemplate Style */}
                  <div className={`text-[16px] sm:text-[20px] md:text-[22px] leading-snug flex flex-wrap items-center justify-center gap-x-2 gap-y-1 ${currentTemplate.textClassName}`}>
                    {captionData.words.map((word, idx) => {
                      const isWordActive = idx === activeWordIndex;
                      return (
                        <span
                          key={idx}
                          className={`transition-all duration-150 inline-block px-1.5 py-0.5 rounded-md ${
                            isWordActive
                              ? currentTemplate.activeWordClassName
                              : currentTemplate.inactiveWordClassName
                          }`}
                        >
                          {word}
                        </span>
                      );
                    })}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Mute/Unmute Toggle Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMuted(!isMuted);
              }}
              className="absolute top-4 right-4 z-30 bg-black/60 hover:bg-black/90 backdrop-blur-md p-2.5 rounded-full border border-white/15 text-white/90 hover:text-white transition-all shadow-lg active:scale-95"
              title={isMuted ? "Unmute sound" : "Mute sound"}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-[#E60000]" />}
            </button>

            {/* Central Play/Pause Hover Overlay Icon */}
            <div className={`absolute inset-0 z-20 flex items-center justify-center transition-opacity duration-200 pointer-events-none ${!isPlaying ? 'opacity-100 bg-black/30' : 'opacity-0 group-hover:opacity-100'}`}>
              <div className="w-14 h-14 rounded-full bg-[#E60000]/90 text-white flex items-center justify-center shadow-[0_0_30px_rgba(230,0,0,0.6)] backdrop-blur-sm">
                {isPlaying ? <Pause className="w-6 h-6 fill-white" /> : <Play className="w-6 h-6 fill-white ml-1" />}
              </div>
            </div>

            {/* Video Timeline Scrubber */}
            <div className="absolute bottom-12 left-4 right-4 z-30 pointer-events-none">
              <div className="w-full bg-white/20 h-1 rounded-full overflow-hidden">
                <div 
                  className="bg-[#E60000] h-full transition-all duration-100 ease-linear shadow-[0_0_10px_#E60000]"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Bottom Controls: Quick Template Switcher Pills + Native / Roman Switcher */}
            <div 
              className="absolute bottom-3 left-3 right-3 z-30 flex items-center justify-between gap-2 pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Quick Template Switcher Pills */}
              <div className="flex items-center gap-1 bg-black/80 backdrop-blur-xl border border-white/15 p-1 rounded-full shadow-2xl overflow-x-auto no-scrollbar max-w-[65%] sm:max-w-[72%]">
                {DEMO_CAPTION_TEMPLATES.map((tpl) => {
                  const isTplActive = tpl.id === selectedTemplateId;
                  return (
                    <button
                      key={tpl.id}
                      onClick={() => handleSelectTemplate(tpl)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
                        isTplActive
                          ? 'bg-white text-black shadow-md font-extrabold scale-105'
                          : 'text-zinc-400 hover:text-white hover:bg-white/10'
                      }`}
                      title={tpl.description}
                    >
                      <span>{tpl.icon}</span>
                      <span className="hidden sm:inline">{tpl.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Native / Roman Universal Toggle Switcher */}
              <div className="flex items-center gap-1 bg-black/80 backdrop-blur-xl border border-white/15 p-1 rounded-full shadow-2xl shrink-0">
                <button
                  onClick={() => { setScriptMode('native'); setIsMuted(false); if (!isPlaying && videoRef.current) { videoRef.current.play(); setIsPlaying(true); } }}
                  className={`px-3 py-1 rounded-full text-[11px] sm:text-[12px] font-bold transition-all ${
                    scriptMode === 'native'
                      ? 'bg-[#E60000] text-white shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Native
                </button>
                <button
                  onClick={() => { setScriptMode('roman'); setIsMuted(false); if (!isPlaying && videoRef.current) { videoRef.current.play(); setIsPlaying(true); } }}
                  className={`px-3 py-1 rounded-full text-[11px] sm:text-[12px] font-bold transition-all ${
                    scriptMode === 'roman'
                      ? 'bg-[#E60000] text-white shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Roman
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}
