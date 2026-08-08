import fs from "fs";
const file = "supabase/functions/admin-api/index.ts";
let content = fs.readFileSync(file, "utf8");

// Remove localDb
content = content.replace('import { getDb, saveDb } from "./localDb.ts";\n', "");
content = content.replace('    const db = getDb();\n', "");

// Read endpoints
content = content.replace(
  /if \(path === '\/credit-rates'\) \{\s+return new Response\(JSON\.stringify\(\{ rates: db\.credit_rates \}\), \{ headers: \{ \.\.\.corsHeaders, "Content-Type": "application\/json" \} \}\);\s+\}/g,
  `if (path === '/credit-rates') {
        const { data: rates } = await adminClient.from('credit_rates').select('*');
        return new Response(JSON.stringify({ rates: rates || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }`
);

content = content.replace(
  /if \(path === '\/plan-limits'\) \{\s+return new Response\(JSON\.stringify\(\{ limits: db\.plan_limits \}\), \{ headers: \{ \.\.\.corsHeaders, "Content-Type": "application\/json" \} \}\);\s+\}/g,
  `if (path === '/plan-limits') {
        const { data: limits } = await adminClient.from('plan_limits').select('*');
        return new Response(JSON.stringify({ limits: limits || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }`
);

content = content.replace(
  /if \(path === '\/plan-pricing'\) \{\s+const currency = url\.searchParams\.get\('currency'\) \|\| 'INR';\s+const pricing = db\.plan_pricing\.filter\(\(p: any\) => p\.currency === currency\);\s+return new Response\(JSON\.stringify\(\{ pricing \}\), \{ headers: \{ \.\.\.corsHeaders, "Content-Type": "application\/json" \} \}\);\s+\}/g,
  `if (path === '/plan-pricing') {
        const currency = url.searchParams.get('currency') || 'INR';
        const { data: pricing } = await adminClient.from('plan_pricing').select('*').eq('currency', currency);
        return new Response(JSON.stringify({ pricing: pricing || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }`
);

content = content.replace(
  /if \(path === '\/feature-flags'\) \{\s+return new Response\(JSON\.stringify\(\{ flags: db\.feature_flags \}\), \{ headers: \{ \.\.\.corsHeaders, "Content-Type": "application\/json" \} \}\);\s+\}/g,
  `if (path === '/feature-flags') {
        const { data: flags } = await adminClient.from('feature_flags').select('*');
        return new Response(JSON.stringify({ flags: flags || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }`
);

content = content.replace(
  /if \(path === '\/system-settings'\) \{\s+return new Response\(JSON\.stringify\(\{ settings: db\.system_settings \}\), \{ headers: \{ \.\.\.corsHeaders, "Content-Type": "application\/json" \} \}\);\s+\}/g,
  `if (path === '/system-settings') {
        const { data: settings } = await adminClient.from('system_settings').select('*');
        return new Response(JSON.stringify({ settings: settings || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }`
);

content = content.replace(
  /if \(path === '\/audit-log'\) \{\s+const logs = \[\.\.\.db\.audit_logs\]\.reverse\(\)\.slice\(0, 100\);\s+return new Response\(JSON\.stringify\(\{ logs \}\), \{ headers: \{ \.\.\.corsHeaders, "Content-Type": "application\/json" \} \}\);\s+\}/g,
  `if (path === '/audit-log') {
        const { data: logs } = await adminClient.from('admin_audit_log').select('*').order('created_at', { ascending: false }).limit(100);
        return new Response(JSON.stringify({ logs: logs || [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }`
);

// Delete user DB updates for adjust credits
content = content.replace(
  /db\.audit_logs\.push\(\{ admin_id: userData\.user\.id, action: 'adjust_credits', details: body, created_at: new Date\(\)\.toISOString\(\) \}\);\s+saveDb\(db\);/g,
  `await adminClient.from('admin_audit_log').insert({ admin_id: userData.user.id, action: 'adjust_credits', details: body });`
);

// Write logic for patches
content = content.replace(
  /if \(path\.startsWith\('\/credit-rates\/'\)\) \{[\s\S]*?return new Response\(JSON\.stringify\(\{ ok: true \}\), \{ headers: corsHeaders \}\);\s+\}/g,
  `if (path.startsWith('/credit-rates/')) {
        const feature = path.split('/').pop();
        await adminClient.from('credit_rates').upsert({ feature, ...body });
        await adminClient.from('admin_audit_log').insert({ admin_id: userData.user.id, action: 'update_credit_rate', details: { feature, ...body } });
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }`
);

content = content.replace(
  /if \(path\.startsWith\('\/plan-limits\/'\)\) \{[\s\S]*?return new Response\(JSON\.stringify\(\{ ok: true \}\), \{ headers: corsHeaders \}\);\s+\}/g,
  `if (path.startsWith('/plan-limits/')) {
        const plan_id = path.split('/').pop();
        await adminClient.from('plan_limits').upsert({ plan_id, ...body });
        await adminClient.from('admin_audit_log').insert({ admin_id: userData.user.id, action: 'update_plan_limit', details: { plan_id, ...body } });
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }`
);

content = content.replace(
  /if \(path\.match\(\/\\\/plan-pricing\\\/\[\^\\\/\]\+\\\/\[\^\\\/\]\+\$\/\)\) \{[\s\S]*?return new Response\(JSON\.stringify\(\{ ok: true \}\), \{ headers: corsHeaders \}\);\s+\}/g,
  `if (path.match(/^\\/plan-pricing\\/[^\\/]+\\/[^\\/]+$/)) {
        const parts = path.split('/');
        const currency = parts.pop();
        const plan_id = parts.pop();
        await adminClient.from('plan_pricing').upsert({ plan_id, currency, ...body });
        await adminClient.from('admin_audit_log').insert({ admin_id: userData.user.id, action: 'update_plan_pricing', details: { plan_id, currency, ...body } });
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }`
);

content = content.replace(
  /if \(path\.startsWith\('\/feature-flags\/'\)\) \{[\s\S]*?return new Response\(JSON\.stringify\(\{ ok: true \}\), \{ headers: corsHeaders \}\);\s+\}/g,
  `if (path.startsWith('/feature-flags/')) {
        const feature_name = path.split('/').pop();
        await adminClient.from('feature_flags').upsert({ feature_name, ...body });
        await adminClient.from('admin_audit_log').insert({ admin_id: userData.user.id, action: 'update_feature_flag', details: { feature_name, ...body } });
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }`
);

content = content.replace(
  /if \(path\.startsWith\('\/system-settings\/'\)\) \{[\s\S]*?return new Response\(JSON\.stringify\(\{ ok: true \}\), \{ headers: corsHeaders \}\);\s+\}/g,
  `if (path.startsWith('/system-settings/')) {
        const setting_key = path.split('/').pop();
        await adminClient.from('system_settings').upsert({ setting_key, ...body });
        await adminClient.from('admin_audit_log').insert({ admin_id: userData.user.id, action: 'update_system_setting', details: { setting_key, ...body } });
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }`
);

fs.writeFileSync(file, content);
