import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";
import { inspectCallbackUrl, logOAuth } from "@/lib/oauthDebug";
import { identifyUser } from "@/lib/observability";
import { sanitizeRedirectUrl } from "@/lib/authRedirect";
import { toast } from "sonner";
import { useCreditStore } from "@/stores/creditStore";
import { realtimeSync } from "@/lib/realtimeSync";

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
  plan: string;
  creditsSeconds?: number;
}

export interface UserCreditsState {
  balance: number;
  planCredits: number;
  topupCredits: number;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  credits: UserCreditsState;
  isAdmin: boolean;
  loading: boolean;
  hydrating: boolean;
  slow: boolean;
  /** Populated when getSession()/getUser() failed with a non-recoverable error. */
  error: Error | null;
  /** Manually retry session hydration after a network/auth failure. */
  retry: () => void;
  /** Refresh user profile, credits, and admin permissions */
  refreshUserData: () => Promise<void>;
  /** Atomic email/password sign-in with full data hydration before completion */
  signInWithPassword: (email: string, password: string) => Promise<{ user: User | null; session: Session | null; error: Error | null }>;
  /** Atomic sign-up with optional automatic hydration */
  signUp: (params: { email: string; password: string; fullName?: string }) => Promise<{ user: User | null; session: Session | null; error: Error | null }>;
  signOut: () => Promise<void>;
  signInWithGoogle: (returnTo?: string) => Promise<void>;
}

const SLOW_LOAD_MS = 6000;
const ADMIN_EMAILS = new Set(["jackxparrowww@gmail.com", "saifyautomates@gmail.com"]);

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  profile: null,
  credits: { balance: 0, planCredits: 0, topupCredits: 0 },
  isAdmin: false,
  loading: true,
  hydrating: false,
  slow: false,
  error: null,
  retry: () => {},
  refreshUserData: async () => {},
  signInWithPassword: async () => ({ user: null, session: null, error: null }),
  signUp: async () => ({ user: null, session: null, error: null }),
  signOut: async () => {},
  signInWithGoogle: async () => {},
});

