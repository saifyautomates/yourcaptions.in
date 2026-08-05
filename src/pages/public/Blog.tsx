import { Link } from "react-router-dom";

const posts = [
  {
    slug: "word-level-captions-2026",
    tag: "Product",
    date: "Jul 18, 2026",
    read: "6 min read",
    title: "Why word-level timing is the only caption standard that matters in 2026",
    excerpt:
      "Sentence-level captions were a workaround for slow models. Word-level alignment changes how viewers read, retain, and reshare short-form video. Here's the data — and how we built it.",
  },
  {
    slug: "translate-100-languages",
    tag: "Engineering",
    date: "Jul 04, 2026",
    read: "9 min read",
    title: "Translating 100+ languages without losing the creator's voice",
    excerpt:
      "Machine translation is easy. Preserving tone, slang, cultural references and lip-sync timing is not. A look inside the pipeline that powers Yourcaptions in Hindi, Urdu, Tamil, Arabic and 90+ more.",
  },
  {
    slug: "hooked-in-3-seconds",
    tag: "Playbook",
    date: "Jun 21, 2026",
    read: "4 min read",
    title: "Hooked in 3 seconds: caption patterns that keep watch-time above 80%",
    excerpt:
      "We analyzed 2M+ clips shipped through Yourcaptions to find the exact caption sizes, colors, timings and highlight styles top creators use to stop the scroll.",
  },
  {
    slug: "dubbing-vs-captions",
    tag: "Guide",
    date: "Jun 09, 2026",
    read: "5 min read",
    title: "Dubbing vs. captions: when to use which for global reach",
    excerpt:
      "Captions expand reach. Dubbing expands trust. Use them together for maximum retention — here's a decision framework and channel-by-channel benchmarks.",
  },
  {
    slug: "creator-economy-india",
    tag: "Story",
    date: "May 28, 2026",
    read: "7 min read",
    title: "How Indian creators are winning global audiences with Hinglish captions",
    excerpt:
      "From Mumbai reels to LA algorithms — the rise of Hinglish caption styling and why Yourcaptions ships six Indic scripts natively.",
  },
  {
    slug: "keyboard-first-editor",
    tag: "Design",
    date: "May 12, 2026",
    read: "5 min read",
    title: "Designing a keyboard-first caption editor that feels like a NLE",
    excerpt:
      "Space to play, J/K/L to scrub, ⌘Z with 50-step history. Why we treated captions like an editing timeline, not a text box.",
  },
];

export default function Blog() {
  return (
    <section className="relative min-h-[100dvh] bg-[#050505] px-6 pt-32 pb-32">
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-16 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#1F1F1F] bg-[#0B0B0B]/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#E60000]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#E60000]" />
            The Yourcaptions blog
          </div>
          <h1
            className="text-white"
            style={{ fontSize: "clamp(40px,6vw,72px)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }}
          >
            Craft, engineering, and the future of captions.
          </h1>
          <p className="mx-auto mt-5 max-w-[620px] text-[16px] leading-relaxed text-[#888]">
            Notes from the team building Yourcaptions — plus playbooks, benchmarks and interviews from the
            creators shipping in every language.
          </p>
        </div>

        <article className="mb-14 overflow-hidden rounded-3xl border border-[#1F1F1F] bg-gradient-to-b from-[#0C0C0C] to-[#080808]">
          <div className="grid gap-0 md:grid-cols-[1.1fr_1fr]">
            <div className="relative min-h-[280px] bg-[#0A0A0A]">
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(ellipse 500px 350px at 30% 40%, rgba(230,0,0,0.22), transparent 70%)",
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-[120px] font-black leading-none tracking-[-0.06em] text-white/[0.04]">
                  yc
                </div>
              </div>
            </div>
            <div className="flex flex-col justify-center p-10">
              <div className="mb-3 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#E60000]">
                Featured · {posts[0].tag}
              </div>
              <h2
                className="text-white"
                style={{ fontSize: "clamp(24px,3vw,36px)", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.1 }}
              >
                {posts[0].title}
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-[#888]">{posts[0].excerpt}</p>
              <div className="mt-6 flex items-center gap-3 text-[13px] text-[#666]">
                <span>{posts[0].date}</span>
                <span className="h-1 w-1 rounded-full bg-[#333]" />
                <span>{posts[0].read}</span>
              </div>
            </div>
          </div>
        </article>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.slice(1).map((p) => (
            <article
              key={p.slug}
              className="group flex h-full flex-col rounded-2xl border border-[#1F1F1F] bg-[#0B0B0B] p-7 transition-colors hover:border-[#2A2A2A]"
            >
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#E60000]">
                {p.tag}
              </div>
              <h3
                className="text-white transition-colors group-hover:text-white"
                style={{ fontSize: "20px", fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.25 }}
              >
                {p.title}
              </h3>
              <p className="mt-3 flex-1 text-[14px] leading-relaxed text-[#888]">{p.excerpt}</p>
              <div className="mt-6 flex items-center gap-3 text-[12px] text-[#666]">
                <span>{p.date}</span>
                <span className="h-1 w-1 rounded-full bg-[#333]" />
                <span>{p.read}</span>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-20 rounded-3xl border border-[#1F1F1F] bg-[#0A0A0A] p-10 text-center">
          <h3
            className="text-white"
            style={{ fontSize: "clamp(24px,3vw,36px)", fontWeight: 800, letterSpacing: "-0.02em" }}
          >
            Get the next post in your inbox.
          </h3>
          <p className="mx-auto mt-3 max-w-[520px] text-[15px] text-[#888]">
            One email per month. Product deep-dives, creator playbooks, no spam.
          </p>
          <Link
            to="/signup"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#E60000] px-6 py-3 text-[14px] font-semibold text-white transition-transform hover:scale-[1.02]"
          >
            Subscribe →
          </Link>
        </div>
      </div>
    </section>
  );
}
