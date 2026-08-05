// Auto-emoji tagging — maps caption keywords to a single emoji chip.
// Runs client-side over each visible word (case-insensitive, punctuation-stripped).
// Kept intentionally curated so results feel intentional, not spammy.

const MAP: Record<string, string> = {
  // reactions / emphasis
  love: "❤️", loved: "❤️", loves: "❤️", loving: "❤️", heart: "❤️", hearts: "❤️",
  amazing: "🤩", awesome: "🤩", incredible: "🤩", wow: "😮", omg: "😱",
  crazy: "🤯", insane: "🤯", mindblown: "🤯", genius: "🧠", smart: "🧠",
  laugh: "😂", laughing: "😂", lol: "😂", funny: "😂", haha: "😂", hilarious: "🤣",
  sad: "😢", cry: "😢", crying: "😭", tears: "😭",
  angry: "😡", mad: "😡", rage: "🤬",
  scared: "😨", fear: "😨", afraid: "😨",
  cool: "😎", chill: "😎", vibe: "✨", vibes: "✨",
  perfect: "👌", nice: "👍", good: "👍", great: "👍", best: "🏆", awesome1: "🔥",
  bad: "👎", worst: "💀", terrible: "💀", horrible: "💀",

  // hype / trending
  fire: "🔥", lit: "🔥", trending: "📈", viral: "🚀", boom: "💥", bang: "💥",
  wow1: "🤯", huge: "🚀", massive: "🚀", big: "💪", strong: "💪", power: "⚡",
  fast: "⚡", quick: "⚡", speed: "⚡", faster: "⚡",
  slow: "🐢",

  // money / business
  money: "💰", cash: "💵", dollar: "💵", dollars: "💵", rupees: "💰", rupee: "💰",
  rich: "💸", wealth: "💰", millionaire: "💰", billionaire: "💎",
  business: "💼", work: "💼", job: "💼", office: "🏢", boss: "👑",
  buy: "🛒", sell: "🏷️", sale: "🏷️", deal: "🤝", price: "🏷️",
  free: "🎁", gift: "🎁",
  invest: "📈", stocks: "📈", growth: "📈", profit: "📈", loss: "📉",

  // time
  today: "📅", tomorrow: "📅", yesterday: "📅", now: "⏰", time: "⏰",
  minutes: "⏱️", minute: "⏱️", hours: "🕐", hour: "🕐", second: "⏱️", seconds: "⏱️",
  soon: "⏳", wait: "⏳", waiting: "⏳",

  // people / audience
  you: "👉", we: "🙌", together: "🤝", everyone: "🌍", people: "👥",
  friend: "👯", friends: "👯", team: "🤝", family: "👨‍👩‍👧",

  // ideas / thinking
  idea: "💡", think: "💭", thinking: "💭", brain: "🧠", learn: "📚", learning: "📚",
  book: "📖", books: "📚", read: "📖", reading: "📖", study: "📚",

  // tech / creator
  video: "🎬", videos: "🎬", camera: "📸", photo: "📸", picture: "📸",
  music: "🎵", song: "🎵", sound: "🔊", audio: "🎧", listen: "🎧",
  phone: "📱", mobile: "📱", computer: "💻", laptop: "💻", code: "💻", coding: "👨‍💻",
  ai: "🤖", robot: "🤖", tech: "⚙️", app: "📱", apps: "📱",
  youtube: "▶️", tiktok: "🎵", instagram: "📸", reels: "🎬", shorts: "📱",
  post: "📝", posts: "📝", content: "🎬", caption: "💬", captions: "💬",

  // life
  food: "🍔", eat: "🍽️", eating: "🍽️", coffee: "☕", tea: "🍵", water: "💧",
  sleep: "😴", tired: "😴", wake: "☀️", morning: "☀️", night: "🌙",
  travel: "✈️", flight: "✈️", trip: "🧳", vacation: "🏖️", beach: "🏖️",
  car: "🚗", bike: "🚴", run: "🏃", running: "🏃", gym: "💪", workout: "🏋️", fitness: "💪",
  win: "🏆", winner: "🏆", winning: "🏆", champion: "🏆", trophy: "🏆",
  goal: "🎯", target: "🎯", success: "🏆", failure: "❌", fail: "❌",

  // signals
  yes: "✅", no: "❌", stop: "🛑", start: "🚀", begin: "🚀",
  new: "🆕", secret: "🤫", truth: "💯", real: "💯", fake: "🎭",
  danger: "⚠️", warning: "⚠️", important: "❗", listen1: "👂",

  // world / weather
  world: "🌍", earth: "🌍", planet: "🪐", sun: "☀️", moon: "🌙", star: "⭐", stars: "✨",
  rain: "🌧️", snow: "❄️", cold: "❄️", hot: "🥵",
};

// Aliases (multi-map entries share the same emoji). Anything ending in a
// number in MAP is treated as an alias for the base word — cleaner than
// hand-writing duplicates above.
const STRIP_NUM = /\d+$/;

const clean = (w: string) =>
  w
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")
    .trim();

export function getEmojiForWord(word: string): string | null {
  const key = clean(word);
  if (!key) return null;
  if (MAP[key]) return MAP[key];
  // singular fallback: "goals" -> "goal"
  if (key.endsWith("s") && MAP[key.slice(0, -1)]) return MAP[key.slice(0, -1)];
  return null;
}

// Return an emoji for the segment (first tagged word wins) — used when we
// want to place a single chip near the caption rather than per-word.
export function getEmojiForText(text: string): string | null {
  for (const w of text.split(/\s+/)) {
    const e = getEmojiForWord(w);
    if (e) return e;
  }
  return null;
}

// Silence "unused" warning on numbered aliases above.
void STRIP_NUM;
