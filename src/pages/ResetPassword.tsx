import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logAuthError, logAuthSuccess, newAuthRequestId } from "@/lib/authErrorLog";
import { RedParticles } from "@/components/public/vfx/RedParticles";
import { TiltCard } from "@/components/public/vfx/TiltCard";
import { MagneticCTA } from "@/components/public/vfx/MagneticCTA";

type Phase = "checking" | "ready" | "no-session";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<Phase>("checking");

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setPhase("ready");
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setPhase((prev) => (prev === "ready" ? prev : data.session ? "ready" : "no-session"));
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("At least 8 characters");
    setLoading(true);
    const requestId = newAuthRequestId();

    const { error } = await supabase.auth.updateUser({ password });

    setLoading(false);
    if (error) {
      const detail = logAuthError({ method: "password-update", stage: "code-exchange", error, requestId });
      return toast.error(detail.friendly, { description: `Request ID: ${requestId}` });
    }
    logAuthSuccess("password-update", "complete", requestId);
    toast.success("Password updated");
    navigate("/dashboard");
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

        {phase === "checking" && (
          <>
            <h1 className="text-[28px] font-bold text-white">Verifying reset link</h1>
            <p className="mb-6 mt-2 text-[15px] text-[#888]">One moment...</p>
            <div className="py-6 text-center text-sm text-[#555]">Loading…</div>
          </>
        )}

        {phase === "no-session" && (
          <>
            <h1 className="text-[28px] font-bold text-white">Link expired</h1>
            <p className="mb-6 mt-2 text-[15px] text-[#888]">
              The recovery session isn't active. This usually happens when the link was already used or has expired.
            </p>
            <Link
              to="/forgot-password"
              className="flex h-[52px] w-full items-center justify-center rounded-[10px] bg-[#E60000] text-[16px] font-semibold text-white hover:bg-[#CC0000]"
            >
              Request a new reset link
            </Link>
          </>
        )}

        {phase === "ready" && (
          <>
            <h1 className="text-[28px] font-bold text-white">Set new password</h1>
            <p className="mb-6 mt-2 text-[15px] text-[#888]">Enter your new password below.</p>
            <form onSubmit={onSubmit} className="space-y-4">
              <input 
                required 
                type="password" 
                placeholder="New password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-[52px] w-full rounded-[10px] border border-[#1F1F1F] bg-[#141414] px-4 text-[15px] text-white placeholder:text-[#555] outline-none transition-[border,box-shadow] focus:border-[#E60000] focus:shadow-[0_0_0_3px_rgba(230,0,0,0.1)]" 
              />
              <MagneticCTA 
                type="submit" 
                disabled={loading}
                className="mt-2 flex h-[52px] w-full items-center justify-center rounded-[10px] bg-[#E60000] text-[16px] font-semibold text-white hover:bg-[#CC0000] disabled:opacity-60"
              >
                {loading ? "Updating…" : "Update password"}
              </MagneticCTA>
            </form>
          </>
        )}
      </TiltCard>
    </section>
  );
};

export default ResetPassword;
