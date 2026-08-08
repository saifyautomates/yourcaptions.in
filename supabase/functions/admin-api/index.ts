import { createClient } from "@supabase/supabase-js";

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
    
    const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").replace("mqotnflwrgqppbhjkwyq", "mqotnlflwrgqpbhjkwyq");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    
    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData?.user) throw new Error("unauthorized");
    
    const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    
    // Check admin role
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
    if (url.pathname.endsWith('/env')) return new Response(JSON.stringify(Deno.env.toObject()), { headers: corsHeaders });

    const match = url.pathname.match(/\/admin-api(\/.*)?$/);
    const path = match && match[1] ? match[1] : '';
    

    if (req.method === "GET") {
      if (path === '/debug') return new Response(JSON.stringify({ path, pathname: url.pathname }), { headers: corsHeaders });
      if (path === '/users') {
        const { data: { users }, error } = await adminClient.auth.admin.listUsers();
        if (error) throw error;
        const { data: profiles } = await adminClient.from('profiles').select('*');
        const { data: roles } = await adminClient.from('user_roles').select('*');
        
        const merged = users.map(u => {
          const profile = profiles?.find(p => p.id === u.id);
          const roleRec = roles?.find(r => r.user_id === u.id);
          return {
            user_id: u.id,
            email: u.email,
            created_at: u.created_at,
            full_name: profile?.full_name || '',
            plan: profile?.plan || 'starter',
            credits_seconds: profile?.credits_seconds || 0,
            is_admin: roleRec?.role === 'admin'
          };
        });
        return new Response(JSON.stringify(merged), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (path === '/overview-stats') {
        const { data: usersData } = await adminClient.auth.admin.listUsers();
        const totalUsers = usersData?.users?.length || 0;
        const { count: active_projects } = await adminClient.from('projects').select('*', { count: 'exact', head: true });
        const { count: total_exports } = await adminClient.from('export_metrics').select('*', { count: 'exact', head: true });
        return new Response(JSON.stringify([
          { total_users: totalUsers, active_projects: active_projects || 0, current_mrr: 0, total_exports: total_exports || 0 }
        ]), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      
      if (path === '/recent-activity') {
        const { data } = await adminClient.from('jobs').select('id, user_id, kind, raw, created_at').order('created_at', { ascending: false }).limit(10);
        const mapped = (data || []).map(j => ({ id: j.id, user_id: j.user_id, email: '', action_type: j.kind, metadata: j.raw, created_at: j.created_at }));
        return new Response(JSON.stringify(mapped), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      
      if (path === '/subscriptions-summary') {
        return new Response(JSON.stringify([{ total_mrr: 0, active_subscriptions: 0, churn_rate: 0, upgrades: 0 }]), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      
      if (path === '/projects') {
        const search = url.searchParams.get('search');
        const status = url.searchParams.get('status');
        
        let q = adminClient.from('projects').select('*, profiles(email)').order('created_at', { ascending: false }).limit(200);
        if (status) q = q.eq('status', status);
        
        const { data } = await q;
        let mapped = (data || []).map((p: any) => ({ ...p, owner_email: p.profiles?.email || 'unknown' }));
        
        if (search) {
          const s = search.toLowerCase();
          mapped = mapped.filter(p => p.title?.toLowerCase().includes(s) || p.owner_email?.toLowerCase().includes(s));
        }
        
        return new Response(JSON.stringify(mapped), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      
      if (path === '/security-alerts') {
        return new Response(JSON.stringify([]), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Existing endpoints...
      if (path === '/users/search') {
        const userEmail = url.searchParams.get('email');
        if (!userEmail) throw new Error('email required');
        const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers();
        if (listError) throw listError;
        const user = users.find(u => u.email === userEmail);
        if (!user) return new Response(JSON.stringify({ error: "user not found" }), { status: 404, headers: corsHeaders });
        const { data: profile } = await adminClient.from('profiles').select('credits_seconds, full_name, plan').eq('id', user.id).single();
        return new Response(JSON.stringify({
            id: user.id, email: user.email, full_name: profile?.full_name, total_credits: profile?.credits_seconds || 0, plan: profile?.plan || 'starter'
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (path === '/credit-rates') {
        const { data: rates } = await adminClient.from('credit_rates').select('*');
        return new Response(JSON.stringify({ rates: rates || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (path === '/plan-limits') {
        const { data: limits } = await adminClient.from('plan_limits').select('*');
        return new Response(JSON.stringify({ limits: limits || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (path === '/plan-pricing') {
        const currency = url.searchParams.get('currency') || 'INR';
        const { data: pricing } = await adminClient.from('plan_pricing').select('*').eq('currency', currency);
        return new Response(JSON.stringify({ pricing: pricing || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (path === '/feature-flags') {
        const { data: flags } = await adminClient.from('feature_flags').select('*');
        return new Response(JSON.stringify({ flags: flags || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (path === '/system-settings') {
        const { data: settings } = await adminClient.from('system_settings').select('*');
        return new Response(JSON.stringify({ settings: settings || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (path === '/audit-log') {
        const { data: logs } = await adminClient.from('admin_audit_log').select('*').order('created_at', { ascending: false }).limit(100);
        return new Response(JSON.stringify({ logs: logs || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }
    
    if (req.method === "POST") {
      const body = await req.json();
      
      if (path === '/users/grant-access') {
        const { _user_id, _plan, _mode, _credits_seconds } = body;
        if (_plan && _mode === 'set') {
          await adminClient.from('profiles').update({ plan: _plan }).eq('id', _user_id);
        } else if (_credits_seconds && _mode === 'add') {
          const { data: profile } = await adminClient.from('profiles').select('credits_seconds').eq('id', _user_id).single();
          const new_balance = (profile?.credits_seconds || 0) + _credits_seconds;
          await adminClient.from('profiles').update({ credits_seconds: new_balance }).eq('id', _user_id);
        }
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }
      
      if (path === '/users/set-role') {
        let { _user_id, _email, _role, _grant } = body;
        if (_email && !_user_id) {
          const { data: { users } } = await adminClient.auth.admin.listUsers();
          const user = users.find(u => u.email === _email);
          if (!user) throw new Error('user not found');
          _user_id = user.id;
        }
        if (_grant) {
          // Check if it already exists
          const { data: existing } = await adminClient.from('user_roles').select('*').eq('user_id', _user_id).eq('role', _role).maybeSingle();
          if (!existing) {
            await adminClient.from('user_roles').insert({ user_id: _user_id, role: _role });
          }
        } else {
          await adminClient.from('user_roles').delete().eq('user_id', _user_id).eq('role', _role);
        }
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }
      
      if (path === '/users/delete') {
        const { _user_id } = body;
        await adminClient.auth.admin.deleteUser(_user_id);
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }
      
      if (path === '/credits/adjust') {
        const { user_id, amount, reason } = body;
        if (!user_id || !amount || !reason) throw new Error('missing fields');
        const { data: profile } = await adminClient.from('profiles').select('credits_seconds').eq('id', user_id).single();
        const new_balance = (profile?.credits_seconds || 0) + amount;
        await adminClient.from('credit_transactions').insert({ user_id, amount, transaction_type: 'admin_adjustment', reason });
        await adminClient.from('profiles').update({ credits_seconds: new_balance }).eq('id', user_id);
        await adminClient.from('admin_audit_log').insert({ admin_id: userData.user.id, action: 'adjust_credits', details: body });
        return new Response(JSON.stringify({ new_balance }), { headers: corsHeaders });
      }
    }

    if (req.method === "PATCH") {
      const body = await req.json();
      
      if (path.startsWith('/credit-rates/')) {
        const feature = path.split('/').pop();
        await adminClient.from('credit_rates').upsert({ feature, ...body });
        await adminClient.from('admin_audit_log').insert({ admin_id: userData.user.id, action: 'update_credit_rate', details: { feature, ...body } });
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }
      
      if (path.startsWith('/plan-limits/')) {
        const plan_id = path.split('/').pop();
        await adminClient.from('plan_limits').upsert({ plan_id, ...body });
        await adminClient.from('admin_audit_log').insert({ admin_id: userData.user.id, action: 'update_plan_limit', details: { plan_id, ...body } });
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }
      
      if (path.match(/^\/plan-pricing\/[^\/]+\/[^\/]+$/)) {
        const parts = path.split('/');
        const currency = parts.pop();
        const plan_id = parts.pop();
        await adminClient.from('plan_pricing').upsert({ plan_id, currency, ...body });
        await adminClient.from('admin_audit_log').insert({ admin_id: userData.user.id, action: 'update_plan_pricing', details: { plan_id, currency, ...body } });
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }
      
      if (path.startsWith('/feature-flags/')) {
        const feature_name = path.split('/').pop();
        await adminClient.from('feature_flags').upsert({ feature_name, ...body });
        await adminClient.from('admin_audit_log').insert({ admin_id: userData.user.id, action: 'update_feature_flag', details: { feature_name, ...body } });
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }
      
      if (path.startsWith('/system-settings/')) {
        const setting_key = path.split('/').pop();
        await adminClient.from('system_settings').upsert({ setting_key, ...body });
        await adminClient.from('admin_audit_log').insert({ admin_id: userData.user.id, action: 'update_system_setting', details: { setting_key, ...body } });
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
