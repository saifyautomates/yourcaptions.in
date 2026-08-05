const sections: { h: string; p: string[] }[] = [
  {
    h: "1. Who we are",
    p: [
      "Yourcaptions.in (\"Yourcaptions\", \"we\", \"us\") provides an AI-powered captioning, translation and dubbing platform. This Privacy Policy explains what personal data we collect, why we collect it, and the rights you have over it.",
      "This policy applies to Yourcaptions.in and any related services, apps, and browser extensions.",
    ],
  },
  {
    h: "2. Data we collect",
    p: [
      "Account data: name, email, password hash, avatar, and authentication provider identifiers.",
      "Usage data: pages viewed, features used, credit consumption, project metadata, device and browser information, IP address, and approximate location.",
      "Content data: videos, audio, transcripts, translations, captions, and any assets you upload or generate inside Yourcaptions.",
      "Payment data: handled by our payment processors (Stripe, Razorpay, Paddle). We store only the last four digits and card brand for receipts — we never store full card numbers.",
    ],
  },
  {
    h: "3. How we use your data",
    p: [
      "To operate the service — transcribe, translate, render, export, and store your projects.",
      "To improve accuracy — anonymized and aggregated usage signals help us tune the models. You can opt out in Settings → Privacy.",
      "To communicate — product updates, security alerts, and receipts. Marketing emails are opt-in only.",
      "To keep the platform safe — fraud prevention, abuse detection, and compliance with law.",
    ],
  },
  {
    h: "4. Data sharing",
    p: [
      "We share data with vetted sub-processors that power the platform: cloud hosting, AI transcription and translation providers, analytics, error reporting, and email delivery. A full list is available on request.",
      "We do not sell your personal data. We never train third-party models on your uploaded content.",
    ],
  },
  {
    h: "5. Storage and retention",
    p: [
      "Project files are stored on encrypted object storage in the region closest to you (US, EU, or IN).",
      "Deleted projects are permanently removed within 30 days. Account data is retained for the life of the account and deleted within 90 days of account closure.",
    ],
  },
  {
    h: "6. Your rights",
    p: [
      "You can access, export, correct, or delete your personal data at any time from Settings → Privacy, or by writing to privacy@Yourcaptions.in.",
      "EU/UK residents have rights under GDPR. California residents have rights under CCPA. Indian residents have rights under the DPDP Act, 2023.",
    ],
  },
  {
    h: "7. Security",
    p: [
      "We use TLS 1.3 for data in transit and AES-256 for data at rest. Access to production systems is limited, audited, and MFA-protected.",
      "Report a security concern to security@Yourcaptions.in — we respond within 24 hours.",
    ],
  },
  {
    h: "8. Children",
    p: [
      "Yourcaptions is not intended for children under 13 (or under 16 in the EEA). We do not knowingly collect data from children.",
    ],
  },
  {
    h: "9. Changes",
    p: [
      "We may update this policy. If changes are material we will notify you by email or in-product notice at least 14 days before they take effect.",
    ],
  },
  {
    h: "10. Contact",
    p: [
      "Questions about this policy? Email privacy@Yourcaptions.in or write to our Data Protection Officer at the same address.",
    ],
  },
];

export default function Privacy() {
  return (
    <section className="relative min-h-[100dvh] bg-[#050505] px-6 pt-32 pb-32">
      <div className="mx-auto max-w-[820px]">
        <div className="mb-12">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#1F1F1F] bg-[#0B0B0B]/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#E60000]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#E60000]" />
            Effective July 1, 2026
          </div>
          <h1
            className="text-white"
            style={{ fontSize: "clamp(40px,6vw,64px)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }}
          >
            Privacy Policy
          </h1>
          <p className="mt-5 text-[16px] leading-relaxed text-[#888]">
            We built Yourcaptions around a simple rule: your content is yours. This policy explains exactly
            what we collect, how we use it, and the controls you always have.
          </p>
        </div>

        <div className="space-y-10">
          {sections.map((s) => (
            <section key={s.h}>
              <h2 className="text-[20px] font-bold text-white" style={{ letterSpacing: "-0.01em" }}>
                {s.h}
              </h2>
              <div className="mt-3 space-y-3">
                {s.p.map((line, i) => (
                  <p key={i} className="text-[15px] leading-[1.7] text-[#a0a0a0]">
                    {line}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-16 rounded-2xl border border-[#1F1F1F] bg-[#0B0B0B] p-6 text-[13px] text-[#666]">
          Last updated July 1, 2026. Previous versions available on request.
        </div>
      </div>
    </section>
  );
}
