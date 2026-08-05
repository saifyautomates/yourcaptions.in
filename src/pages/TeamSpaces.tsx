import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { InviteTeamMembers } from "@/components/InviteTeamMembers";
import { useAuth } from "@/hooks/useAuth";
import { usePlanInfo } from "@/hooks/usePlanInfo";
import { Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Users, Plus, Mail, Trash2, Copy, Loader2, Shield, Crown, Pencil, Eye,
  Check, X, LogOut, UserPlus, Sparkles,
} from "lucide-react";

type TeamRole = "owner" | "admin" | "editor" | "viewer";

type Team = { id: string; name: string; slug: string; owner_id: string };
type Member = {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamRole;
  created_at: string;
  full_name: string | null;
  avatar_url: string | null;
};
type Invitation = {
  id: string;
  team_id: string;
  email: string;
  role: TeamRole;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  invited_by: string;
};
type PendingInvite = {
  id: string;
  team_id: string;
  team_name: string;
  role: TeamRole;
  token: string;
  expires_at: string;
  invited_by: string;
  invited_by_name: string | null;
};

const ROLE_ICON: Record<TeamRole, any> = {
  owner: Crown, admin: Shield, editor: Pencil, viewer: Eye,
};
const ROLE_LABEL: Record<TeamRole, string> = {
  owner: "Owner", admin: "Admin", editor: "Editor", viewer: "Viewer",
};
const ROLE_HINT: Record<TeamRole, string> = {
  owner: "Full control · cannot be removed",
  admin: "Manage members, projects, and settings",
  editor: "Create and edit team projects",
  viewer: "See team projects (read-only)",
};

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) ||
  `team-${Math.random().toString(36).slice(2, 8)}`;

