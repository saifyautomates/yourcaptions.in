import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Save, Shield, UserPlus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SectionHeader } from "@/components/admin/primitives";

type SettingRow = { key: string; value: any };

const KEYS = ["maintenance_mode", "plan_limits", "upload_rules", "feature_flags"] as const;

async function loadSettings(): Promise<Record<string, any>> {
  const { data } = await (supabase.from("platform_settings" as any) as any).select("key,value").in("key", KEYS as any);
  const map: Record<string, any> = {};
  ((data as unknown as SettingRow[]) ?? []).forEach((r) => (map[r.key] = r.value));
  return map;
}

async function saveSetting(key: string, value: any) {
  const { error } = await (supabase.rpc as any)("admin_update_setting", { _key: key, _value: value });
  if (error) throw error;
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, any> | null>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [wipeConfirm, setWipeConfirm] = useState(false);
  const [wipeDays, setWipeDays] = useState(30);

  const refresh = async () => setSettings(await loadSettings());
  useEffect(() => { void refresh(); }, []);

  const patch = (key: string, patch: any) =>
    setSettings((s) => ({ ...(s ?? {}), [key]: { ...(s?.[key] ?? {}), ...patch } }));

  const save = async (key: string) => {
    try { await saveSetting(key, settings?.[key]); toast.success("Saved"); }
    catch (e: any) { toast.error(e.message); }
  };

  const inviteAdmin = async () => {
    if (!adminEmail.includes("@")) return toast.error("Invalid email");
    const { error } = await (supabase.rpc as any)("admin_set_role", { _email: adminEmail, _role: "admin", _grant: true });
    if (error) toast.error(error.message);
    else { toast.success(`Admin granted to ${adminEmail} (they must sign up first if new)`); setAdminEmail(""); }
  };

  const doWipe = async () => {
    const cutoff = new Date(Date.now() - wipeDays * 86400 * 1000).toISOString();
    const { error } = await supabase.from("export_metrics").delete().lt("created_at", cutoff);
    if (error) toast.error(error.message);
    else { toast.success(`Wiped export records older than ${wipeDays} days`); setWipeConfirm(false); }
  };

  if (!settings) return <div className="text-sm text-muted-foreground">Loading…</div>;

  const maint = settings.maintenance_mode ?? { enabled: false, message: "" };
  const limits = settings.plan_limits ?? { free_minutes: 30, pro_minutes: 300, team_minutes: 1800 };
  const upload = settings.upload_rules ?? { max_upload_mb: 1024, allowed_types: [] };
  const flags = settings.feature_flags ?? {};

  return (
    <div className="space-y-6">
      <SectionHeader title="Settings" description="Platform-wide configuration and admin controls." />

      <Card className="border-border/60">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Maintenance mode</p>
              <p className="text-[13px] text-muted-foreground">Shows a banner across the public site.</p>
            </div>
            <Switch checked={!!maint.enabled} onCheckedChange={(v) => patch("maintenance_mode", { enabled: v })} />
          </div>
          <Textarea
            value={maint.message ?? ""}
            onChange={(e) => patch("maintenance_mode", { message: e.target.value })}
            placeholder="Message shown to visitors"
            rows={2}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={() => save("maintenance_mode")}><Save className="mr-2 h-4 w-4" />Save</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <p className="text-sm font-medium">Default plan limits (minutes / month)</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {(["free_minutes", "pro_minutes", "team_minutes"] as const).map((k) => (
              <div key={k}>
                <Label className="text-[13px]">{k.replace("_minutes", "").toUpperCase()}</Label>
                <Input type="number" value={limits[k] ?? 0} onChange={(e) => patch("plan_limits", { [k]: Number(e.target.value) })} />
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => save("plan_limits")}><Save className="mr-2 h-4 w-4" />Save</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <p className="text-sm font-medium">Upload rules</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-[13px]">Max upload (MB)</Label>
              <Input type="number" value={upload.max_upload_mb ?? 1024} onChange={(e) => patch("upload_rules", { max_upload_mb: Number(e.target.value) })} />
            </div>
            <div>
              <Label className="text-[13px]">Allowed file types (comma-separated)</Label>
              <Input
                value={(upload.allowed_types ?? []).join(", ")}
                onChange={(e) => patch("upload_rules", { allowed_types: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => save("upload_rules")}><Save className="mr-2 h-4 w-4" />Save</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardContent className="space-y-3 p-4 sm:p-5">
          <p className="text-sm font-medium">Feature flags</p>
          {Object.keys(flags).length === 0 && <p className="text-[13px] text-muted-foreground">No flags configured yet.</p>}
          {Object.entries(flags).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between">
              <Label className="text-sm">{k}</Label>
              <Switch checked={!!v} onCheckedChange={(nv) => patch("feature_flags", { [k]: nv })} />
            </div>
          ))}
          <div className="flex justify-end">
            <Button size="sm" onClick={() => save("feature_flags")}><Save className="mr-2 h-4 w-4" />Save</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardContent className="space-y-3 p-4 sm:p-5">
          <p className="text-sm font-medium flex items-center gap-2"><Shield className="h-4 w-4" />Invite an admin</p>
          <p className="text-[13px] text-muted-foreground">Grant the admin role to an existing account by email. If the account doesn't exist yet, ask them to sign up first, then run this.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input type="email" placeholder="user@example.com" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
            <Button onClick={inviteAdmin}><UserPlus className="mr-2 h-4 w-4" />Grant admin</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-red-500/30">
        <CardContent className="space-y-3 p-4 sm:p-5">
          <p className="text-sm font-medium text-red-400">Danger zone</p>
          <p className="text-[13px] text-muted-foreground">Permanently wipe export records older than N days.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input type="number" min={1} value={wipeDays} onChange={(e) => setWipeDays(Number(e.target.value))} className="sm:w-32" />
            <Button variant="destructive" onClick={() => setWipeConfirm(true)}><Trash2 className="mr-2 h-4 w-4" />Wipe exports</Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={wipeConfirm} onOpenChange={setWipeConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Wipe old exports?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes all <strong>export_metrics</strong> older than {wipeDays} days. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doWipe} className="bg-red-500 hover:bg-red-600">Wipe</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
