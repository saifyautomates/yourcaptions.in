import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const schema = z.object({
  name: z.string().trim().max(100).optional().or(z.literal("")),
  email: z.string().trim().email("Invalid email").max(255).optional().or(z.literal("")),
  message: z.string().trim().min(3, "Tell us a bit more").max(2000, "Too long"),
});

export function HeroFeedbackForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ name, email, message });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const { data: userRes } = await supabase.auth.getUser();
    const { error } = await supabase.from("feedback_submissions").insert({
      name: name.trim() || null,
      email: email.trim() || null,
      message: message.trim(),
      user_id: userRes.user?.id ?? null,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Couldn't send. Try again.");
      return;
    }
    setDone(true);
    setName(""); setEmail(""); setMessage("");
    toast.success("Thanks! We read every message.");
  }

  return (
    <div className="mx-auto mt-16 w-full max-w-[640px] rounded-2xl border border-[#1F1F1F] bg-[#0B0B0B] p-6 text-left sm:p-8">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#FF4D4D]">
        Help us improve
      </div>
      <h3 className="text-[22px] font-bold text-white sm:text-[26px]">
        What can we do better?
      </h3>
      <p className="mt-1 text-[14px] text-[#A3A3A3]">
        Missing a feature, hit a bug, or have an idea? Drop it here — it goes straight to the team.
      </p>
      {done ? (
        <div className="mt-6 rounded-xl border border-[#E60000]/40 bg-[#E60000]/10 p-5 text-center">
          <div className="text-[16px] font-semibold text-white">Got it. Thank you 🙏</div>
          <button
            onClick={() => setDone(false)}
            className="mt-3 text-[13px] text-[#FF4D4D] underline underline-offset-4 hover:text-white"
          >
            Send another
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-5 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="text"
              placeholder="Your name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              className="w-full rounded-lg border border-[#2A2A2A] bg-[#050505] px-4 py-3 text-[14px] text-white placeholder:text-[#666] focus:border-[#E60000] focus:outline-none"
            />
            <input
              type="email"
              placeholder="Email (optional)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={255}
              className="w-full rounded-lg border border-[#2A2A2A] bg-[#050505] px-4 py-3 text-[14px] text-white placeholder:text-[#666] focus:border-[#E60000] focus:outline-none"
            />
          </div>
          <textarea
            placeholder="Tell us what to build, fix or change…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={2000}
            rows={4}
            required
            className="w-full resize-y rounded-lg border border-[#2A2A2A] bg-[#050505] px-4 py-3 text-[14px] text-white placeholder:text-[#666] focus:border-[#E60000] focus:outline-none"
          />
          <div className="flex items-center justify-between gap-4">
            <span className="text-[12px] text-[#666]">{message.length}/2000</span>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-[#E60000] px-6 py-3 text-[14px] font-bold text-white shadow-[0_0_40px_rgba(230,0,0,0.35)] transition hover:bg-[#CC0000] disabled:opacity-60"
            >
              {submitting ? "Sending…" : "Send feedback →"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
