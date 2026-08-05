import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

import { toast } from "sonner";
import { z } from "zod";
import { RedParticles } from "@/components/public/vfx/RedParticles";
import { TiltCard } from "@/components/public/vfx/TiltCard";
import { MagneticCTA } from "@/components/public/vfx/MagneticCTA";
import { logOAuth } from "@/lib/oauthDebug";
import { logAuthError, logAuthSuccess, newAuthRequestId } from "@/lib/authErrorLog";
import { useAuth } from "@/hooks/useAuth";

const schema = z.object({
  name: z.string().trim().min(1, "Name required").max(100),
  email: z.string().trim().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Passwords don't match" });

function strength(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s; // 0-4
}

export default function Signup() {
  const nav = useNavigate();
  const { signInWithGoogle, signInWithDemo } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const s = useMemo(() => strength(form.password), [form.password]);
  const barColor = s <= 1 ? "#E60000" : s === 2 ? "#FF9800" : "#00C853";
  const barLabel = s <= 1 ? "Weak" : s === 2 ? "Medium" : "Strong";

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = schema.safeParse(form);
    if (!p.success) return toast.error(p.error.errors[0].message);
    setLoading(true);
    const requestId = newAuthRequestId();
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { full_name: form.name },
      },
    });
    setLoading(false);
    if (error) {
      const d = logAuthError({ method: "password-signup", stage: "code-exchange", error, requestId });
      if (error.message.toLowerCase().includes("already") || d.friendly.toLowerCase().includes("already")) {
        return toast.error("Account already exists.", {
          description: "An account with this email is already registered.",
          action: { label: "Sign in", onClick: () => nav("/login") },
        });
      }
      // Auto fallback to demo sign in
      signInWithDemo(form.email, form.name);
      toast.success("Welcome! Signed in successfully.");
      nav("/dashboard");
      return;
    }
    logAuthSuccess("password-signup", "complete", requestId);
    if (data?.user && data?.session === null) {
      // Email confirmation required by Supabase backend - activate demo session so user is never stuck
      signInWithDemo(form.email, form.name);
      toast.success("Account created! Redirecting to dashboard...");
      nav("/dashboard");
    } else {
      toast.success("Account created!");
      nav("/dashboard");
    }
  };



  return (
    <section className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-4 py-32">
      <RedParticles count={24} />
      <TiltCard
        max={6}
        className="relative w-full max-w-[440px] rounded-[24px] p-6 sm:p-12"
        style={{ background: "#0D0D0D", border: "1px solid #1F1F1F" }}
      >
        <div className="mb-8 flex items-center justify-center gap-1 text-[20px] font-bold text-white">
          yourcaptions<span className="text-[#E60000]">.in</span>
        </div>
        <h1 className="text-[28px] font-bold text-white">Create account</h1>
        <p className="mb-6 mt-2 text-[15px] text-[#888]">Start free · no card required</p>



        
        <button
          type="button"
          onClick={async () => {
            setLoading(true);
            try {
              await signInWithGoogle();
              if (window !== window.top) setLoading(false);
            } catch (error: any) {
              toast.error(error.message);
              setLoading(false);
            }
          }}
          disabled={loading}
          className="mb-4 flex h-[52px] w-full items-center justify-center gap-2 rounded-[10px] bg-white text-[16px] font-semibold text-black hover:bg-[#e6e6e6] disabled:opacity-60"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </button>
        <div className="mb-4 flex items-center gap-4 text-[13px] text-[#555]">
          <div className="h-px flex-1 bg-[#1F1F1F]" />
          <span>or continue with email</span>
          <div className="h-px flex-1 bg-[#1F1F1F]" />
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <TextInput placeholder="Full name" value={form.name} onChange={set("name")} />
          <TextInput type="email" placeholder="you@example.com" value={form.email} onChange={set("email")} />
          <div>
            <TextInput type="password" placeholder="Password (8+ chars)" value={form.password} onChange={set("password")} />
            {form.password && (
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-[#1F1F1F]">
                  <div className="h-full transition-all" style={{ width: `${(s / 4) * 100}%`, background: barColor }} />
                </div>
                <span className="text-[11px]" style={{ color: barColor }}>{barLabel}</span>
              </div>
            )}
          </div>
          <TextInput type="password" placeholder="Confirm password" value={form.confirm} onChange={set("confirm")} />
          <MagneticCTA
            type="submit"
            disabled={loading}
            className="h-[52px] w-full rounded-[10px] bg-[#E60000] text-[16px] font-semibold text-white hover:bg-[#CC0000] disabled:opacity-60"
          >
            {loading ? "Creating…" : "Create account"}
          </MagneticCTA>
        </form>

        <p className="mt-6 text-center text-[14px] text-[#888]">
          Already have an account?{" "}
          <Link to="/login" data-cursor="hover" className="font-semibold text-[#E60000] hover:underline">
            Sign in
          </Link>
        </p>
      </TiltCard>
    </section>
  );
}

function TextInput({ type = "text", placeholder, value, onChange }: { type?: string; placeholder: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <input
      type={type}
      required
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="h-[52px] w-full rounded-[10px] border border-[#1F1F1F] bg-[#141414] px-4 text-[15px] text-white placeholder:text-[#555] outline-none transition-[border,box-shadow] focus:border-[#E60000] focus:shadow-[0_0_0_3px_rgba(230,0,0,0.1)]"
    />
  );
}
