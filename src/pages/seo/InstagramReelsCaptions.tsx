import React from 'react';
import { SEO } from '@/components/SEO';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';

export default function InstagramReelsCaptions() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO 
        page="home" 
        customTitle="Instagram Reels Caption Generator — Auto Subtitles | yourcaptions"
        customDescription="Generate dynamic, engaging captions for your Instagram Reels. Used by top creators."
      />
      
      <main className="container mx-auto px-4 py-16">
        <header className="text-center mb-16">
          <h1 className="text-5xl font-bold tracking-tight mb-6 text-foreground">
            Captions for Instagram Reels in 2 Minutes
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Create Hormozi-style dynamic captions for your Instagram Reels effortlessly. Keep scrollers engaged and watching till the end.
          </p>
          <div className="flex gap-4 justify-center">
            <Button asChild size="lg" className="text-lg px-8">
              <Link to="/signup">Try free — no credit card</Link>
            </Button>
          </div>
        </header>

        <section className="grid md:grid-cols-3 gap-8 mb-24">
          {[
            { title: "Dynamic Animations", desc: "Highlight words dynamically as they are spoken." },
            { title: "Emoji Generation", desc: "Auto-add relevant emojis to make text pop." },
            { title: "Vertical Video Ready", desc: "Optimized safe zones for IG Reels UI." }
          ].map((feature, i) => (
            <div key={i} className="p-6 rounded-2xl bg-card border border-border">
              <CheckCircle2 className="w-8 h-8 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.desc}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
