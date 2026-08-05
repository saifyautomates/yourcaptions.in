import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logAuthError, logAuthSuccess, newAuthRequestId } from "@/lib/authErrorLog";
import { RedParticles } from "@/components/public/vfx/RedParticles";
import { TiltCard } from "@/components/public/vfx/TiltCard";
import { MagneticCTA } from "@/components/public/vfx/MagneticCTA";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const requestId = newAuthRequestId();

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);

    if (error) {
      const detail = logAuthError({
        method: "password-reset-request", stage: "initiate", error, requestId,
        context: { email_domain: email.split("@")[1] ?? null },
      });
      return toast.error(detail.friendly, { description: `Request ID: ${requestId}` });
    }
    
    logAuthSuccess("password-reset-request", "complete", requestId);
    setSent(true);
    toast.success("Reset link sent — check your email.");
  };

  return (
    <section className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-4 py-32">
      <RedParticles count={24} />
      <TiltCard
        max={6}
        className="relative w-full max-w-[420px] rounded-[24px] p-6 sm:p-12"
        style={{ background: "#0D0D0D", border: "1px solid #1F1F1F" }}
      >
        <div className="mb-8 flex items-center justify-center gap-1 text-[20px] font-bold text-white">
          yourcaptions<span className="text-[#E60000]">.in</span>
        </div>
        
        <h1 className="text-[28px] font-bold text-white">Reset password</h1>
        <p className="mb-6 mt-2 text-[15px] text-[#888]">
          We'll email you a link to set a new password.
        </p>

        {sent ? (
          <div className="mb-4 rounded-[10px] border border-[#1F1F1F] bg-[#141414] p-6 text-center text-[15px] text-[#888]">
            Check <span className="text-white">{email}</span> for a reset link.
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <input 
              required 
              type="email" 
              placeholder="you@example.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-[52px] w-full rounded-[10px] border border-[#1F1F1F] bg-[#141414] px-4 text-[15px] text-white placeholder:text-[#555] outline-none transition-[border,box-shadow] focus:border-[#E60000] focus:shadow-[0_0_0_3px_rgba(230,0,0,0.1)]" 
            />
            <MagneticCTA 
              type="submit" 
              disabled={loading}
              className="mt-2 flex h-[52px] w-full items-center justify-center rounded-[10px] bg-[#E60000] text-[16px] font-semibold text-white hover:bg-[#CC0000] disabled:opacity-60"
            >
              {loading ? "Sending…" : "Send reset link"}
            </MagneticCTA>
          </form>
        )}

        <p className="mt-6 text-center text-[14px] text-[#888]">
          Remembered it?{" "}
          <Link to="/login" data-cursor="hover" className="font-semibold text-[#E60000] hover:underline">
            Back to sign in
          </Link>
        </p>
      </TiltCard>
    </section>
  );
};

export default ForgotPassword;
