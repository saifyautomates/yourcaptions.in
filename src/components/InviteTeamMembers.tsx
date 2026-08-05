import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { usePlanInfo } from "@/hooks/usePlanInfo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UserPlus, Mail, Loader2, Lock, Crown } from "lucide-react";
import { Link } from "react-router-dom";

type TeamRole = "owner" | "admin" | "editor" | "viewer";

const ROLE_HINT: Record<TeamRole, string> = {
  owner: "Can manage team settings, billing, and members.",
  admin: "Can manage members and projects.",
  editor: "Can create and edit projects.",
  viewer: "Can only view projects.",
};

interface InviteTeamMembersProps {
  teamId: string;
  onInviteSuccess: () => void;
}

export function InviteTeamMembers({ teamId, onInviteSuccess }: InviteTeamMembersProps) {
  const { user } = useAuth();
  const { planId } = usePlanInfo();
  const isStudio = planId === "studio";

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamRole>("editor");
  const [inviting, setInviting] = useState(false);

  const invite = async () => {
    if (!user || !isStudio) return;
    
    const email = inviteEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Enter a valid email");
      return;
    }
    setInviting(true);
    const { data: inv, error } = await supabase
      .from("team_invitations")
      .insert({ team_id: teamId, email, role: inviteRole, invited_by: user.id })
      .select()
      .single();

    setInviting(false);

    if (error) {
      toast.error(error.message.includes("duplicate") ? "This email is already invited" : error.message);
      return;
    }

    toast.success("Invitation sent");
    setInviteEmail("");
    
    if (inv) {
      const url = `${window.location.origin}/dashboard/team?invite=${inv.token}`;
      navigator.clipboard.writeText(url).then(() => {
        toast("Invite link copied to clipboard", {
          description: "A secure link has been generated to share directly.",
        });
      });
    }

    onInviteSuccess();
  };

  if (!isStudio) {
    return (
      <section className="rounded-2xl border border-border bg-card/50 p-6 flex flex-col items-center justify-center text-center">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3">
          <Lock className="h-5 w-5" />
        </div>
        <h3 className="text-sm font-semibold mb-1">Team Invitations Locked</h3>
        <p className="text-xs text-muted-foreground max-w-sm mb-4">
          Inviting members to collaborate is exclusively available on the Studio plan. Upgrade to invite your team.
        </p>
        <Link
          to="/dashboard/billing"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Crown className="h-3.5 w-3.5" />
          Upgrade to Studio
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card/50 p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <UserPlus className="h-4 w-4 text-primary" /> Invite by email
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          value={inviteEmail}
          onChange={(e) => setInviteEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") invite(); }}
          placeholder="teammate@company.com"
          className="min-w-0 flex-1 rounded-lg border border-border bg-input/60 px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <select
          value={inviteRole}
          onChange={(e) => setInviteRole(e.target.value as TeamRole)}
          className="rounded-lg border border-border bg-input/60 px-3 py-2 text-sm"
        >
          <option value="admin">Admin</option>
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
        </select>
        <button
          onClick={invite}
          disabled={inviting || !inviteEmail.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          Invite
        </button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{ROLE_HINT[inviteRole]}</p>
    </section>
  );
}
