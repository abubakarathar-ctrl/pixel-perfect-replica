import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanies, useProfiles, useUpdateCompany, STAGES, TIERS, ROLE_FAMILIES, cap, daysAgo, fmtDate, toCSV, parseCSV, type Tier, type Stage } from "@/lib/data";
import { Chip, Empty } from "@/components/chips";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { seo } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/leads")({
  head: () => seo("Leads", "Filter, assign, import and export staffing leads."),
  component: Leads,
});

const sel = "h-8 rounded-md border border-border bg-card px-2 text-xs text-foreground focus-visible:outline-1";
const tierText: Record<Tier, string> = { hot: "text-hot", warm: "text-warm", cold: "text-cold" };

function Leads() {
  const { data: companies = [], isLoading } = useCompanies();
  const { data: people = [] } = useProfiles();
  const update = useUpdateCompany();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [f, setF] = useState({ contract: false, remote: false, family: "", found: "", tier: "", stage: "", owner: "" });
  const [picked, setPicked] = useState<string[]>([]);

  const rows = useMemo(() => companies.filter((c) => {
    if (f.contract && !c.jobs.some((j) => j.employment_type !== "full_time")) return false;
    if (f.remote && !c.jobs.some((j) => j.remote_us)) return false;
    if (f.family && !c.jobs.some((j) => j.role_family === f.family)) return false;
    if (f.found && !c.jobs.some((j) => daysAgo(j.found_date) <= Number(f.found))) return false;
    if (f.tier && c.tier !== f.tier) return false;
    if (f.stage && c.stage !== f.stage) return false;
    if (f.owner === "none" && c.owner_id) return false;
    if (f.owner && f.owner !== "none" && c.owner_id !== f.owner) return false;
    return true;
  }), [companies, f]);

  const nameOf = (id: string | null) => people.find((p) => p.id === id)?.full_name ?? "Unassigned";

  function exportCSV() {
    const csv = toCSV(rows.map((c) => ({
      name: c.name, website: c.website, linkedin_url: c.linkedin_url, size: c.size, funding_stage: c.funding_stage,
      location: c.location, score: c.score, tier: c.tier, stage: c.stage, owner: nameOf(c.owner_id),
      roles: c.jobs.map((j) => j.title).join(" | "),
    })));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `signaldesk-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  async function importCSV(file: File) {
    const parsed = parseCSV(await file.text()).filter((r) => r["name"]);
    if (!parsed.length) { toast.error("No rows found. The CSV needs a 'name' column."); return; }
    const rows = parsed.map((raw) => { const r = raw as Record<string, string | undefined> & { name: string; website?: string; linkedin_url?: string; size?: string; funding_stage?: string; location?: string; score?: string; tier?: string; stage?: string }; return {
      name: r.name, website: r.website || null, linkedin_url: r.linkedin_url || null, size: r.size || null,
      funding_stage: r.funding_stage || null, location: r.location || null,
      score: Math.max(0, Math.min(100, Number(r.score) || 50)),
      tier: (TIERS.includes(r.tier as Tier) ? r.tier : "cold") as Tier,
      stage: (STAGES.includes(r.stage as Stage) ? r.stage : "new") as Stage,
    }; });
    const { error } = await supabase.from("companies").insert(rows);
    if (error) { toast.error(error.message); return; }
    toast.success(`Imported ${rows.length} leads`);
    qc.invalidateQueries({ queryKey: ["companies"] });
  }

  const allPicked = rows.length > 0 && rows.every((r) => picked.includes(r.id));

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><div className="eyebrow">Database</div><h1 className="mt-1 text-3xl font-semibold">Leads <span className="num text-lg text-muted-foreground">{rows.length}</span></h1></div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const x = e.target.files?.[0]; if (x) importCSV(x); e.target.value = ""; }} />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload /> Import CSV</Button>
          <Button size="sm" onClick={exportCSV}><Download /> Export</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {([["contract", "Contract"], ["remote", "Remote US"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setF({ ...f, [k]: !f[k] })}
            className={cn("h-8 rounded-full border px-3 text-xs transition-colors duration-150", f[k] ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground")}>{l}</button>
        ))}
        <select aria-label="Role family" className={sel} value={f.family} onChange={(e) => setF({ ...f, family: e.target.value })}>
          <option value="">All roles</option>{ROLE_FAMILIES.map((r) => <option key={r}>{r}</option>)}
        </select>
        <select aria-label="Found date" className={sel} value={f.found} onChange={(e) => setF({ ...f, found: e.target.value })}>
          <option value="">Any date</option><option value="1">Last 24h</option><option value="3">Last 3 days</option><option value="7">Last 7 days</option>
        </select>
        <select aria-label="Tier" className={sel} value={f.tier} onChange={(e) => setF({ ...f, tier: e.target.value })}>
          <option value="">All tiers</option>{TIERS.map((t) => <option key={t} value={t}>{cap(t)}</option>)}
        </select>
        <select aria-label="Stage" className={sel} value={f.stage} onChange={(e) => setF({ ...f, stage: e.target.value })}>
          <option value="">All stages</option>{STAGES.map((t) => <option key={t} value={t}>{cap(t)}</option>)}
        </select>
        <select aria-label="Owner" className={sel} value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })}>
          <option value="">Any owner</option><option value="none">Unassigned</option>{people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select>
      </div>

      {picked.length > 0 && (
        <div className="panel flex items-center gap-3 px-3 py-2 text-sm">
          <span className="num">{picked.length} selected</span>
          <select aria-label="Bulk assign" className={sel} defaultValue="" onChange={(e) => {
            if (!e.target.value) return;
            update.mutate({ ids: picked, patch: { owner_id: e.target.value === "none" ? null : e.target.value } },
              { onSuccess: () => { toast.success("Assigned"); setPicked([]); } });
            e.target.value = "";
          }}>
            <option value="">Assign to…</option><option value="none">Unassigned</option>{people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
          <button className="ml-auto text-xs text-muted-foreground hover:text-foreground" onClick={() => setPicked([])}>Clear</button>
        </div>
      )}

      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="eyebrow border-b border-border text-left">
              <th className="w-10 px-3 py-2.5"><Checkbox aria-label="Select all" checked={allPicked} onCheckedChange={(v) => setPicked(v ? rows.map((r) => r.id) : [])} /></th>
              <th className="px-3 py-2.5 font-normal">Company</th>
              <th className="px-3 py-2.5 font-normal">Roles</th>
              <th className="px-3 py-2.5 font-normal">Score</th>
              <th className="px-3 py-2.5 font-normal">Tier</th>
              <th className="px-3 py-2.5 font-normal">Stage</th>
              <th className="px-3 py-2.5 font-normal">Owner</th>
              <th className="px-3 py-2.5 font-normal">Found</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const latest = c.jobs.map((j) => j.found_date).sort().reverse()[0];
              return (
                <tr key={c.id} className="row-hover border-b border-border last:border-0">
                  <td className="px-3 py-2"><Checkbox aria-label={`Select ${c.name}`} checked={picked.includes(c.id)} onCheckedChange={(v) => setPicked(v ? [...picked, c.id] : picked.filter((x) => x !== c.id))} /></td>
                  <td className="px-3 py-2">
                    <Link to="/companies/$id" params={{ id: c.id }} className="font-medium hover:text-primary">{c.name}</Link>
                    <div className="text-xs text-muted-foreground">{c.funding_stage} · {c.location}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {[...new Set(c.jobs.map((j) => j.role_family))].map((r) => <Chip key={r}>{r}</Chip>)}
                      {c.jobs.some((j) => j.employment_type === "contract") && <Chip tone="hot">Contract</Chip>}
                      {c.jobs.some((j) => j.remote_us) && <Chip>Remote US</Chip>}
                    </div>
                  </td>
                  <td className="num px-3 py-2">{c.score}</td>
                  <td className="px-3 py-2">
                    <select aria-label="Tier" value={c.tier} className={cn(sel, "font-medium", tierText[c.tier])}
                      onChange={(e) => update.mutate({ ids: [c.id], patch: { tier: e.target.value as Tier } })}>
                      {TIERS.map((t) => <option key={t} value={t}>{cap(t)}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-xs">{cap(c.stage)}</td>
                  <td className="px-3 py-2">
                    <select aria-label="Owner" value={c.owner_id ?? ""} className={sel}
                      onChange={(e) => update.mutate({ ids: [c.id], patch: { owner_id: e.target.value || null } })}>
                      <option value="">Unassigned</option>{people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                    </select>
                  </td>
                  <td className="num px-3 py-2 text-xs text-muted-foreground">{latest ? fmtDate(latest) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!isLoading && rows.length === 0 && <Empty line="No leads match those filters." action={<Button size="sm" variant="outline" onClick={() => setF({ contract: false, remote: false, family: "", found: "", tier: "", stage: "", owner: "" })}>Reset filters</Button>} />}
      </div>
    </div>
  );
}