const TeamSpaces = () => {
  const { user } = useAuth();
  const { planId } = usePlanInfo();
  const isStudio = planId === "studio";

  const [teams, setTeams] = useState<Team[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [pending, setPending] = useState<PendingInvite[]>([]);
  const [projectCount, setProjectCount] = useState(0);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);


  const activeTeam = useMemo(() => teams.find((t) => t.id === activeId) ?? null, [teams, activeId]);
  const myRole: TeamRole | null = useMemo(() => {
    if (!user) return null;
    return members.find((m) => m.user_id === user.id)?.role ?? null;
  }, [members, user]);
  const canManage = myRole === "owner" || myRole === "admin";
  const isOwner = myRole === "owner";

  const loadTeams = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: teamRows }, { data: invRows }] = await Promise.all([
      supabase.from("teams").select("id,name,slug,owner_id").order("created_at"),
      supabase.rpc("my_pending_invitations"),
    ]);
    setTeams((teamRows as Team[]) ?? []);
    setPending((invRows as PendingInvite[]) ?? []);
    setActiveId((prev) => prev ?? (teamRows?.[0]?.id ?? null));
    setLoading(false);
  }, [user]);

  const loadTeamDetail = useCallback(async (teamId: string) => {
    // Members joined with profiles
    const { data: mem, error: mErr } = await supabase
      .from("team_members")
      .select("id,team_id,user_id,role,created_at,profiles:profiles!inner(full_name,avatar_url)")
      .eq("team_id", teamId)
      .order("created_at");
    if (mErr) toast.error(mErr.message);
    const flat: Member[] = (mem ?? []).map((m: any) => ({
      id: m.id, team_id: m.team_id, user_id: m.user_id, role: m.role, created_at: m.created_at,
      full_name: m.profiles?.full_name ?? null, avatar_url: m.profiles?.avatar_url ?? null,
    }));
    setMembers(flat);

    const { data: inv } = await supabase
      .from("team_invitations")
      .select("*")
      .eq("team_id", teamId)
      .is("accepted_at", null)
      .order("created_at", { ascending: false });
    setInvitations((inv as Invitation[]) ?? []);

    const { count } = await supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId);
    setProjectCount(count ?? 0);
  }, []);

  useEffect(() => { loadTeams(); }, [loadTeams]);
  useEffect(() => { if (activeId) loadTeamDetail(activeId); }, [activeId, loadTeamDetail]);

  const createTeam = async () => {
    if (!user || !newName.trim()) return;
    setCreating(true);
    const { data, error } = await supabase.from("teams").insert({
      name: newName.trim(),
      slug: `${slugify(newName)}-${Math.random().toString(36).slice(2, 6)}`,
      owner_id: user.id,
    }).select("id,name,slug,owner_id").single();
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    setNewName("");
    setShowCreate(false);
    setTeams((t) => [...t, data as Team]);
    setActiveId((data as Team).id);
    toast.success("Team created");
  };

  const invite = async () => {
    if (!activeTeam || !user) return;
    const email = inviteEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Enter a valid email");
      return;
    }
    setInviting(true);
    const { data, error } = await supabase
      .from("team_invitations")
      .insert({ team_id: activeTeam.id, email, role: inviteRole, invited_by: user.id })
      .select("*")
      .single();
    setInviting(false);
    if (error) {
      toast.error(error.message.includes("duplicate") ? "This email is already invited" : error.message);
      return;
    }
    setInvitations((list) => [data as Invitation, ...list]);
    setInviteEmail("");
    toast.success(`Invitation created for ${email}`);
  };

  const copyInviteLink = async (inv: Invitation) => {
    const url = `${window.location.origin}/dashboard/team?invite=${inv.token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Invite link copied");
    } catch {
      toast.message(url);
    }
  };

  const revokeInvite = async (id: string) => {
    const prev = invitations;
    setInvitations((list) => list.filter((i) => i.id !== id));
    const { error } = await supabase.from("team_invitations").delete().eq("id", id);
    if (error) { setInvitations(prev); toast.error(error.message); }
    else toast.success("Invitation revoked");
  };

  const changeRole = async (m: Member, next: TeamRole) => {
    if (m.role === "owner" || next === "owner") return;
    const prev = members;
    setMembers((list) => list.map((x) => (x.id === m.id ? { ...x, role: next } : x)));
    const { error } = await supabase.from("team_members").update({ role: next }).eq("id", m.id);
    if (error) { setMembers(prev); toast.error(error.message); }
  };

  const removeMember = async (m: Member) => {
    if (m.role === "owner") return;
    if (!confirm(`Remove ${m.full_name ?? "this member"} from ${activeTeam?.name}?`)) return;
    const prev = members;
    setMembers((list) => list.filter((x) => x.id !== m.id));
    const { error } = await supabase.from("team_members").delete().eq("id", m.id);
    if (error) { setMembers(prev); toast.error(error.message); }
    else toast.success("Member removed");
  };

  const leaveTeam = async () => {
    if (!user || !activeTeam || myRole === "owner") return;
    if (!confirm(`Leave "${activeTeam.name}"?`)) return;
    const { error } = await supabase
      .from("team_members").delete()
      .eq("team_id", activeTeam.id).eq("user_id", user.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Left team");
    setTeams((t) => t.filter((x) => x.id !== activeTeam.id));
    setActiveId(null);
  };

  const deleteTeam = async () => {
    if (!activeTeam || !isOwner) return;
    if (!confirm(`Delete "${activeTeam.name}"? This removes all memberships and unlinks projects.`)) return;
    const { error } = await supabase.from("teams").delete().eq("id", activeTeam.id);
    if (error) { toast.error(error.message); return; }
    setTeams((t) => t.filter((x) => x.id !== activeTeam.id));
    setActiveId(null);
    toast.success("Team deleted");
  };

  const acceptInvite = async (token: string) => {
    const { data, error } = await supabase.rpc("accept_team_invitation", { _token: token });
    if (error) { toast.error(error.message); return; }
    toast.success("Joined team");
    setPending((p) => p.filter((i) => i.token !== token));
    await loadTeams();
    if (data) setActiveId(data as string);
  };

  const declineInvite = async (invId: string) => {
    // User can't delete invitation (RLS scopes delete to managers). Best effort: hide locally.
    setPending((p) => p.filter((i) => i.id !== invId));
  };

  // Auto-accept from URL param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("invite");
    if (!token || !user) return;
    (async () => {
      const { data, error } = await supabase.rpc("accept_team_invitation", { _token: token });
      if (error) { toast.error(error.message); return; }
      toast.success("Invitation accepted");
      const url = new URL(window.location.href);
      url.searchParams.delete("invite");
      window.history.replaceState({}, "", url.toString());
      await loadTeams();
      if (data) setActiveId(data as string);
    })();
  }, [user, loadTeams]);

  const RoleBadge = ({ role }: { role: TeamRole }) => {
    const I = ROLE_ICON[role];
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card/60 px-2 py-0.5 text-[10px] font-medium capitalize">
        <I className="h-3 w-3" /> {ROLE_LABEL[role]}
      </span>
    );
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">Team spaces</h1>
            <p className="mt-1 text-muted-foreground">Invite teammates, assign roles, and share projects.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate((s) => !s)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> New team
          </button>
        </header>

        {/* Pending invitations */}
        {pending.length > 0 && (
          <section className="rounded-2xl border border-primary/40 bg-primary/5 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-primary" /> You have {pending.length} pending invitation{pending.length === 1 ? "" : "s"}
            </div>
            <ul className="space-y-2">
              {pending.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background/50 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.team_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Invited as {ROLE_LABEL[p.role]}
                      {p.invited_by_name ? ` by ${p.invited_by_name}` : ""}
                      {" · expires "}{new Date(p.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => acceptInvite(p.token)}
                      className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                    >
                      <Check className="h-3 w-3" /> Accept
                    </button>
                    <button
                      onClick={() => declineInvite(p.id)}
                      className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      Dismiss
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Create team form */}
        {showCreate && (
          <section className="rounded-2xl border border-border bg-card/50 p-4">
            <label className="mb-1.5 block text-sm font-medium">Team name</label>
            <div className="flex gap-2">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Acme Studio"
                onKeyDown={(e) => { if (e.key === "Enter") createTeam(); }}
                className="flex-1 rounded-lg border border-border bg-input/60 px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <button
                onClick={createTeam}
                disabled={!newName.trim() || creating}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground"
              >
                Cancel
              </button>
            </div>
          </section>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : teams.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/30 p-12 text-center text-sm text-muted-foreground">
            You're not in any team spaces yet. Create one to start inviting teammates.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-[220px_1fr]">
            {/* Team switcher */}
            <aside className="space-y-1">
              {teams.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveId(t.id)}
                  className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    activeId === t.id
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-card/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Users className="h-4 w-4 shrink-0" />
                  <span className="truncate">{t.name}</span>
                </button>
              ))}
            </aside>

            {/* Active team detail */}
            {activeTeam && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
                  <div>
                    <h2 className="text-2xl font-semibold">{activeTeam.name}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {members.length} member{members.length === 1 ? "" : "s"} · {projectCount} project{projectCount === 1 ? "" : "s"}
                      {myRole && <> · <RoleBadge role={myRole} /></>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {myRole && myRole !== "owner" && (
                      <button
                        onClick={leaveTeam}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-destructive/50 hover:text-destructive"
                      >
                        <LogOut className="h-3.5 w-3.5" /> Leave
                      </button>
                    )}
                    {isOwner && (
                      <button
                        onClick={deleteTeam}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete team
                      </button>
                    )}
                  </div>
                </div>

                {/* Invite */}
                {canManage && (
                  <InviteTeamMembers teamId={activeTeam.id} onInviteSuccess={() => loadTeamDetail(activeTeam.id)} />
                )}

                {/* Pending team invitations */}
                {canManage && invitations.length > 0 && (
                  <section>
                    <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Pending invitations</h3>
                    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card/40">
                      {invitations.map((inv) => (
                        <li key={inv.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{inv.email}</p>
                            <p className="text-xs text-muted-foreground">
                              {ROLE_LABEL[inv.role]} · expires {new Date(inv.expires_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => copyInviteLink(inv)}
                              className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                              title="Copy invite link"
                            >
                              <Copy className="h-3.5 w-3.5" /> Copy link
                            </button>
                            {isStudio && (
                              <button
                                onClick={() => revokeInvite(inv.id)}
                                className="inline-flex items-center gap-1 rounded-md border border-destructive/20 bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/20"
                                title="Revoke invitation"
                              >
                                <X className="h-3.5 w-3.5" /> Revoke
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {/* Members */}
                <section>
                  <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Members</h3>
                  <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card/40">
                    {members.map((m) => {
                      const RoleI = ROLE_ICON[m.role];
                      const isSelf = m.user_id === user?.id;
                      const canEdit = canManage && m.role !== "owner" && !isSelf;
                      return (
                        <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                          <div className="flex min-w-0 items-center gap-3">
                            {m.avatar_url ? (
                              <img src={m.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                            ) : (
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                                {(m.full_name ?? "?").slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {m.full_name ?? "Unnamed member"}
                                {isSelf && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                Joined {new Date(m.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {canEdit ? (
                              <select
                                value={m.role}
                                onChange={(e) => changeRole(m, e.target.value as TeamRole)}
                                className="rounded-md border border-border bg-input/60 px-2 py-1 text-xs"
                              >
                                <option value="admin">Admin</option>
                                <option value="editor">Editor</option>
                                <option value="viewer">Viewer</option>
                              </select>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card/60 px-2 py-0.5 text-[11px] font-medium capitalize">
                                <RoleI className="h-3 w-3" /> {ROLE_LABEL[m.role]}
                              </span>
                            )}
                            {canEdit && (
                              <button
                                onClick={() => removeMember(m)}
                                className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                title="Remove"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default TeamSpaces;
