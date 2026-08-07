import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const AuthDiagnostics = () => {
  const { user, session, loading, error } = useAuth();
  const [dbSession, setDbSession] = useState<any>(null);
  const [clientStatus, setClientStatus] = useState<string>("Checking...");
  const [tokenStatus, setTokenStatus] = useState<{access: boolean, refresh: boolean}>({access: false, refresh: false});

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      setDbSession(data.session);
      if (error) {
        setClientStatus(`Error: ${error.message}`);
      } else {
        setClientStatus("Supabase client initialized & responded");
      }
    });

    const checkTokens = () => {
      let access = false;
      let refresh = false;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
           const val = localStorage.getItem(key);
           if (val) {
             try {
               const parsed = JSON.parse(val);
               if (parsed.access_token) access = true;
               if (parsed.refresh_token) refresh = true;
             } catch {}
           }
        }
      }
      setTokenStatus({ access, refresh });
    };
    checkTokens();
    const interval = setInterval(checkTokens, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-4 bg-black/80 text-green-400 font-mono text-xs rounded-lg border border-green-500/30 max-w-lg w-full mt-4 z-50 relative">
      <h3 className="text-green-300 mb-2 font-bold uppercase tracking-wider">Auth Diagnostics</h3>
      
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="font-semibold text-gray-400">Auth Hook State:</div>
        <div>
           <div>Loading: {loading ? "true" : "false"}</div>
           <div>User: {user ? user.id : "null"}</div>
           <div>Session: {session ? "Active" : "null"}</div>
           {error && <div className="text-red-400">Error: {error.message}</div>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="font-semibold text-gray-400">Local Storage Tokens:</div>
        <div>
           <div>Access Token: {tokenStatus.access ? "Present" : "Missing"}</div>
           <div>Refresh Token: {tokenStatus.refresh ? "Present" : "Missing"}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="font-semibold text-gray-400">Supabase Client:</div>
        <div>
           <div>Status: {clientStatus}</div>
           <div>Direct Session ID: {dbSession?.user?.id || "null"}</div>
           <div>Expires At: {dbSession?.expires_at ? new Date(dbSession.expires_at * 1000).toLocaleString() : "N/A"}</div>
        </div>
      </div>

      <button 
        onClick={() => {
           for (const key of Object.keys(localStorage)) {
             if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
               localStorage.removeItem(key);
             }
           }
           window.location.reload();
        }}
        className="mt-2 px-3 py-1 bg-red-900/50 text-red-200 hover:bg-red-900/80 rounded border border-red-500/50 transition-colors"
      >
        Clear Local Tokens & Reload
      </button>
    </div>
  );
};
