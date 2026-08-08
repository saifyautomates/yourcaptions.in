// Spellcheck captions via OpenAI.
// Input:  { text: string, language?: string }
// Output: { issues: Array<{ original: string, suggestion: string, reason?: string }> }
//
// Auth: requires a valid Supabase JWT (verified in code via getClaims). Rate
// limited per user via the shared enforceRateLimit helper so anonymous or
// scripted callers can't burn AI credits.

import { createClient } from "@supabase/supabase-js";
import { enforceRateLimit, makeAdmin } from "../_shared/rate-limit.ts";

import { callAI } from "../_shared/ai.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
    const supabase = createClient(
      (Deno.env.get("SUPABASE_URL") || "").replace("mqotnflwrgqppbhjkwyq", "mqotnlflwrgqpbhjkwyq"),
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const admin = makeAdmin();
    const rl = await enforceRateLimit(admin, userId, "spellcheck-captions");
    if (!rl.ok) {
      return new Response(JSON.stringify({ error: rl.message }), {
        status: rl.status, headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const { text, language } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "text required" }), { status: 400, headers: { ...corsHeaders, "content-type": "application/json" } });
    }
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY missing" }), { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } });
    }

    const sys = `You are a strict spelling and typo checker for video captions.
Return ONLY misspellings, obvious typos, and wrong-word errors. Do NOT rewrite style, grammar, or punctuation.
Preserve proper nouns and brand names. If unsure, skip it.
Respond with a JSON object: {"issues":[{"original":"<exact substring from input>","suggestion":"<fix>","reason":"<short>"}]}
The "original" MUST match the input text exactly (case, spacing).`;

    const user = `Language: ${language || "auto"}\n\nCaptions:\n${text.slice(0, 12000)}`;

    const data = await callAI({
          model: "gpt-4o-mini",
          messages: [{ role: "system", content: sys }, { role: "user", content: user }],
          response_format: { type: "json_object" }
        }).catch((e) => {
          throw new Error(e.message);
        });
    const content = data?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { parsed = { issues: [] }; }
    const issues = Array.isArray(parsed.issues) ? parsed.issues : [];
    return new Response(JSON.stringify({ issues }), { headers: { ...corsHeaders, "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } });
  }
});
