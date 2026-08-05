// Shared edge-function error reporter. Forwards caught exceptions to the
// `log-error` ingest endpoint using the service-role client so the entry
// lands in `error_logs` and triggers the same admin alerting as frontend
// errors. Fire-and-forget; never throws.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";

type Severity = "info" | "warning" | "error" | "critical";

interface ReportOpts {
  functionName: string;
  severity?: Severity;
  userId?: string | null;
  url?: string | null;
  context?: Record<string, unknown>;
}

let _admin: ReturnType<typeof createClient> | null = null;
function admin() {
  if (_admin) return _admin;
  _admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  return _admin;
}

export async function reportEdgeError(err: unknown, opts: ReportOpts): Promise<void> {
  try {
    const e = err instanceof Error ? err : new Error(typeof err === "string" ? err : JSON.stringify(err));
    await admin().functions.invoke("log-error", {
      body: {
        message: e.message || "Unknown edge error",
        stack: e.stack,
        severity: opts.severity ?? "error",
        source: "edge_function",
        function_name: opts.functionName,
        url: opts.url ?? null,
        user_id: opts.userId ?? null,
        release: Deno.env.get("APP_RELEASE") ?? "edge",
        context: opts.context ?? {},
      },
    });
  } catch (inner) {
    console.warn("[reportEdgeError] failed:", (inner as Error).message);
  }
}

/** Wrap a Deno.serve handler so any uncaught throw is auto-reported. */
export function withErrorReporting(
  functionName: string,
  handler: (req: Request) => Promise<Response> | Response,
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    try {
      return await handler(req);
    } catch (err) {
      await reportEdgeError(err, {
        functionName,
        severity: "error",
        url: req.url,
        context: { method: req.method },
      });
      throw err;
    }
  };
}
