const sections: { h: string; p: string[] }[] = [
  {
    h: "1. Agreement",
    p: [
      "By creating an account or using Yourcaptions.in (\"the Service\") you agree to these Terms of Service. If you are using the Service on behalf of an organization, you confirm you have authority to bind that organization.",
    ],
  },
  {
    h: "2. The Service",
    p: [
      "Yourcaptions provides AI-powered captioning, translation, dubbing, and video editing tools. Features and limits vary by plan and are described on our Pricing page.",
      "We continuously improve the Service. Features may be added, changed, or retired with reasonable notice.",
    ],
  },
  {
    h: "3. Your account",
    p: [
      "You are responsible for keeping your credentials secure and for all activity under your account. Notify us at security@Yourcaptions.in if you suspect unauthorized access.",
      "You must be at least 13 years old (16 in the EEA) to use Yourcaptions.",
    ],
  },
  {
    h: "4. Your content",
    p: [
      "You retain full ownership of everything you upload or generate through Yourcaptions.",
      "You grant us a limited, worldwide, royalty-free license to store, process, transcode, translate, and render your content solely to operate the Service on your behalf.",
      "You are responsible for having the rights to upload the content you process, including any music, footage, voices, or trademarks it contains.",
    ],
  },
  {
    h: "5. Acceptable use",
    p: [
      "Do not use Yourcaptions to create or distribute content that infringes rights, harasses, deceives, sexualizes minors, incites violence, or violates law.",
      "Do not reverse engineer, scrape, or resell the Service; do not upload malware; do not attempt to exceed rate limits or bypass credit systems.",
      "We may suspend or terminate accounts that violate these rules, with or without notice depending on severity.",
    ],
  },
  {
    h: "6. Billing and credits",
    p: [
      "Paid plans are billed monthly or annually via Stripe, Razorpay, or Paddle. Credits are consumed per minute of processed media as shown on the Pricing page.",
      "All fees are non-refundable except where required by law. You can cancel any time — access continues until the end of the current billing period.",
      "Unused monthly credits do not roll over. Top-up credits are valid for 12 months.",
    ],
  },
  {
    h: "7. Third-party services",
    p: [
      "The Service integrates with third-party providers (e.g. AI models, storage, payment processors). Your use of those integrations is also governed by their terms.",
    ],
  },
  {
    h: "8. Warranty disclaimer",
    p: [
      "The Service is provided \"as is\" without warranty of any kind. AI-generated output can contain errors — always review before publishing.",
    ],
  },
  {
    h: "9. Limitation of liability",
    p: [
      "To the maximum extent permitted by law, Yourcaptions is not liable for indirect, incidental, or consequential damages. Our total liability for any claim is limited to the fees you paid us in the 12 months before the claim.",
    ],
  },
  {
    h: "10. Termination",
    p: [
      "You can delete your account at any time from Settings → Account. We may suspend or terminate accounts for breach, non-payment, or legal reasons.",
      "On termination, your content is deleted within 30 days, except where retention is required by law.",
    ],
  },
  {
    h: "11. Changes to these terms",
    p: [
      "We may update these terms. Material changes will be notified by email or in-product notice at least 14 days before they take effect. Continued use after that constitutes acceptance.",
    ],
  },
  {
    h: "12. Governing law",
    p: [
      "These terms are governed by the laws of India, without regard to conflict of law rules. Disputes will be resolved in the courts of Bengaluru, India, unless mandatory local law provides otherwise.",
    ],
  },
  {
    h: "13. Contact",
    p: [
      "Questions about these terms? Email legal@Yourcaptions.in.",
    ],
  },
];

export default function Terms() {
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
            Terms of Service
          </h1>
          <p className="mt-5 text-[16px] leading-relaxed text-[#888]">
            The rules of the road for using Yourcaptions. We've written them in plain English wherever
            possible — but they're still a real contract, so please read them.
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
          Last updated July 1, 2026.
        </div>
      </div>
    </section>
  );
}
