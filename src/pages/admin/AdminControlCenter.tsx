import { adminFetch } from "@/lib/adminFetch";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

function AdminHeader() {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-bold text-white">Admin Control Center</h1>
      <p className="text-[#888]">Manage global application settings in real-time.</p>
    </div>
  );
}

// ─── SUBCOMPONENT: CreditRatesEditor ───
function CreditRatesEditor() {
  const [rates, setRates] = useState<any[]>([]);

  useEffect(() => {
    adminFetch('/functions/v1/admin-api/credit-rates')
      .then(r => {
        if (r.ok && r.headers.get('content-type')?.includes('application/json')) return r.json();
        return {};
      })
      .then(d => {
        if (d.rates) setRates(d.rates);
      });
  }, []);

  const handleSave = async (feature: string, newRate: number) => {
    try {
      const res = await adminFetch(`/functions/v1/admin-api/credit-rates/${feature}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credits_per_unit: newRate })
      });
      if (res.ok) {
        toast.success(`✓ ${feature} rate updated to ${newRate}`);
      } else {
        toast.error("Failed to update rate");
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-4 bg-yellow-900/20 border border-yellow-700/50 rounded-lg text-yellow-500 text-sm">
        ⚠️ Changes take effect immediately for all NEW jobs. Jobs already in progress use the rate at time of reservation.
      </div>
      <table className="w-full text-left text-sm text-[#888]">
        <thead className="bg-[#111] text-white">
          <tr>
            <th className="p-3 rounded-tl-lg">Feature</th>
            <th className="p-3">Rate</th>
            <th className="p-3">Unit</th>
            <th className="p-3 rounded-tr-lg">Description</th>
          </tr>
        </thead>
        <tbody>
          {rates.map(r => (
            <tr key={r.feature} className="border-b border-[#1F1F1F]">
              <td className="p-3 text-white font-medium">{r.feature}</td>
              <td className="p-3">
                <input
                  type="number"
                  defaultValue={r.credits_per_unit}
                  className="w-20 bg-transparent border border-[#333] rounded px-2 py-1 text-white"
                  onBlur={(e) => handleSave(r.feature, Number(e.target.value))}
                />
              </td>
              <td className="p-3">{r.unit}</td>
              <td className="p-3">{r.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── SUBCOMPONENT: PlanLimitsEditor ───
function PlanLimitsEditor() {
  const [plans, setPlans] = useState<any[]>([]);

  useEffect(() => {
    adminFetch('/functions/v1/admin-api/plan-limits')
      .then(r => {
        if (r.ok && r.headers.get('content-type')?.includes('application/json')) return r.json();
        return {};
      })
      .then(d => {
        if (d.plans) setPlans(d.plans);
      });
  }, []);

  const handleSave = async (planName: string, field: string, value: any) => {
    try {
      const res = await adminFetch(`/functions/v1/admin-api/plan-limits/${planName}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value })
      });
      if (res.ok) {
        toast.success(`✓ ${planName} limit updated`);
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (!plans.length) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm text-[#888]">
        <thead className="bg-[#111] text-white">
          <tr>
            <th className="p-3">Limit</th>
            {plans.map(p => <th key={p.plan} className="p-3 capitalize">{p.plan}</th>)}
          </tr>
        </thead>
        <tbody>
          {['monthly_credits', 'max_video_minutes', 'max_file_size_mb', 'storage_gb', 'max_team_members'].map(field => (
            <tr key={field} className="border-b border-[#1F1F1F]">
              <td className="p-3 text-white">{field}</td>
              {plans.map(p => (
                <td key={p.plan} className="p-3">
                  <input
                    type="number"
                    defaultValue={p[field]}
                    className="w-full bg-transparent border border-[#333] rounded px-2 py-1 text-white"
                    onBlur={(e) => handleSave(p.plan, field, Number(e.target.value))}
                  />
                </td>
              ))}
            </tr>
          ))}
          {['can_burn_captions', 'can_dub', 'can_clone_voice', 'can_lip_sync', 'can_generate_video', 'watermark_forced'].map(field => (
            <tr key={field} className="border-b border-[#1F1F1F]">
              <td className="p-3 text-white">{field}</td>
              {plans.map(p => (
                <td key={p.plan} className="p-3 text-center">
                  <input
                    type="checkbox"
                    defaultChecked={p[field]}
                    onChange={(e) => handleSave(p.plan, field, e.target.checked)}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── SUBCOMPONENT: PlanPricingEditor ───
function PlanPricingEditor() {
  const [pricing, setPricing] = useState<any[]>([]);
  const [currency, setCurrency] = useState('INR');

  useEffect(() => {
    adminFetch('/functions/v1/admin-api/plan-pricing')
      .then(r => {
        if (r.ok && r.headers.get('content-type')?.includes('application/json')) return r.json();
        return {};
      })
      .then(d => {
        if (d.pricing) setPricing(d.pricing);
      });
  }, []);

  const handleSave = async (plan: string, field: string, value: any) => {
    try {
      const res = await adminFetch(`/functions/v1/admin-api/plan-pricing/${plan}/${currency}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value })
      });
      if (res.ok) toast.success(`✓ ${plan} price updated`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const filteredPricing = pricing.filter(p => p.currency === currency);

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <button onClick={() => setCurrency('INR')} className={`px-4 py-2 rounded ${currency === 'INR' ? 'bg-[#E60000] text-white' : 'bg-[#111] text-[#888]'}`}>INR</button>
        <button onClick={() => setCurrency('USD')} className={`px-4 py-2 rounded ${currency === 'USD' ? 'bg-[#E60000] text-white' : 'bg-[#111] text-[#888]'}`}>USD</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {filteredPricing.map(p => (
          <div key={p.plan} className="p-6 border border-[#1F1F1F] bg-[#0A0A0A] rounded-xl space-y-4">
            <h3 className="text-white font-bold capitalize text-xl">{p.plan}</h3>
            <div>
              <label className="text-[13px] text-[#888]">Monthly Price ({currency})</label>
              <input type="number" defaultValue={p.monthly_price} className="w-full bg-transparent border border-[#333] rounded px-3 py-2 text-white" onBlur={e => handleSave(p.plan, 'monthly_price', Number(e.target.value))} />
            </div>
            <div>
              <label className="text-[13px] text-[#888]">Yearly Price ({currency}/mo)</label>
              <input type="number" defaultValue={p.yearly_price} className="w-full bg-transparent border border-[#333] rounded px-3 py-2 text-white" onBlur={e => handleSave(p.plan, 'yearly_price', Number(e.target.value))} />
            </div>
            <div className="pt-4 border-t border-[#1F1F1F]">
              <label className="text-[13px] text-[#888]">Stripe Price ID (Monthly)</label>
              <input type="text" defaultValue={p.stripe_price_id_monthly} className="w-full bg-transparent border border-[#333] rounded px-3 py-2 text-white text-[13px]" onBlur={e => handleSave(p.plan, 'stripe_price_id_monthly', e.target.value)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SUBCOMPONENT: FeatureFlagsEditor ───
function FeatureFlagsEditor() {
  const [flags, setFlags] = useState<any[]>([]);

  useEffect(() => {
    adminFetch('/functions/v1/admin-api/feature-flags')
      .then(r => {
        if (r.ok && r.headers.get('content-type')?.includes('application/json')) return r.json();
        return {};
      })
      .then(d => {
        if (d.flags) setFlags(d.flags);
      });
  }, []);

  const handleToggle = async (featureName: string, enabledGlobal: boolean) => {
    if (!enabledGlobal) {
      if (!confirm(`Disable ${featureName} for ALL users? This is immediate.`)) return;
    }
    
    try {
      const res = await adminFetch(`/functions/v1/admin-api/feature-flags/${featureName}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled_global: enabledGlobal })
      });
      if (res.ok) {
        toast.success(`✓ ${featureName} is now ${enabledGlobal ? 'enabled' : 'disabled'}`);
        setFlags(flags.map(f => f.feature_name === featureName ? { ...f, enabled_global: enabledGlobal } : f));
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <table className="w-full text-left text-sm text-[#888]">
        <thead className="bg-[#111] text-white">
          <tr>
            <th className="p-3">Feature Name</th>
            <th className="p-3">Global Toggle</th>
            <th className="p-3">Plan Access</th>
            <th className="p-3">Beta</th>
          </tr>
        </thead>
        <tbody>
          {flags.map(f => (
            <tr key={f.feature_name} className={`border-b border-[#1F1F1F] ${!f.enabled_global ? 'bg-red-950/20' : ''}`}>
              <td className="p-3 text-white font-medium">{f.display_name}</td>
              <td className="p-3">
                <button
                  onClick={() => handleToggle(f.feature_name, !f.enabled_global)}
                  className={`px-3 py-1 text-[13px] font-bold rounded ${f.enabled_global ? 'bg-green-900/50 text-green-400' : 'bg-red-900 text-white'}`}
                >
                  {f.enabled_global ? 'ON' : 'OFF'}
                </button>
              </td>
              <td className="p-3">{f.enabled_plans?.length ? f.enabled_plans.join(', ') : 'All plans'}</td>
              <td className="p-3">{f.is_beta ? 'Beta' : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── SUBCOMPONENT: SystemSettingsEditor ───
function SystemSettingsEditor() {
  const [settings, setSettings] = useState<any[]>([]);

  useEffect(() => {
    adminFetch('/functions/v1/admin-api/system-settings')
      .then(r => {
        if (r.ok && r.headers.get('content-type')?.includes('application/json')) return r.json();
        return {};
      })
      .then(d => {
        if (d.settings) setSettings(d.settings);
      });
  }, []);

  const handleSave = async (key: string, value: any) => {
    if (key === 'maintenance_mode' && value === true) {
      if (!confirm("Enable maintenance mode? All users will be logged out.")) return;
    }

    try {
      const res = await adminFetch(`/functions/v1/admin-api/system-settings/${key}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value })
      });
      if (res.ok) {
        toast.success(`✓ Setting saved — applies immediately`);
        setSettings(settings.map(s => s.key === key ? { ...s, value } : s));
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-6">
      {settings.map(s => (
        <div key={s.key} className="p-6 border border-[#1F1F1F] bg-[#0A0A0A] rounded-xl flex justify-between items-center">
          <div>
            <h4 className="text-white font-medium">{s.key}</h4>
            <p className="text-[13px] text-[#888]">{s.description}</p>
          </div>
          <div>
            {typeof s.value === 'boolean' || s.value === 'true' || s.value === 'false' ? (
              <button
                onClick={() => handleSave(s.key, s.value === 'true' || s.value === true ? false : true)}
                className={`px-4 py-2 rounded font-bold ${s.value === 'true' || s.value === true ? 'bg-red-900 text-white' : 'bg-[#111] text-white'}`}
              >
                {s.value === 'true' || s.value === true ? 'Turn OFF' : 'Turn ON'}
              </button>
            ) : (
              <input
                type="text"
                defaultValue={typeof s.value === 'string' ? s.value.replace(/^"|"$/g, '') : JSON.stringify(s.value)}
                className="w-64 bg-transparent border border-[#333] rounded px-3 py-2 text-white"
                onBlur={e => handleSave(s.key, e.target.value)}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── SUBCOMPONENT: AuditLogViewer ───
function AuditLogViewer() {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    adminFetch('/functions/v1/admin-api/audit-log')
      .then(r => {
        if (r.ok && r.headers.get('content-type')?.includes('application/json')) return r.json();
        return {};
      })
      .then(d => {
        if (d.logs) setLogs(d.logs);
      });
  }, []);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm text-[#888]">
        <thead className="bg-[#111] text-white">
          <tr>
            <th className="p-3">Time</th>
            <th className="p-3">Admin</th>
            <th className="p-3">Action</th>
            <th className="p-3">Target</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(log => (
            <tr key={log.id} className="border-b border-[#1F1F1F]">
              <td className="p-3">{new Date(log.created_at).toLocaleString()}</td>
              <td className="p-3 text-white">{log.admin_email}</td>
              <td className="p-3">{log.action}</td>
              <td className="p-3">{log.target_type}: {log.target_id}</td>
            </tr>
          ))}
          {logs.length === 0 && (
            <tr>
              <td colSpan={4} className="p-4 text-center">No logs found</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}


import { TemplatesManager } from "@/components/admin/TemplatesManager";

export function AdminControlCenter() {
  return (
    <div className="admin-control-center max-w-7xl mx-auto p-6 bg-[#050505] min-h-screen">
      <AdminHeader />
      <Tabs defaultValue="templates-manager">
        <TabsList className="mb-6 flex flex-wrap gap-2 bg-transparent">
          <TabsTrigger value="templates-manager" className="data-[state=active]:bg-[#E60000] data-[state=active]:text-white bg-[#111] text-[#888] rounded px-4 py-2">🎨 Templates (165)</TabsTrigger>
          <TabsTrigger value="credit-rates" className="data-[state=active]:bg-[#E60000] data-[state=active]:text-white bg-[#111] text-[#888] rounded px-4 py-2">💳 Credit Rates</TabsTrigger>
          <TabsTrigger value="plan-limits" className="data-[state=active]:bg-[#E60000] data-[state=active]:text-white bg-[#111] text-[#888] rounded px-4 py-2">📊 Plan Limits</TabsTrigger>
          <TabsTrigger value="plan-pricing" className="data-[state=active]:bg-[#E60000] data-[state=active]:text-white bg-[#111] text-[#888] rounded px-4 py-2">💰 Pricing</TabsTrigger>
          <TabsTrigger value="feature-flags" className="data-[state=active]:bg-[#E60000] data-[state=active]:text-white bg-[#111] text-[#888] rounded px-4 py-2">🚩 Features</TabsTrigger>
          <TabsTrigger value="system-settings" className="data-[state=active]:bg-[#E60000] data-[state=active]:text-white bg-[#111] text-[#888] rounded px-4 py-2">⚙️ System</TabsTrigger>
          <TabsTrigger value="audit-log" className="data-[state=active]:bg-[#E60000] data-[state=active]:text-white bg-[#111] text-[#888] rounded px-4 py-2">📋 Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="templates-manager">
          <TemplatesManager />
        </TabsContent>
        <TabsContent value="credit-rates">
          <CreditRatesEditor />
        </TabsContent>
        <TabsContent value="plan-limits">
          <PlanLimitsEditor />
        </TabsContent>
        <TabsContent value="plan-pricing">
          <PlanPricingEditor />
        </TabsContent>
        <TabsContent value="feature-flags">
          <FeatureFlagsEditor />
        </TabsContent>
        <TabsContent value="system-settings">
          <SystemSettingsEditor />
        </TabsContent>
        <TabsContent value="audit-log">
          <AuditLogViewer />
        </TabsContent>
      </Tabs>
    </div>
  )
}

