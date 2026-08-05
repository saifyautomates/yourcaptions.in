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
  signInWithGoogle: () => Promise<void>;
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

      logOAuth("auth-state-change", {
        event: evt,
        hasSession: Boolean(sess),
        userId: sess?.user?.id ?? null,
        provider: sess?.user?.app_metadata?.provider ?? null,
        expiresAt: sess?.expires_at ?? null,
      });

      if (evt === "SIGNED_IN") {
        logOAuth("code-exchange-success", { userId: sess?.user?.id });
        logOAuth("session-created", {
          userId: sess?.user?.id,
          provider: sess?.user?.app_metadata?.provider ?? null,
        });
      } else if (evt === "SIGNED_OUT") {
        logOAuth("sign-out");
      }
    });

    supabase.auth.getSession().then(async ({ data, error: sessErr }) => {
      if (!mountedRef.current) return;

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
      }

      setLoading(false);

      if (cb && !data.session) {
        logOAuth("session-missing", {
          hadCode: Boolean(cb.code),
          hadHashTokens: cb.hasAccessTokenInHash || cb.hasRefreshTokenInHash,
          getSessionError: sessErr ? (sessErr as Error).message : null,
        });
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
            window.opener.postMessage({ type: "OAUTH_SUCCESS" }, "*");
            window.close();
          } catch {
            /* noop */
          }
        }
      });
    }

    const handleMessage = (evt: MessageEvent) => {
      if (evt.data?.type === "OAUTH_SUCCESS") {
        supabase.auth.getSession().then(({ data }) => {
          if (data.session) {
            setSession(data.session);
            setUser(data.session.user ?? null);
            setLoading(false);
          }
        });
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

  const signInWithGoogle = async () => {
    const isIframe = typeof window !== "undefined" && window.self !== window.top;
    const redirectTo = `${window.location.origin}/dashboard`;

    if (isIframe) {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      if (data?.url) {
        const popup = window.open(
          data.url,
          "google_oauth",
          "width=600,height=700,status=no,resizable=yes,scrollbars=yes"
        );
        if (!popup || popup.closed || typeof popup.closed === "undefined") {
          window.open(data.url, "_blank");
        }
      }
    } else {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
        },
      });
      if (error) throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, slow, error, retry, signOut, signInWithGoogle }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
