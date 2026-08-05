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

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  slow: boolean;
  /** Populated when getSession()/getUser() failed with a non-recoverable error. */
  error: Error | null;
  /** Manually retry session hydration after a network/auth failure. */
  retry: () => void;
  signOut: () => Promise<void>;
  signInWithGoogle: (returnTo?: string) => Promise<void>;
}

const SLOW_LOAD_MS = 6000;

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  slow: false,
  error: null,
  retry: () => {},
  signOut: async () => {},
  signInWithGoogle: async () => {},
});

const hasValidSub = (sess: Session | null) => {
  if (!sess?.access_token) return true;
  try {
    const payload = JSON.parse(
      atob(sess.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
    return typeof payload?.sub === "string" && payload.sub.length > 0;
  } catch { return false; }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const mountedRef = useRef(true);

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
        setError(null);
        setLoading(false);
        logOAuth("session-missing", { reason: "stale-jwt-purged-onchange", event: evt });
        return;
      }

      setSession(sess);
      setUser(sess?.user ?? null);
      setError(null);
      setLoading(false);

      identifyUser(sess?.user ? { id: sess.user.id, email: sess.user.email ?? null } : null);

      if (evt === "SIGNED_IN") {
        logOAuth("code-exchange-success", { userId: sess?.user?.id });
        logOAuth("session-created", {
          userId: sess?.user?.id,
          provider: sess?.user?.app_metadata?.provider ?? null,
        });
        
        if (typeof window !== 'undefined' && window.opener && window.name === 'oauth_popup') {
          try { window.opener.postMessage({ type: "OAUTH_SUCCESS", session: sess }, "*"); } catch {}
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
        
        if (typeof window !== 'undefined' && window.opener && window.name === 'oauth_popup') {
          try { window.opener.postMessage({ type: "OAUTH_SUCCESS", session: data.session }, "*"); } catch {}
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
        
        if (typeof window !== 'undefined' && window.opener && window.name === 'oauth_popup') {
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
  }, [retryTick]);

  // OAuth popup sync listener
  useEffect(() => {
    if (typeof window === "undefined") return;

    // If running in an OAuth popup and already authenticated, notify opener and close
    if (window.opener && window.opener !== window) {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          try {
            window.opener.postMessage({ type: "OAUTH_SUCCESS", session: data.session }, "*");
            window.close();
          } catch {
            /* noop */
          }
        }
      });
    }

    const handleMessage = async (evt: MessageEvent) => {
      console.log("OAuth Parent Received Message:", evt.data);
      if (evt.data?.type === "OAUTH_SUCCESS") {
        toast.info("OAuth popup success received.");
        if (evt.data?.session?.access_token && evt.data?.session?.refresh_token) {
          console.log("Setting session from popup data...");
          toast.info("Setting session from popup data...");
          const { data, error } = await supabase.auth.setSession({
            access_token: evt.data.session.access_token,
            refresh_token: evt.data.session.refresh_token
          });
          console.log("setSession result:", { data, error });
          if (data.session) {
            toast.success("Login successful!");
            setSession(data.session);
            setUser(data.session.user ?? null);
            setLoading(false);
          } else {
             toast.error("Failed to set session. Reloading...");
             // fallback to reload if setSession fails
             window.location.reload();
          }
        } else {
          console.log("No session data in message, fetching session...");
          toast.info("No session data in message, fetching session...");
          supabase.auth.getSession().then(({ data }) => {
            console.log("getSession result:", data);
            if (data.session) {
              toast.success("Session fetched successfully!");
              setSession(data.session);
              setUser(data.session.user ?? null);
              setLoading(false);
            } else {
               toast.error("Failed to fetch session. Reloading...");
               window.location.reload();
            }
          });
        }
      } else if (evt.data?.type === "OAUTH_ERROR") {
        toast.error("OAuth popup reported an error.");
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  const signOut = async () => {
    try {
      Object.keys(localStorage).filter((k) => k.startsWith("sb-")).forEach((k) => localStorage.removeItem(k));
    } catch {
      /* noop */
    }
    setSession(null);
    setUser(null);
    setError(null);
    try {
      await supabase.auth.signOut();
    } catch {
      /* noop */
    }
  };

  const signInWithGoogle = async (returnTo?: string) => {
    const sanitizedPath = sanitizeRedirectUrl(returnTo, "/dashboard");
    const redirectTo = `${window.location.origin}${sanitizedPath}`;

    logOAuth("initiate", {
      requestedReturnTo: returnTo ?? null,
      sanitizedPath,
      redirectTo,
    });

    const isIframe = window.top !== window.self;
    let popup: Window | null = null;
    
    if (isIframe) {
      // Open the popup synchronously before any async operations to bypass popup blockers
      popup = window.open("about:blank", "oauth_popup", "width=600,height=700");
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
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
    <AuthContext.Provider value={{ user, session, loading, slow, error, retry, signOut, signInWithGoogle }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
