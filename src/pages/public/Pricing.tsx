import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { TiltCard } from "@/components/public/vfx/TiltCard";
import { MagneticCTA } from "@/components/public/vfx/MagneticCTA";
import { Reveal } from "@/components/public/vfx/Reveal";
import { usePlanPricing } from "@/hooks/usePlanPricing";

type Plan = {
  name: string;
  id: string;
  icon: string;
  monthly: number;
  yearly: number;
  yearlyStrike: number;
  label: string;
  features: string[];
  popular?: boolean;
};

const defaultPlans: Plan[] = [
  {
    name: "Editor",
    id: "editor",
    icon: "◆",
    monthly: 499,
    yearly: 416,
    yearlyStrike: 558,
    label: "Key features",
    features: [
      "120 monthly processing minutes",
      "Up to 30-minute single video",
      "1 GB max upload size",
      "1080p high-quality export",
      "Custom font uploads",
      "Advanced AI transcription",
      "Standard support"
    ],
  },
  {
    name: "Creator",
    id: "creator",
    icon: "▲",
    monthly: 999,
    yearly: 833,
    yearlyStrike: 1042,
    label: "Everything in Editor, plus",
    popular: true,
    features: [
      "300 monthly processing minutes",
      "Up to 60-minute single video",
      "2 GB max upload size",
      "4K stunning export quality",
      "Multi-language translation",
      "Speaker detection (up to 5 presets)",
      "Up to 2 Brand Kits"
    ],
  },
  {
    name: "Studio",
    id: "studio",
    icon: "♛",
    monthly: 2599,
    yearly: 2166,
    yearlyStrike: 2900,
    label: "Everything in Creator, plus",
    features: [
      "720 monthly processing minutes",
      "Up to 120-minute single video",
      "5 GB max upload size",
      "Unlimited speaker presets",
      "Unlimited Brand Kits",
      "Unlimited branding layers",
      "24/7 Priority support"
    ],
  }
];

const faqs = [
  { q: "What counts as a transcription hour?", a: "One transcription hour equals 60 minutes of source video processed through our ASR pipeline, measured to the second." },
  { q: "Can I upgrade or downgrade anytime?", a: "Yes. Changes take effect immediately, and we prorate credits so you never pay twice for the same minute." },
  { q: "Is GST included in the price shown?", a: "Prices are exclusive of 18% GST, which is added at checkout for Indian customers." },
  { q: "What happens when I run out of credits?", a: "You can top up instantly with one-click credit packs, or wait for your monthly refill." },
  { q: "Do unused credits roll over to next month?", a: "Subscription credits do not roll over. Top-up credits stay in your wallet forever until used." },
];

