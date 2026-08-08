import fs from "fs";
const file = "supabase/functions/admin-api/index.ts";
let content = fs.readFileSync(file, "utf8");

content = content.replace(
  /if \(path\.match\(\/\^\\\/plan-pricing\\\/\[\^\\\/\]\+\\\/\[\^\\\/\]\+\$\/\)\) \{[\s\S]*?saveDb\(db\);\s+return new Response\(JSON\.stringify\(\{ ok: true \}\), \{ headers: corsHeaders \}\);\s+\}/g,
  `if (path.match(/^\\/plan-pricing\\/[^\\/]+\\/[^\\/]+$/)) {
        const parts = path.split('/');
        const currency = parts.pop();
        const plan_id = parts.pop();
        await adminClient.from('plan_pricing').upsert({ plan_id, currency, ...body });
        await adminClient.from('admin_audit_log').insert({ admin_id: userData.user.id, action: 'update_plan_pricing', details: { plan_id, currency, ...body } });
        return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
      }`
);
fs.writeFileSync(file, content);