const hasValidSub = (sess: Session | null) => {
  if (!sess?.access_token) return true;
  try {
    let base64 = sess.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }
    const payload = JSON.parse(atob(base64));
    return typeof payload?.sub === "string" && payload.sub.length > 0;
  } catch { 
    // If we can't parse the JWT, trust Supabase's session validation
    return true; 
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [credits, setCredits] = useState<UserCreditsState>({ balance: 0, planCredits: 0, topupCredits: 0 });
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hydrating, setHydrating] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const mountedRef = useRef(true);

  // Helper to fully hydrate user data (profile, credits, role) concurrently
  const hydrateUserData = useCallback(async (activeUser: User | null) => {
    if (!activeUser) {
      setProfile(null);
      setCredits({ balance: 0, planCredits: 0, topupCredits: 0 });
      setIsAdmin(false);
      return;
    }

    setHydrating(true);
    const userId = activeUser.id;
    const userEmail = (activeUser.email || "").toLowerCase();

    try {
      const [profileRes, roleRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, avatar_url, plan, credits_seconds")
          .eq("id", userId)
          .maybeSingle(),
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("role", "admin")
          .maybeSingle()
      ]);

      if (!mountedRef.current) return;

      // 1. Profile Hydration
      let profileData = profileRes.data;
      const defaultFullName = activeUser.user_metadata?.full_name || activeUser.email?.split("@")[0] || "User";
      
      // Auto-provision profile row if missing
      if (!profileData && !profileRes.error) {
        try {
          const { data: createdProfile } = await supabase
            .from("profiles")
            .upsert({
              id: userId,
              full_name: defaultFullName,
              plan: "starter",
              credits_seconds: 1800,
            }, { onConflict: "id" })
            .select("id, full_name, avatar_url, plan, credits_seconds")
            .maybeSingle();
          if (createdProfile) {
            profileData = createdProfile;
          }
        } catch {
          // non-blocking fallback
        }
      }

      const hydratedProfile: UserProfile = {
        id: userId,
        fullName: profileData?.full_name || defaultFullName,
        email: activeUser.email || "",
        avatarUrl: profileData?.avatar_url || activeUser.user_metadata?.avatar_url,
        plan: profileData?.plan || "starter",
        creditsSeconds: profileData?.credits_seconds ?? 1800,
      };
      setProfile(hydratedProfile);

      // 2. Credits Hydration (stored in profiles.credits_seconds)
      const totalCreditsSeconds = profileData?.credits_seconds ?? 1800;
      const creditState: UserCreditsState = {
        balance: totalCreditsSeconds,
        planCredits: totalCreditsSeconds,
        topupCredits: 0,
      };
      setCredits(creditState);
      useCreditStore.getState().setCredits(totalCreditsSeconds, 0);

      // 3. Admin Status Hydration
      const adminByEmail = Boolean(userEmail && ADMIN_EMAILS.has(userEmail));
      const adminByRole = Boolean(roleRes.data?.role === "admin");
      setIsAdmin(adminByEmail || adminByRole);

      // 4. Initialize realtime sync
      void realtimeSync.initialize();
    } catch (e) {
      console.warn("Hydration failed gracefully:", e);
    } finally {
      if (mountedRef.current) {
        setHydrating(false);
      }
    }
  }, []);

  const refreshUserData = useCallback(async () => {
    if (user) {
      await hydrateUserData(user);
    }
  }, [user, hydrateUserData]);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInErr) {
        setLoading(false);
        return { user: null, session: null, error: signInErr };
      }

      if (data.session && data.user) {
        setSession(data.session);
        setUser(data.user);
        identifyUser({ id: data.user.id, email: data.user.email ?? null });
        await hydrateUserData(data.user);
      }

      setLoading(false);
      return { user: data.user, session: data.session, error: null };
    } catch (err: any) {
      setLoading(false);
      return { user: null, session: null, error: err };
    }
  }, [hydrateUserData]);

  const signUp = useCallback(async ({ email, password, fullName }: { email: string; password: string; fullName?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: fullName ? { full_name: fullName } : undefined,
        },
      });

      if (signUpErr) {
        setLoading(false);
        return { user: null, session: null, error: signUpErr };
      }

      if (data.session && data.user) {
        setSession(data.session);
        setUser(data.user);
        identifyUser({ id: data.user.id, email: data.user.email ?? null });
        await hydrateUserData(data.user);
      }

      setLoading(false);
      return { user: data.user, session: data.session, error: null };
    } catch (err: any) {
      setLoading(false);
      return { user: null, session: null, error: err };
    }
  }, [hydrateUserData]);

  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    setSlow(false);
    setRetryTick((n) => n + 1);
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    logOAuth("session-restore-start", {
      href: typeof window !== "undefined" ? window.location.href : "",
      hasHash: typeof window !== "undefined" ? Boolean(window.location.hash) : false,
      hasSearch: typeof window !== "undefined" ? Boolean(window.location.search) : false,
    });

    const cb = inspectCallbackUrl();
    if (cb) {
      logOAuth("callback-return", cb);
      if (cb.providerError) {
        logOAuth("code-exchange-error", {
          reason: "provider-returned-error",
          error: cb.providerError,
          description: cb.providerErrorDescription,
        });
      } else if (cb.code) {
        logOAuth("code-exchange-start", { codePreview: cb.code });
      }
    }

    // Slow-load timer
    const slowTimer = window.setTimeout(() => {
      if (mountedRef.current) setSlow(true);
    }, SLOW_LOAD_MS);

    let isPopup = false;
    try {
      isPopup = typeof window !== 'undefined' && Boolean(window.opener) && (window.name === 'oauth_popup' || new URLSearchParams(window.location.search).get('popup') === '1');
    } catch {
      isPopup = false;
    }
    const { data: sub } = supabase.auth.onAuthStateChange(async (evt, sess) => {
      if (!mountedRef.current) return;

      logOAuth("auth-state-change", {
        event: evt,
        hasSession: Boolean(sess),
        userId: sess?.user?.id ?? null,
        provider: sess?.user?.app_metadata?.provider ?? null,
        expiresAt: sess?.expires_at ?? null,
      });

      if (sess && !hasValidSub(sess)) {
        try { await supabase.auth.signOut({ scope: "local" }); } catch { /* noop */ }
        setSession(null);
        setUser(null);
        setProfile(null);
        setIsAdmin(false);
        setError(null);
        if (evt !== "INITIAL_SESSION") setLoading(false);
        logOAuth("session-missing", { reason: "stale-jwt-purged-onchange", event: evt });
        return;
      }

      setSession(sess);
      setUser(sess?.user ?? null);
      setError(null);

      if (sess?.user) {
        identifyUser({ id: sess.user.id, email: sess.user.email ?? null });
        await hydrateUserData(sess.user);
      } else {
        identifyUser(null);
        setProfile(null);
        setIsAdmin(false);
        setCredits({ balance: 0, planCredits: 0, topupCredits: 0 });
      }

      if (evt !== "INITIAL_SESSION") setLoading(false);

      if (evt === "SIGNED_IN") {
        logOAuth("code-exchange-success", { userId: sess?.user?.id });
        logOAuth("session-created", {
          userId: sess?.user?.id,
          provider: sess?.user?.app_metadata?.provider ?? null,
        });
        
        if (isPopup && sess) {
          try { window.opener.postMessage({ type: "OAUTH_SUCCESS", session: { access_token: sess.access_token, refresh_token: sess.refresh_token } }, "*"); } catch (e) { console.error("postMessage error:", e); }
          window.close();
        }
      } else if (evt === "SIGNED_OUT") {
        logOAuth("sign-out");
      }
    });

    supabase.auth.getSession().then(async ({ data, error: sessErr }) => {
      if (!mountedRef.current) return;

      logOAuth("session-restore-complete", {
        hasSession: Boolean(data.session),
        userId: data.session?.user?.id ?? null,
        error: sessErr?.message ?? null,
      });

      const badJwt =
        sessErr &&
        /invalid claim|missing sub|bad_jwt|jwt/i.test(sessErr.message ?? "");

      if (badJwt || (data.session && !data.session.user?.id)) {
        try { await supabase.auth.signOut({ scope: "local" }); } catch { /* noop */ }
        setSession(null);
        setUser(null);
        setProfile(null);
        setIsAdmin(false);
        setError(null);
        setLoading(false);
        logOAuth("session-missing", { reason: "stale-jwt-purged", error: sessErr?.message ?? null });
        return;
      }

      if (sessErr) {
        console.warn("Supabase session fetch warning:", sessErr.message);
        setLoading(false);
        return;
      }

      if (data.session) {
        setSession(data.session);
        setUser(data.session.user ?? null);
        identifyUser({ id: data.session.user.id, email: data.session.user.email ?? null });
        if (data.session.user) {
          await hydrateUserData(data.session.user);
        }
        
        if (isPopup) {
          try { window.opener.postMessage({ type: "OAUTH_SUCCESS", session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token } }, "*"); } catch (e) { console.error("postMessage error:", e); }
          window.close();
        }
      }

      setLoading(false);

      if (cb && !data.session) {
        logOAuth("session-missing", {
          hadCode: Boolean(cb.code),
          hadHashTokens: cb.hasAccessTokenInHash || cb.hasRefreshTokenInHash,
          getSessionError: sessErr ? (sessErr as Error).message : null,
        });
        
        if (isPopup) {
          try { window.opener.postMessage({ type: "OAUTH_ERROR" }, "*"); } catch {}
          window.close();
        }
      }
    }).catch((err) => {
      if (!mountedRef.current) return;
      console.warn("Supabase getSession exception:", err);
      setLoading(false);
    });

    return () => {
      mountedRef.current = false;
      window.clearTimeout(slowTimer);
      sub.subscription.unsubscribe();
    };
  }, [retryTick, hydrateUserData]);

  // OAuth popup sync listener
  useEffect(() => {
    if (typeof window === "undefined") return;

    // If running in an OAuth popup and already authenticated, notify opener and close
    let isPopup = false;
    try {
      isPopup = Boolean(window.opener) && (window.name === 'oauth_popup' || new URLSearchParams(window.location.search).get('popup') === '1');
    } catch {
      isPopup = false;
    }
    if (isPopup) {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          try {
            window.opener.postMessage({ type: "OAUTH_SUCCESS", session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token } }, "*");
            window.close();
          } catch (e) {
            console.error("postMessage error:", e);
          }
        }
      });
    }

    const handleMessage = async (evt: MessageEvent) => {
      if (evt.data?.type === "OAUTH_SUCCESS") {
        if (evt.data?.session?.access_token && evt.data?.session?.refresh_token) {
          const { data } = await supabase.auth.setSession({
            access_token: evt.data.session.access_token,
            refresh_token: evt.data.session.refresh_token
          });
          if (data?.session) {
            toast.success("Welcome back!");
            setSession(data.session);
            setUser(data.session.user ?? null);
            if (data.session.user) {
              await hydrateUserData(data.session.user);
            }
            setLoading(false);
          } else {
            // fallback to getSession
            const { data: sessData } = await supabase.auth.getSession();
            if (sessData.session) {
              toast.success("Welcome back!");
              setSession(sessData.session);
              setUser(sessData.session.user ?? null);
              if (sessData.session.user) {
                await hydrateUserData(sessData.session.user);
              }
            }
            setLoading(false);
          }
        } else {
          const { data: sessData } = await supabase.auth.getSession();
          if (sessData.session) {
            toast.success("Welcome back!");
            setSession(sessData.session);
            setUser(sessData.session.user ?? null);
            if (sessData.session.user) {
              await hydrateUserData(sessData.session.user);
            }
          }
          setLoading(false);
        }
      } else if (evt.data?.type === "OAUTH_ERROR") {
        toast.error("Google sign in was cancelled or encountered an error.");
        setLoading(false);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [hydrateUserData]);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      /* noop */
    } finally {
      setSession(null);
      setUser(null);
      setProfile(null);
      setIsAdmin(false);
      setCredits({ balance: 0, planCredits: 0, topupCredits: 0 });
      setError(null);
      realtimeSync.destroy();
      try {
        Object.keys(localStorage).filter((k) => k.startsWith("sb-")).forEach((k) => localStorage.removeItem(k));
      } catch {
        /* noop */
      }
    }
  };

  const signInWithGoogle = async (returnTo?: string) => {
    const sanitizedPath = sanitizeRedirectUrl(returnTo, "/dashboard");

    logOAuth("initiate", {
      requestedReturnTo: returnTo ?? null,
      sanitizedPath,
    });

    let isIframe = false;
    try {
      isIframe = window.top !== window.self;
    } catch {
      isIframe = true;
    }
    let popup: Window | null = null;
    const callbackPath = `/auth/callback?popup=1&returnTo=${encodeURIComponent(sanitizedPath)}`;
    const finalRedirectTo = `${window.location.origin}${callbackPath}`;
    
    if (isIframe) {
      // Open the popup synchronously before any async operations to bypass popup blockers
      popup = window.open("about:blank", "oauth_popup", "width=600,height=700");
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: finalRedirectTo,
        skipBrowserRedirect: isIframe,
      },
    });

    if (error) {
      logOAuth("initiate-error", { error: error.message });
      if (popup) popup.close();
      throw error;
    }

    if (isIframe) {
      if (data?.url && popup) {
        popup.location.href = data.url;
      } else if (!popup) {
        throw new Error("Popup blocked by browser. Please allow popups for this site.");
      }
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      credits,
      isAdmin,
      loading,
      hydrating,
      slow,
      error,
      retry,
      refreshUserData,
      signInWithPassword,
      signUp,
      signOut,
      signInWithGoogle
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
