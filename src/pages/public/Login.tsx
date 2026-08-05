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
import { Card, CardContent } from "@/components/ui/card";
import { scrollReveal } from "@/lib/animations";
import { Eye, EyeOff, AlertCircle } from "lucide-react";

export default function Login() {
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<{ message: string; requestId?: string } | null>(null);
  const [lastAttempt, setLastAttempt] = useState<null | (() => void)>(null);
  
  const nextParam = new URLSearchParams(loc.search).get("next");
  const stateFrom = (loc.state as any)?.from;
  const destination = sanitizeRedirectUrl(stateFrom || nextParam || "/dashboard", "/dashboard");

  const attemptPassword = async () => {
    setAuthError(null);
    setLoading(true);
    const requestId = newAuthRequestId();
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      
      if (error) {
        logAuthError({ method: "password-signin", stage: "code-exchange", error, requestId });
        setAuthError({ message: error.message, requestId });
        return;
      }
      
      logAuthSuccess("password-signin", "complete", requestId, { userId: data.user?.id });
      toast.success("Welcome back!");
      nav(destination, { replace: true });
    } catch (err: any) {
      setLoading(false);
      setAuthError({ message: err?.message || "An unexpected error occurred" });
    }
  };

  const { signInWithGoogle } = useAuth();
  
  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithGoogle(destination);
      if (window !== window.top) setLoading(false);
    } catch (error: any) {
      toast.error(error.message);
      setLoading(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => { e.preventDefault(); void attemptPassword(); };

  return (
    <section className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-4 py-16 bg-[var(--bg-1)]">
      {/* Subtle Red Ambient Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[var(--red-3)]/5 rounded-full blur-[120px] pointer-events-none" />
      
      <motion.div variants={scrollReveal} initial="initial" animate="animate" className="w-full max-w-[420px] relative z-10">
        <Card hoverEffects className="p-8 sm:p-12 border-[var(--border-3)] bg-[var(--bg-2)]/80 backdrop-blur-xl">
          <div className="mb-8 flex items-center justify-center gap-1 text-2xl font-bold font-display text-[var(--text-1)]">
            yourcaptions<span className="text-[var(--red-3)]">.in</span>
          </div>
          
          <h1 className="text-3xl font-bold font-display text-[var(--text-1)] tracking-tight">Welcome back</h1>
          <p className="mb-8 mt-2 text-sm text-[var(--text-4)]">Sign in to your account</p>

          {authError && (
            <div role="alert" className="mb-6 rounded-[10px] border border-[var(--error)] bg-[var(--error)]/10 p-4 text-sm text-[var(--error)] flex gap-3 items-start">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Sign-in failed</div>
                <div className="mt-1 opacity-90">{authError.message}</div>
                {authError.requestId && (
                  <div className="mt-2 text-[10px] opacity-70">Request ID: {authError.requestId}</div>
                )}
                <div className="mt-3 flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => nav("/forgot-password")} className="border-[var(--error)] text-[var(--error)] hover:bg-[var(--error)] hover:text-white">
                    Forgot Password?
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
            className="w-full bg-white text-black hover:bg-gray-100 hover:text-black mb-4 gap-3 border-transparent"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </Button>

          <div className="mb-6 flex items-center gap-4 text-xs font-semibold text-[var(--text-5)] uppercase tracking-wider">
            <div className="h-px flex-1 bg-[var(--border-3)]" />
            <span>or continue with email</span>
            <div className="h-px flex-1 bg-[var(--border-3)]" />
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <Input 
              type="email" 
              placeholder="you@example.com" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
            />
            <div className="relative">
              <Input
                type={showPw ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-5)] hover:text-[var(--text-2)] transition-colors p-1"
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            
            <div className="text-right">
              <Link to="/forgot-password" className="text-xs font-semibold text-[var(--red-3)] hover:underline underline-offset-2">
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              variant="default"
              size="lg"
              className="w-full shadow-red-sm"
              loading={loading}
              magnetic
            >
              Sign In
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-[var(--text-4)]">
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
