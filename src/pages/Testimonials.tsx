import { Star, Quote } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

const testimonials = [
  { name: "Aarav Sharma",  role: "YouTuber",         handle: "@aaravsharma",  followers: "1.2M subs",   quote: "captions.io cut my captioning time by 90%. The Hindi accuracy is unreal — feels like a native editor did it." },
  { name: "Priya Nair",    role: "Content Studio",   handle: "@priyacreates", followers: "Studio Lead", quote: "Finally a tool that understands regional languages the way we actually speak them. Malayalam and Tamil out of the box." },
  { name: "Zeeshan Khan",  role: "Reels Creator",    handle: "@zeereels",     followers: "480K",        quote: "The animated caption styles look like they came straight out of a design studio. Urdu support is chef's kiss." },
  { name: "María González",role: "Podcaster",        handle: "@mariagpodcast",followers: "Top 50 podcast", quote: "Dubbing my Spanish podcast into English and Portuguese used to take days. Now it's done before I finish my coffee." },
  { name: "Kenji Watanabe",role: "Anime Reviewer",   handle: "@kenjianime",   followers: "820K",        quote: "The Japanese → English translations preserve the tone. No other tool has come close for me." },
  { name: "Ade Adebayo",   role: "Educator",         handle: "@adeteaches",   followers: "Yoruba creator", quote: "Being able to caption in Yoruba, Swahili and English on the same video changed my reach overnight." },
];

const initials = (name: string) => name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

const Testimonials = () => (
  <>
    <SiteHeader />
    <main className="px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">Loved by creators, worldwide</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            100,000+ creators across 40+ countries ship faster with captions.io.
          </p>
          <div className="mt-4 flex items-center justify-center gap-1.5">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="h-4 w-4 fill-primary text-primary" />
            ))}
            <span className="ml-2 text-sm font-semibold">4.9 · 12,400 reviews</span>
          </div>
        </div>
        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t) => (
            <figure
              key={t.name}
              className="relative rounded-2xl border border-border bg-card/60 p-7 transition-colors hover:border-primary/40"
            >
              <Quote className="absolute right-5 top-5 h-6 w-6 text-primary/20" />
              <div className="mb-3 flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-primary text-primary" />
                ))}
              </div>
              <blockquote className="text-sm text-foreground/90">"{t.quote}"</blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                  {initials(t.name)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{t.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {t.role} · <span className="text-primary/80">{t.followers}</span>
                  </div>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </main>
    <SiteFooter />
  </>
);

export default Testimonials;