export default function Pricing() {
  const [yearly, setYearly] = useState(false);
  const { data: pricingData } = usePlanPricing('INR');

  const plans = useMemo(() => {
    if (!pricingData) return defaultPlans;
    return defaultPlans.map((p) => {
      const dbPrice = pricingData.find(d => d.plan === p.id);
      if (dbPrice) {
        return {
          ...p,
          monthly: dbPrice.monthly_price,
          yearly: dbPrice.yearly_price,
          yearlyStrike: dbPrice.original_yearly ?? p.yearlyStrike,
        };
      }
      return p;
    });
  }, [pricingData]);

  return (
    <div className="bg-[#050505] pt-32 pb-24">
      <section className="mx-auto max-w-4xl px-6 py-16 text-center">
        <Reveal>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#E60000]">Pricing</div>
        </Reveal>
        <Reveal delay={100}>
          <h1
            className="mt-6 font-extrabold text-white"
            style={{ fontSize: "clamp(40px,6vw,96px)", letterSpacing: "-0.03em", lineHeight: 1 }}
          >
            Simple. Honest. Worth every{" "}
            <span style={{ fontFamily: '"DM Serif Display", serif', fontStyle: "italic", color: "#E60000", fontWeight: 400 }}>
              rupee
            </span>
            .
          </h1>
        </Reveal>
        <Reveal delay={250}>
          <p className="mx-auto mt-6 max-w-lg text-[17px] text-[#888]">Start free. Scale as you grow. No hidden fees.</p>
        </Reveal>

        <Reveal delay={400}>
          <div className="mt-12 flex flex-col items-center gap-3">
            <div className="inline-flex rounded-full border border-[#2A2A2A] bg-[#0D0D0D] p-1">
              {["Monthly", "Yearly"].map((l, i) => {
                const active = (i === 1) === yearly;
                return (
                  <button
                    key={l}
                    data-cursor="hover"
                    onClick={() => setYearly(i === 1)}
                    className={`rounded-full px-6 py-2 text-[13px] font-semibold transition-colors ${
                      active ? "bg-[#E60000] text-white" : "text-[#888] hover:text-white"
                    }`}
                  >
                    {l}
                  </button>
                );
              })}
            </div>
          </div>
        </Reveal>
      </section>

      <section className="mx-auto grid max-w-[1100px] items-stretch gap-6 px-6 pt-8 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((p) => (
          <div key={p.name} className={p.popular ? "relative pt-4 h-full" : "h-full"}>
            {p.popular && (
              <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#E60000] px-4 py-1 text-[10px] font-semibold text-white z-10">
                Most popular
              </div>
            )}
            <TiltCard
              max={8}
              className="flex h-full flex-col rounded-[20px] p-6 lg:p-7"
              style={{
                background: "#0D0D0D",
                border: p.popular ? "1px solid #E60000" : "1px solid #1F1F1F",
                boxShadow: p.popular ? "0 0 60px rgba(230,0,0,0.15), 0 0 120px rgba(230,0,0,0.06)" : "none",
              }}
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#E60000]/10 text-[18px] text-[#E60000]">
                {p.icon}
              </div>
              <div className="text-[18px] font-bold text-white">{p.name}</div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-[36px] font-extrabold leading-none text-white">
                  ₹{(yearly ? p.yearly : p.monthly).toLocaleString("en-IN")}
                </span>
                <span className="text-[14px] text-[#888]">/month</span>
              </div>
              {yearly && p.yearlyStrike > 0 ? (
                <div className="mt-1 text-[12px] text-[#555]">
                  <span className="line-through">₹{p.yearlyStrike.toLocaleString("en-IN")}</span> · billed yearly {p.monthly > 0 ? '· + 18% GST' : ''}
                </div>
              ) : (
                <div className="mt-1 text-[12px] text-[#555]">{p.monthly > 0 ? '+ 18% GST' : 'No hidden fees'}</div>
              )}
              <Link to={p.monthly === 0 ? "/signup" : "/pricing"} className="mt-5 block">
                <MagneticCTA
                  className={`w-full rounded-lg py-2.5 text-[14px] font-semibold ${
                    p.popular
                      ? "bg-[#E60000] text-white hover:bg-[#CC0000]"
                      : "border border-[#2A2A2A] text-white hover:bg-white hover:text-black"
                  }`}
                >
                  {p.monthly === 0 ? "Get Started" : "Upgrade"}
                </MagneticCTA>
              </Link>
              <div className="my-6 h-px shrink-0 bg-[#1F1F1F]" />
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#E60000]">{p.label}</div>
              <ul className="mt-4 flex-1 space-y-2.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[13px] text-[#888]">
                    <span className="mt-[2px] text-[#E60000]">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </TiltCard>
          </div>
        ))}
      </section>

      <section className="mx-auto mt-32 max-w-3xl px-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#E60000]">FAQ</div>
        <h2 className="mt-4 text-[36px] font-bold text-white">Questions, answered.</h2>
        <div className="mt-8">
          {faqs.map((f, i) => (
            <Faq key={i} q={f.q} a={f.a} />
          ))}
        </div>
      </section>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[#1F1F1F]">
      <button
        data-cursor="hover"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between py-5 text-left"
      >
        <span className="text-[16px] font-semibold text-white">{q}</span>
        <span className="text-[20px] text-[#E60000]">{open ? "−" : "+"}</span>
      </button>
      <div
        className="overflow-hidden text-[15px] text-[#888] transition-[max-height,opacity] duration-300"
        style={{ maxHeight: open ? 200 : 0, opacity: open ? 1 : 0 }}
      >
        <p className="pb-5 leading-relaxed">{a}</p>
      </div>
    </div>
  );
}
