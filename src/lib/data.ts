import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type T = Database["public"]["Tables"];
export type Company = T["companies"]["Row"];
export type Job = T["jobs"]["Row"];
export type Contact = T["contacts"]["Row"];
export type Activity = T["activities"]["Row"];
export type Profile = T["profiles"]["Row"];
export type Tier = Database["public"]["Enums"]["lead_tier"];
export type Stage = Database["public"]["Enums"]["pipeline_stage"];

export const STAGES: Stage[] = ["new", "verified", "contacted", "replied", "meeting", "won", "lost"];
export const TIERS: Tier[] = ["hot", "warm", "cold"];
export const ROLE_FAMILIES = ["DevOps", "SRE", "Cloud", "Data", "ML", "Security"];
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export type TeamRole = "owner" | "manager" | "bd";
export const ROLE_LABEL: Record<TeamRole, string> = { owner: "Owner", manager: "Manager", bd: "BD rep" };
export function normRole(r?: string | null): TeamRole {
  if (r === "owner" || r === "admin") return "owner";
  if (r === "manager") return "manager";
  return "bd";
}

export type CompanyFull = Company & { jobs: Job[]; contacts: Contact[] };

export function useCompanies() {
  return useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*, jobs(*), contacts(*)")
        .order("score", { ascending: false });
      if (error) throw error;
      return data as CompanyFull[];
    },
  });
}

export function useCompany(id: string) {
  return useQuery({
    queryKey: ["company", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*, jobs(*), contacts(*)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as CompanyFull | null;
    },
  });
}

export function useActivities(companyId?: string) {
  return useQuery({
    queryKey: ["activities", companyId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("activities").select("*").order("created_at", { ascending: false }).limit(200);
      if (companyId) q = q.eq("company_id", companyId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const [{ data: p, error }, { data: r }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (error) throw error;
      return (p ?? []).map((x) => ({
        ...x,
        role: normRole(r?.find((y) => y.user_id === x.id)?.role),
      }));
    },
  });
}

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return null;
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const role = normRole(roles?.[0]?.role);
      return { id: user.id, email: user.email ?? "", role, isOwner: role === "owner", isManager: role !== "bd", isAdmin: role === "owner" };
    },
  });
}

export function useUpdateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, patch }: { ids: string[]; patch: T["companies"]["Update"] }) => {
      const { error } = await supabase.from("companies").update(patch).in("id", ids);
      if (error) throw error;
    },
    onMutate: async ({ ids, patch }) => {
      await qc.cancelQueries({ queryKey: ["companies"] });
      const prev = qc.getQueryData<CompanyFull[]>(["companies"]);
      qc.setQueryData<CompanyFull[]>(["companies"], (old) =>
        old?.map((c) => (ids.includes(c.id) ? { ...c, ...patch } as CompanyFull : c)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(["companies"], ctx.prev),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["company"] });
      qc.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

export const isToday = (d: string | null) => !!d && new Date(d).toDateString() === new Date().toDateString();
export const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-US", { month: "short", day: "2-digit" });
export const daysAgo = (d: string) => (Date.now() - new Date(d).getTime()) / 86400000;

export function toCSV(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]!);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [keys.join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\n");
}

export function parseCSV(text: string): Record<string, string>[] {
  const lines: string[][] = [];
  let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); lines.push(row); row = []; cur = "";
    } else cur += ch;
  }
  if (cur || row.length) { row.push(cur); lines.push(row); }
  const [head, ...rest] = lines.filter((l) => l.some((c) => c.trim()));
  if (!head) return [];
  return rest.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

