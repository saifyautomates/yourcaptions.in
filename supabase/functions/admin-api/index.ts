import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("unauthorized");
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    
    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData?.user) throw new Error("unauthorized");
    
    const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    
    // Check if the user is an admin in public.user_roles
    const { data: adminRole, error: roleError } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id)
      .eq('role', 'admin')
      .single();
      
    if (roleError || !adminRole) {
      throw new Error("forbidden: admin only");
    }

    const url = new URL(req.url);
    const path = url.pathname.replace('/admin-api', ''); // Normalize route
    
    // Dispatch
    if (req.method === "GET") {
      if (path === '/credit-rates') {
        const { data } = await adminClient.from('credit_rates').select('*').order('feature');
        return new Response(JSON.stringify({ rates: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (path === '/plan-limits') {
        const { data } = await adminClient.from('plan_limits').select('*').order('plan_id');
        return new Response(JSON.stringify({ limits: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (path === '/plan-pricing') {
        const currency = url.searchParams.get('currency') || 'INR';
        const { data } = await adminClient.from('plan_pricing').select('*').eq('currency', currency).order('plan_id');
        return new Response(JSON.stringify({ pricing: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (path === '/feature-flags') {
        const { data } = await adminClient.from('feature_flags').select('*').order('feature_name');
        return new Response(JSON.stringify({ flags: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (path === '/system-settings') {
        const { data } = await adminClient.from('system_settings').select('*').order('setting_key');
        return new Response(JSON.stringify({ settings: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (path === '/audit-log') {
        const { data } = await adminClient.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100);
        return new Response(JSON.stringify({ logs: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }
    
    if (req.method === "POST") {
      const body = await req.json();
      if (path === '/credits/adjust') {
        const { user_id, amount, reason } = body;
        if (!user_id || !amount || !reason) {
          throw new Error('missing required fields: user_id, amount, reason');
        }
        const { data, error } = await adminClient.rpc('admin_adjust_credits', { user_id, amount, reason });
        if (error) throw error;
        await adminClient.from('audit_logs').insert({ admin_id: userData.user.id, action: 'adjust_credits', details: body });
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (req.method === "PATCH") {
      const body = await req.json();
      
      if (path.startsWith('/credit-rates/')) {
        const feature = path.split('/').pop();
        await adminClient.from('credit_rates').update(body).eq('feature', feature);
        await adminClient.from('audit_logs').insert({ admin_id: userData.user.id, action: 'update_credit_rate', details: { feature, ...body } });
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }
      if (path.startsWith('/plan-limits/')) {
        const plan_id = path.split('/').pop();
        await adminClient.from('plan_limits').update(body).eq('plan_id', plan_id);
        await adminClient.from('audit_logs').insert({ admin_id: userData.user.id, action: 'update_plan_limit', details: { plan_id, ...body } });
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }
      if (path.match(/^\/plan-pricing\/[^\/]+\/[^\/]+$/)) {
        const parts = path.split('/');
        const currency = parts.pop();
        const plan_id = parts.pop();
        await adminClient.from('plan_pricing').update(body).eq('plan_id', plan_id).eq('currency', currency);
        await adminClient.from('audit_logs').insert({ admin_id: userData.user.id, action: 'update_plan_pricing', details: { plan_id, currency, ...body } });
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }
      if (path.startsWith('/feature-flags/')) {
        const feature_name = path.split('/').pop();
        await adminClient.from('feature_flags').update(body).eq('feature_name', feature_name);
        await adminClient.from('audit_logs').insert({ admin_id: userData.user.id, action: 'update_feature_flag', details: { feature_name, ...body } });
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }
      if (path.startsWith('/system-settings/')) {
        const setting_key = path.split('/').pop();
        await adminClient.from('system_settings').update(body).eq('setting_key', setting_key);
        await adminClient.from('audit_logs').insert({ admin_id: userData.user.id, action: 'update_system_setting', details: { setting_key, ...body } });
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }
    }

    return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: corsHeaders });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message ?? String(e) }), {
      status: e.message?.includes('unauthorized') || e.message?.includes('forbidden') ? 403 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
