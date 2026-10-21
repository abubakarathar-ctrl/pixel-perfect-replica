import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useCompanies, useMe, useProfiles, ROLE_LABEL, type TeamRole } from "@/lib/data";
import { inviteTeamMember } from "@/lib/team.functions";
import { Chip, Empty, Initials } from "@/components/chips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => seo("Settings", "Team members, roles and integration keys."),
  component: Settings,
});

const PROVIDERS = ["Apollo", "Hunter", "ZeroBounce", "HubSpot", "Gmail"];

function Settings() {
  const { data: me } = useMe();
  const { data: people = [] } = useProfiles();
  const { data: companies = [] } = useCompanies();
  const qc = useQueryClient();
  const invite = useServerFn(inviteTeamMember);
  const [form, setForm] = useState<{ fullName: string; email: string; role: TeamRole }>({ fullName: "", email: "", role: "bd" });
  const [busy, setBusy] = useState(false);

  async function setRole(userId: string, role: TeamRole) {
    if (userId === me?.id && role !== "owner") { toast.error("You can't change your own owner role."); return; }
    const { error: e1 } = await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error: e2 } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (e1 || e2) { toast.error((e1 || e2)!.message); return; }
    toast.success("Role updated");
    qc.invalidateQueries({ queryKey: ["profiles"] });
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await invite({ data: { ...form, redirectTo: window.location.origin } });
      if ("error" in r) { toast.error(r.error); return; }
      toast.success(`Invite sent to ${form.email}`);
      setForm({ fullName: "", email: "", role: "bd" });
      qc.invalidateQueries({ queryKey: ["profiles"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setBusy(false); }
  }

  const roleOptions: TeamRole[] = me?.isOwner ? ["owner", "manager", "bd"] : ["bd"];
  const sel = "h-9 rounded-md border border-border bg-card px-2 text-sm";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div><div className="eyebrow">Workspace</div><h1 className="mt-1 text-3xl font-semibold">Settings</h1></div>

      {me?.isManager && (
        <section className="panel">
          <div className="border-b border-border px-4 py-3"><h2 className="font-semibold">Add team member</h2>
            <p className="text-xs text-muted-foreground">They get an email invite to set a password. Owners manage everything, managers see and assign all leads, BD reps see their own and unassigned leads.</p></div>
          <form onSubmit={add} className="grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto_auto]">
            <div className="space-y-1"><Label htmlFor="tm-name">Full name</Label>
              <Input id="tm-name" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div>
            <div className="space-y-1"><Label htmlFor="tm-email">Email</Label>
              <Input id="tm-email" type="email" required className="num" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-1"><Label htmlFor="tm-role">Role</Label>
              <select id="tm-role" className={sel} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as TeamRole })}>
                {roleOptions.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select></div>
            <Button type="submit" className="self-end" disabled={busy}>{busy ? "Sending…" : "Send invite"}</Button>
          </form>
        </section>
      )}

      <section className="panel">
        <div className="border-b border-border px-4 py-3"><h2 className="font-semibold">Team members <span className="num text-sm text-muted-foreground">{people.length}</span></h2>
          <p className="text-xs text-muted-foreground">Assign leads to people from the Owner column on the Leads page.</p></div>
        {people.map((p) => {
          const owned = companies.filter((c) => c.owner_id === p.id).length;
          return (
            <div key={p.id} className="row-hover flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-0">
              <Initials name={p.full_name ?? p.email ?? "?"} />
              <div className="min-w-0 flex-1"><div className="font-medium">{p.full_name}{p.id === me?.id && <span className="text-muted-foreground"> (you)</span>}</div><div className="num truncate text-xs text-muted-foreground">{p.email}</div></div>
              <Link to="/leads" className="num text-xs text-muted-foreground hover:text-foreground">{owned} leads</Link>
              {me?.isOwner ? (
                <select aria-label={`Role for ${p.full_name}`} value={p.role} onChange={(e) => setRole(p.id, e.target.value as TeamRole)} className="h-8 rounded-md border border-border bg-card px-2 text-xs">
                  {(["owner", "manager", "bd"] as TeamRole[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </select>
              ) : <Chip tone={p.role === "owner" ? "hot" : p.role === "manager" ? "warm" : "neutral"}>{ROLE_LABEL[p.role]}</Chip>}
            </div>
          );
        })}
      </section>

      {me?.isOwner ? <ApiKeys /> : (
        <section className="panel"><Empty line="API keys are managed by the owner." /></section>
      )}
    </div>
  );
}

function ApiKeys() {
  const qc = useQueryClient();
  const { data: keys = [] } = useQuery({
    queryKey: ["api_keys"],
    queryFn: async () => {
      const { data, error } = await supabase.from("api_keys").select("provider, last4, updated_at");
      if (error) throw error;
      return data;
    },
  });
  const [draft, setDraft] = useState<Record<string, string>>({});

  async function save(provider: string) {
    const v = draft[provider]?.trim();
    if (!v || v.length < 8) { toast.error("That key looks too short."); return; }
    const { error } = await supabase.from("api_keys").upsert({ provider, secret_value: v, last4: v.slice(-4), updated_at: new Date().toISOString() });
    if (error) { toast.error(error.message); return; }
    setDraft({ ...draft, [provider]: "" });
    toast.success(`${provider} key saved`);
    qc.invalidateQueries({ queryKey: ["api_keys"] });
  }
  async function remove(provider: string) {
    const { error } = await supabase.from("api_keys").delete().eq("provider", provider);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["api_keys"] });
  }

  return (
    <section className="panel">
      <div className="border-b border-border px-4 py-3"><h2 className="font-semibold">API keys</h2>
        <p className="text-xs text-muted-foreground">Stored server-side. Once saved, only the last 4 characters are ever shown.</p></div>
      {PROVIDERS.map((p) => {
        const k = keys.find((x) => x.provider === p);
        return (
          <div key={p} className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-0">
            <div className="w-28 font-medium">{p}</div>
            {k ? <span className="num flex-1 text-sm text-muted-foreground">••••••••••••{k.last4}</span> :
              <Input type="password" className="num h-8 max-w-xs flex-1" placeholder={`Paste ${p} key`} value={draft[p] ?? ""}
                onChange={(e) => setDraft({ ...draft, [p]: e.target.value })} onKeyDown={(e) => e.key === "Enter" && save(p)} />}
            {k ? <>
              <Chip tone="hot">Connected</Chip>
              <Button size="sm" variant="ghost" onClick={() => remove(p)}>Remove</Button>
            </> : <Button size="sm" onClick={() => save(p)}>Save</Button>}
          </div>
        );
      })}
    </section>
  );
}
