import React from 'react';
import { SEO } from '@/components/SEO';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';

export default function HindiCaptionGenerator() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO 
        page="home" 
        customTitle="Free Hindi Caption Generator — Auto Subtitles in Hindi | yourcaptions"
        customDescription="Auto-generate accurate Hindi subtitles in 2 minutes. Free to start. Perfect for YouTube, Reels, and TikTok."
      />
      
      <main className="container mx-auto px-4 py-16">
        <header className="text-center mb-16">
          <h1 className="text-5xl font-bold tracking-tight mb-6 text-foreground">
            Generate Perfect Hindi Captions in 2 Minutes
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Stop manually typing subtitles. Our AI understands regional Indian accents and accurately generates Hindi subtitles for your videos automatically.
          </p>
          <div className="flex gap-4 justify-center">
            <Button asChild size="lg" className="text-lg px-8">
              <Link to="/signup">Try free — no credit card</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-lg px-8">
              <Link to="/features">See all features</Link>
            </Button>
          </div>
        </header>

        <section className="grid md:grid-cols-3 gap-8 mb-24">
          {[
            { title: "Native Hindi AI", desc: "Trained specifically on Indian accents and Hinglish mix." },
            { title: "Frame-Accurate Timing", desc: "Words highlight exactly as you speak them." },
            { title: "One-Click Export", desc: "Download as SRT, VTT, or hardcode into a 4K video." }
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
