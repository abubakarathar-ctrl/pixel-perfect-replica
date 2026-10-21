import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe, useProfiles } from "@/lib/data";
import { Chip, Empty, Initials } from "@/components/chips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => seo("Settings", "Team members, roles and integration keys."),
  component: Settings,
});

const PROVIDERS = ["Apollo", "Hunter", "ZeroBounce", "HubSpot", "Gmail"];

function Settings() {
  const { data: me } = useMe();
  const { data: people = [] } = useProfiles();
  const qc = useQueryClient();

  async function setRole(userId: string, role: "admin" | "member") {
    if (userId === me?.id && role === "member") { toast.error("You can't demote yourself."); return; }
    const { error: e1 } = await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error: e2 } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (e1 || e2) { toast.error((e1 || e2)!.message); return; }
    toast.success("Role updated");
    qc.invalidateQueries({ queryKey: ["profiles"] });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div><div className="eyebrow">Workspace</div><h1 className="mt-1 text-3xl font-semibold">Settings</h1></div>

      <section className="panel">
        <div className="border-b border-border px-4 py-3"><h2 className="font-semibold">Team members</h2>
          <p className="text-xs text-muted-foreground">New sign-ups join as members. The first account is the admin.</p></div>
        {people.map((p) => (
          <div key={p.id} className="row-hover flex items-center gap-3 border-b border-border px-4 py-3 last:border-0">
            <Initials name={p.full_name ?? p.email ?? "?"} />
            <div className="flex-1"><div className="font-medium">{p.full_name}</div><div className="num text-xs text-muted-foreground">{p.email}</div></div>
            {me?.isAdmin ? (
              <select aria-label="Role" value={p.role} onChange={(e) => setRole(p.id, e.target.value as "admin" | "member")}
                className="h-8 rounded-md border border-border bg-card px-2 text-xs">
                <option value="admin">Admin</option><option value="member">Member</option>
              </select>
            ) : <Chip tone={p.role === "admin" ? "hot" : "neutral"}>{p.role}</Chip>}
          </div>
        ))}
      </section>

      {me?.isAdmin ? <ApiKeys /> : (
        <section className="panel"><Empty line="API keys are managed by admins." /></section>
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
