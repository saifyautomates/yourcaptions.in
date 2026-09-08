import React, { useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logAuthError, logAuthSuccess, newAuthRequestId } from "@/lib/authErrorLog";
import { useAuth } from "@/hooks/useAuth";
import { sanitizeRedirectUrl } from "@/lib/authRedirect";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { scrollReveal } from "@/lib/animations";
import { Eye, EyeOff, AlertCircle, Mail, KeyRound, CheckCircle2 } from "lucide-react";

export default function Login() {
  const nav = useNavigate();
  const loc = useLocation();
  const [authMode, setAuthMode] = useState<"password" | "magic-link">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [authError, setAuthError] = useState<{ message: string; requestId?: string } | null>(null);
  
  const nextParam = new URLSearchParams(loc.search).get("next");
  const stateFrom = (loc.state as any)?.from;
  const destination = sanitizeRedirectUrl(stateFrom || nextParam || "/dashboard", "/dashboard");

  const { signInWithPassword, signInWithGoogle } = useAuth();

  const attemptPassword = async () => {
    setAuthError(null);
    setLoading(true);
    const requestId = newAuthRequestId();
    try {
      const { user, error } = await signInWithPassword(email, password);
      
      if (error) {
        setLoading(false);
        logAuthError({ method: "password-signin", stage: "code-exchange", error, requestId });
        setAuthError({ message: error.message, requestId });
        return;
      }
      
      if (user) {
        logAuthSuccess("password-signin", "complete", requestId, { userId: user.id });
        toast.success("Welcome back!");
        nav(destination, { replace: true });
      }
    } catch (err: any) {
      setLoading(false);
      setAuthError({ message: err?.message || "An unexpected error occurred" });
    }
  };

  const attemptMagicLink = async () => {
    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    setAuthError(null);
    setLoading(true);
    const requestId = newAuthRequestId();
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}${destination}`,
        },
      });

      setLoading(false);
      if (error) {
        logAuthError({ method: "magiclink-signin" as any, stage: "initiate", error, requestId });
        setAuthError({ message: error.message, requestId });
        return;
      }

      logAuthSuccess("magiclink-signin" as any, "complete", requestId);
      setMagicLinkSent(true);
      toast.success("Magic link sent! Please check your email.");
    } catch (err: any) {
      setLoading(false);
      setAuthError({ message: err?.message || "Failed to send magic link" });
    }
  };
  
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setAuthError(null);
    try {
      await signInWithGoogle(destination);
      if (window !== window.top) setLoading(false);
    } catch (error: any) {
      setLoading(false);
      setAuthError({
        message: error.message || "Google sign-in is currently unavailable. Please use email & password or Magic Link.",
      });
      toast.error("Google sign-in failed. Please use email & password below.");
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (authMode === "password") {
      void attemptPassword();
    } else {
      void attemptMagicLink();
    }
  };

  return (
    <section className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-4 py-16 bg-[var(--bg-1)]">
      {/* Subtle Red Ambient Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[var(--red-3)]/5 rounded-full blur-[120px] pointer-events-none" />
      
      <motion.div variants={scrollReveal} initial="initial" animate="animate" className="w-full max-w-[440px] relative z-10">
        <Card hoverEffects className="p-8 sm:p-10 border-[var(--border-3)] bg-[var(--bg-2)]/80 backdrop-blur-xl shadow-2xl">
          <div className="mb-6 flex items-center justify-center gap-1 text-2xl font-bold font-display text-[var(--text-1)]">
            yourcaptions<span className="text-[var(--red-3)]">.in</span>
          </div>
          
          <h1 className="text-2xl sm:text-3xl font-bold font-display text-[var(--text-1)] tracking-tight text-center">Welcome back</h1>
          <p className="mb-6 mt-1 text-sm text-[var(--text-4)] text-center">Sign in to your account to continue</p>

          {authError && (
            <div role="alert" className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400 flex gap-3 items-start">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-semibold text-red-300">Sign-in issue</div>
                <div className="mt-1 text-xs sm:text-sm opacity-90 leading-relaxed">{authError.message}</div>
                {authError.requestId && (
                  <div className="mt-2 text-[10px] opacity-70">Request ID: {authError.requestId}</div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setAuthMode("magic-link");
                      setAuthError(null);
                    }}
                    className="border-red-500/40 text-red-300 hover:bg-red-500/20 text-xs h-7 px-2.5"
                  >
                    Try Magic Link
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => nav("/forgot-password")}
                    className="border-red-500/40 text-red-300 hover:bg-red-500/20 text-xs h-7 px-2.5"
                  >
                    Reset Password
                  </Button>
                </div>
              </div>
            </div>
          )}

          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={handleGoogleSignIn}
            loading={loading}
            className="w-full bg-white text-black hover:bg-gray-100 hover:text-black mb-5 gap-3 border-transparent font-medium"
          >
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </Button>

          <div className="mb-5 flex items-center gap-3 text-xs font-semibold text-[var(--text-5)] uppercase tracking-wider">
            <div className="h-px flex-1 bg-[var(--border-3)]" />
            <span>or sign in with email</span>
            <div className="h-px flex-1 bg-[var(--border-3)]" />
          </div>

          {/* Mode Switcher */}
          <div className="mb-4 grid grid-cols-2 p-1 rounded-xl bg-[var(--bg-3)] border border-[var(--border-3)] text-xs font-medium">
            <button
              type="button"
              onClick={() => {
                setAuthMode("password");
                setMagicLinkSent(false);
              }}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all ${
                authMode === "password"
                  ? "bg-[var(--bg-1)] text-[var(--text-1)] font-semibold shadow-sm"
                  : "text-[var(--text-4)] hover:text-[var(--text-2)]"
              }`}
            >
              <KeyRound size={14} />
              Password
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode("magic-link");
              }}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all ${
                authMode === "magic-link"
                  ? "bg-[var(--bg-1)] text-[var(--text-1)] font-semibold shadow-sm"
                  : "text-[var(--text-4)] hover:text-[var(--text-2)]"
              }`}
            >
              <Mail size={14} />
              Magic Link
            </button>
          </div>

          {magicLinkSent && authMode === "magic-link" ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center space-y-3">
              <CheckCircle2 className="mx-auto text-emerald-400 h-8 w-8" />
              <div className="font-semibold text-emerald-300">Magic Link Sent!</div>
              <p className="text-xs text-[var(--text-3)]">
                We sent a secure login link to <strong className="text-white">{email}</strong>. Check your inbox and spam folder.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMagicLinkSent(false)}
                className="mt-2 text-xs border-[var(--border-3)] text-[var(--text-2)]"
              >
                Send to a different email
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <Input 
                  type="email" 
                  placeholder="name@example.com" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                  autoComplete="email"
                />
              </div>

              {authMode === "password" && (
                <div>
                  <div className="relative">
                    <Input
                      type={showPw ? "text" : "password"}
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-5)] hover:text-[var(--text-2)] transition-colors p-1"
                      aria-label={showPw ? "Hide password" : "Show password"}
                    >
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  
                  <div className="mt-2 flex justify-between items-center text-xs">
                    <button
                      type="button"
                      onClick={() => setAuthMode("magic-link")}
                      className="text-[var(--text-4)] hover:text-[var(--text-2)] transition-colors"
                    >
                      Sign in without password
                    </button>
                    <Link to="/forgot-password" className="font-semibold text-[var(--red-3)] hover:underline underline-offset-2">
                      Forgot password?
                    </Link>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                variant="default"
                size="lg"
                className="w-full shadow-red-sm"
                loading={loading}
                magnetic
              >
                {authMode === "password" ? "Sign In" : "Send Magic Link"}
              </Button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-[var(--text-4)]">
            Don't have an account?{" "}
            <Link to="/signup" className="font-semibold text-[var(--red-3)] hover:underline underline-offset-2">
              Sign up
            </Link>
          </p>
        </Card>
      </motion.div>
    </section>
  );
}

