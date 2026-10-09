import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailPayload {
  templateName: "welcome" | "usage-alert" | "export-ready" | "payment-success" | "generic";
  recipientEmail: string;
  idempotencyKey?: string;
  templateData?: Record<string, any>;
}

function buildHtml(templateName: string, data: Record<string, any> = {}): { subject: string; html: string } {
  const brandGradient = "linear-gradient(135deg, #ef4444 0%, #ec4899 50%, #8b5cf6 100%)";
  const headerHtml = `
    <div style="background: #090a0f; padding: 32px 24px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.08); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="display: inline-block; padding: 6px 14px; border-radius: 9999px; background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #f87171; font-size: 13px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 12px;">
        YourCaptions.in
      </div>
      <h1 style="color: #ffffff; font-size: 24px; margin: 0; font-weight: 800; letter-spacing: -0.02em;">
        Studio-Grade Subtitles & Captions
      </h1>
    </div>
  `;

  const footerHtml = `
    <div style="background: #06070a; padding: 24px; text-align: center; color: #64748b; font-size: 12px; font-family: -apple-system, BlinkMacSystemFont, sans-serif; border-top: 1px solid rgba(255,255,255,0.06);">
      <p style="margin: 0 0 8px;">© ${new Date().getFullYear()} YourCaptions.in — AI-powered Captions for Indian & Global Creators.</p>
      <p style="margin: 0;"><a href="https://yourcaptions.in/dashboard" style="color: #ef4444; text-decoration: none;">Dashboard</a> · <a href="https://yourcaptions.in/pricing" style="color: #ef4444; text-decoration: none;">Plans</a> · <a href="mailto:support@yourcaptions.in" style="color: #64748b; text-decoration: underline;">Support</a></p>
    </div>
  `;

  const wrapContent = (inner: string) => `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin: 0; padding: 0; background-color: #030407; color: #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="max-width: 600px; margin: 30px auto; background: #0c0d14; border-radius: 16px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
        ${headerHtml}
        <div style="padding: 32px 28px; font-size: 15px; line-height: 1.6;">
          ${inner}
        </div>
        ${footerHtml}
      </div>
    </body>
    </html>
  `;

  switch (templateName) {
    case "welcome":
      return {
        subject: "Welcome to YourCaptions — Ready to create viral captions?",
        html: wrapContent(`
          <h2 style="color: #ffffff; margin-top: 0; font-size: 20px;">Welcome aboard, creator! 🚀</h2>
          <p>Thank you for joining <strong>YourCaptions.in</strong>. You now have access to high-accuracy AI captions powered by Sarvam AI (Indian regional languages) and Deepgram Nova-3 (global languages).</p>
          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 18px; margin: 24px 0;">
            <p style="margin: 0 0 10px; font-weight: 600; color: #f1f5f9;">What you can do right now:</p>
            <ul style="margin: 0; padding-left: 20px; color: #94a3b8;">
              <li>Upload your reel, short, or long-form video.</li>
              <li>Auto-detect speech with word-level millisecond sync.</li>
              <li>Choose Hormozi, Beast, or Cinema caption presets.</li>
              <li>Export up to 4K ultra-crisp resolution.</li>
            </ul>
          </div>
          <div style="text-align: center; margin-top: 28px;">
            <a href="https://yourcaptions.in/dashboard" style="background: ${brandGradient}; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; display: inline-block;">Start Your First Project →</a>
          </div>
        `),
      };

    case "usage-alert": {
      const pct = data.percentUsed ?? 80;
      const meter = data.meter ?? "processing minutes";
      return {
        subject: `⚠️ Usage Alert: You have used ${pct}% of your ${meter}`,
        html: wrapContent(`
          <h2 style="color: #f59e0b; margin-top: 0; font-size: 20px;">Usage Threshold Notice</h2>
          <p>You have consumed <strong>${pct}%</strong> of your monthly allocation for <strong>${meter}</strong>.</p>
          <div style="background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.3); border-radius: 10px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0; color: #fef3c7; font-size: 14px;">
              To prevent any interruption in your exports or transcription workflows, you can top up minutes anytime or upgrade to the next tier with 4K export and unlimited Brand Kits.
            </p>
          </div>
          <div style="text-align: center; margin-top: 24px;">
            <a href="https://yourcaptions.in/pricing" style="background: #ef4444; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 700; display: inline-block;">Upgrade Plan or Top Up →</a>
          </div>
        `),
      };
    }

    case "export-ready": {
      const projectName = data.projectName ?? "Your video";
      const downloadUrl = data.downloadUrl ?? "https://yourcaptions.in/dashboard";
      return {
        subject: `🎉 Your video "${projectName}" is ready to download!`,
        html: wrapContent(`
          <h2 style="color: #10b981; margin-top: 0; font-size: 20px;">Video Export Finished! 🎬</h2>
          <p>Your video <strong>${projectName}</strong> has been fully rendered with synced subtitles and is ready for download.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${downloadUrl}" style="background: ${brandGradient}; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; display: inline-block;">Download Rendered Video →</a>
          </div>
          <p style="font-size: 13px; color: #64748b; text-align: center;">You can also access and re-edit this project anytime in your dashboard.</p>
        `),
      };
    }

    case "payment-success": {
      const planName = data.planName ?? "Subscription Plan";
      const amount = data.amount ? `₹${(data.amount / 100).toFixed(0)}` : "";
      return {
        subject: `Receipt: Your upgrade to YourCaptions ${planName} is confirmed!`,
        html: wrapContent(`
          <h2 style="color: #10b981; margin-top: 0; font-size: 20px;">Payment Confirmed 🎉</h2>
          <p>Thank you for subscribing to <strong>YourCaptions ${planName}</strong> ${amount ? `(${amount})` : ""}. Your quota and features (1080p/4K export, Brand Kits, no watermarks) are now fully unlocked!</p>
          <div style="text-align: center; margin-top: 24px;">
            <a href="https://yourcaptions.in/dashboard" style="background: ${brandGradient}; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; display: inline-block;">Go to Studio Dashboard →</a>
          </div>
        `),
      };
    }


    default:
      return {
        subject: data.subject || "Notification from YourCaptions.in",
        html: wrapContent(`<p>${data.message || "Thank you for using YourCaptions.in."}</p>`),
      };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      console.warn("send-transactional-email: RESEND_API_KEY not configured, skipping send");
      return new Response(JSON.stringify({ ok: false, error: "RESEND_API_KEY not configured" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: EmailPayload = await req.json().catch(() => ({}));
    if (!payload.recipientEmail) {
      return new Response(JSON.stringify({ error: "recipientEmail is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { subject, html } = buildHtml(payload.templateName, payload.templateData);
    const fromEmail = Deno.env.get("EMAIL_FROM") || "YourCaptions <onboarding@resend.dev>";

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [payload.recipientEmail],
        subject,
        html,
      }),
    });

    const resData = await resendRes.json();
    if (!resendRes.ok) {
      console.error("Resend API error:", resData);
      return new Response(JSON.stringify({ ok: false, error: resData }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, emailId: resData.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
