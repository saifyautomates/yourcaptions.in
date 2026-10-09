import { useState } from "react";
import { toast } from "sonner";

export default function Contact() {
  const [sending, setSending] = useState(false);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSending(true);
    setTimeout(() => {
      setSending(false);
      toast.success("Message sent. We'll get back within 24 hours.");
      (e.target as HTMLFormElement).reset();
    }, 900);
  };

  return (
    <section className="relative min-h-[100dvh] bg-[#050505] px-6 pt-32 pb-32">
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-14 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#1F1F1F] bg-[#0B0B0B]/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#E60000]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#E60000]" />
            We reply within 24 hours
          </div>
          <h1
            className="text-white"
            style={{ fontSize: "clamp(40px,6vw,72px)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }}
          >
            Let's talk captions.
          </h1>
          <p className="mx-auto mt-5 max-w-[560px] text-[16px] leading-relaxed text-[#888]">
            Questions, feedback, enterprise plans, or partnerships — pick the fastest channel below or drop
            us a note.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-[1fr_1.2fr]">
          <div className="space-y-4">
            {[
              {
                title: "Support",
                desc: "Product questions, bug reports, billing.",
                value: "support@yourcaptions.in",
              },
              {
                title: "Sales & Enterprise",
                desc: "Teams, agencies, custom volumes, SSO.",
                value: "sales@yourcaptions.in",
              },
              {
                title: "Press",
                desc: "Media kits, interviews, partnerships.",
                value: "press@yourcaptions.in",
              },
              {
                title: "Office",
                desc: "Remote-first. Registered in Bengaluru, India.",
                value: "Mon–Fri · 10am–7pm IST",
              },
            ].map((c) => (
              <div
                key={c.title}
                className="rounded-2xl border border-[#1F1F1F] bg-[#0B0B0B] p-6 transition-colors hover:border-[#2A2A2A]"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#E60000]">
                  {c.title}
                </div>
                <div className="mt-2 text-[15px] font-semibold text-white">{c.value}</div>
                <div className="mt-1 text-[13px] text-[#888]">{c.desc}</div>
              </div>
            ))}
          </div>

          <form
            onSubmit={onSubmit}
            className="rounded-2xl border border-[#1F1F1F] bg-gradient-to-b from-[#0C0C0C] to-[#080808] p-8"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-medium uppercase tracking-wider text-[#888]">
                  Name
                </span>
                <input
                  required
                  name="name"
                  className="w-full rounded-lg border border-[#1F1F1F] bg-[#050505] px-4 py-3 text-[14px] text-white placeholder-[#444] outline-none focus:border-[#E60000]"
                  placeholder="Your full name"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-medium uppercase tracking-wider text-[#888]">
                  Email
                </span>
                <input
                  required
                  type="email"
                  name="email"
                  className="w-full rounded-lg border border-[#1F1F1F] bg-[#050505] px-4 py-3 text-[14px] text-white placeholder-[#444] outline-none focus:border-[#E60000]"
                  placeholder="you@studio.com"
                />
              </label>
            </div>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-[12px] font-medium uppercase tracking-wider text-[#888]">
                Topic
              </span>
              <select
                name="topic"
                className="w-full rounded-lg border border-[#1F1F1F] bg-[#050505] px-4 py-3 text-[14px] text-white outline-none focus:border-[#E60000]"
              >
                <option>Product support</option>
                <option>Sales & Enterprise</option>
                <option>Partnership</option>
                <option>Press</option>
                <option>Feedback</option>
              </select>
            </label>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-[12px] font-medium uppercase tracking-wider text-[#888]">
                Message
              </span>
              <textarea
                required
                name="message"
                rows={6}
                className="w-full resize-none rounded-lg border border-[#1F1F1F] bg-[#050505] px-4 py-3 text-[14px] text-white placeholder-[#444] outline-none focus:border-[#E60000]"
                placeholder="Tell us what you need. The more detail, the faster we can help."
              />
            </label>
            <button
              type="submit"
              disabled={sending}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#E60000] px-6 py-3.5 text-[14px] font-semibold text-white transition-transform hover:scale-[1.01] disabled:opacity-60"
            >
              {sending ? "Sending…" : "Send message →"}
            </button>
            <p className="mt-3 text-center text-[12px] text-[#555]">
              By sending, you agree to our Privacy Policy. We never share your email.
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}
