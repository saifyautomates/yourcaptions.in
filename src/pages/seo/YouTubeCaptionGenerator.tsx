import React from 'react';
import { SEO } from '@/components/SEO';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';

export default function YouTubeCaptionGenerator() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO 
        page="home" 
        customTitle="YouTube Caption Generator — Auto Subtitles for YouTube | yourcaptions"
        customDescription="Add Captions to Your YouTube Videos Automatically. Generate SRT files or burn subtitles directly into your video."
      />
      
      <main className="container mx-auto px-4 py-16">
        <header className="text-center mb-16">
          <h1 className="text-5xl font-bold tracking-tight mb-6 text-foreground">
            Add Captions to Your YouTube Videos Automatically
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Boost your YouTube SEO and audience retention with perfect closed captions. Export directly to SRT or hardcode stylish subtitles in one click.
          </p>
          <div className="flex gap-4 justify-center">
            <Button asChild size="lg" className="text-lg px-8">
              <Link to="/signup">Try free — no credit card</Link>
            </Button>
          </div>
        </header>

        <section className="grid md:grid-cols-2 gap-8 mb-24">
          <div className="p-8 rounded-2xl bg-card border border-border">
            <h2 className="text-2xl font-semibold mb-4">Why YouTube needs captions</h2>
            <ul className="space-y-4 text-muted-foreground">
              <li className="flex gap-2"><CheckCircle2 className="text-primary" /> Boosts search ranking on YouTube</li>
              <li className="flex gap-2"><CheckCircle2 className="text-primary" /> Increases viewer retention by 80%</li>
              <li className="flex gap-2"><CheckCircle2 className="text-primary" /> Reaches a global audience</li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}
