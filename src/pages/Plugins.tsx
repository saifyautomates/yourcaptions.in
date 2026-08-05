import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

const tools = ["Premiere Pro", "Final Cut", "DaVinci", "CapCut", "YouTube", "Instagram", "TikTok", "Shorts"];

const Plugins = () => (
  <>
    <SiteHeader />
    <main className="px-6 py-24">
      <div className="mx-auto max-w-6xl rounded-3xl border border-border bg-card/40 p-10 text-center backdrop-blur">
        <h1 className="text-3xl font-bold md:text-4xl">Works with your favourite tools</h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Plug captions.io into your existing workflow — from Premiere Pro to Final Cut and every social platform.
        </p>
        <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
          {tools.map((name) => (
            <div key={name} className="rounded-xl border border-border bg-background/40 py-5 text-sm font-medium text-muted-foreground">
              {name}
            </div>
          ))}
        </div>
      </div>
    </main>
    <SiteFooter />
  </>
);

export default Plugins;
