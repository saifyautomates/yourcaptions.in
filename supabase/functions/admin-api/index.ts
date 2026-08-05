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
    
    // Quick admin check: check if the user is in admin_users or has super_admin role
    // For this context, we check if they are in admin_users or if their email domain is authorized.
    // The previous instructions used admin_users table.
    const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: adminRole, error: roleError } = await adminClient
      .from('admin_users')
      .select('role')
      .eq('user_id', userData.user.id)
      .single();
      
    if (roleError || !adminRole || adminRole.role !== 'super_admin') {
      throw new Error("forbidden: super_admin only");
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
    }
    
    if (req.method === "PATCH") {
      const body = await req.json();
      
      if (path.startsWith('/credit-rates/')) {
        const feature = path.split('/').pop();
        await adminClient.from('credit_rates').update(body).eq('feature', feature);
        await adminClient.rpc('log_admin_action', { _user_id: userData.user.id, _action: 'update_credit_rate', _details: { feature, ...body } });
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }
      if (path.startsWith('/plan-limits/')) {
        const plan_id = path.split('/').pop();
        await adminClient.from('plan_limits').update(body).eq('plan_id', plan_id);
        await adminClient.rpc('log_admin_action', { _user_id: userData.user.id, _action: 'update_plan_limit', _details: { plan_id, ...body } });
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }
      if (path.match(/^\/plan-pricing\/[^\/]+\/[^\/]+$/)) {
        const parts = path.split('/');
        const currency = parts.pop();
        const plan_id = parts.pop();
        await adminClient.from('plan_pricing').update(body).eq('plan_id', plan_id).eq('currency', currency);
        await adminClient.rpc('log_admin_action', { _user_id: userData.user.id, _action: 'update_plan_pricing', _details: { plan_id, currency, ...body } });
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }
      if (path.startsWith('/feature-flags/')) {
        const feature_name = path.split('/').pop();
        await adminClient.from('feature_flags').update(body).eq('feature_name', feature_name);
        await adminClient.rpc('log_admin_action', { _user_id: userData.user.id, _action: 'update_feature_flag', _details: { feature_name, ...body } });
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }
      if (path.startsWith('/system-settings/')) {
        const setting_key = path.split('/').pop();
        await adminClient.from('system_settings').update(body).eq('setting_key', setting_key);
        await adminClient.rpc('log_admin_action', { _user_id: userData.user.id, _action: 'update_system_setting', _details: { setting_key, ...body } });
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
