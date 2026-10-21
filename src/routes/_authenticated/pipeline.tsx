import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Globe } from "lucide-react";
import { toast } from "sonner";
import { useCompanies, useProfiles, useUpdateCompany, STAGES, cap, fmtDate, type Stage } from "@/lib/data";
import { Chip, ScoreRing, TierChip } from "@/components/chips";
import { seo } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/pipeline")({
  head: () => seo("Pipeline", "Drag leads across New, Verified, Contacted, Replied, Meeting, Won and Lost."),
  component: Pipeline,
});

const stageDot: Record<Stage, string> = {
  new: "bg-muted-foreground", verified: "bg-cold", contacted: "bg-warm", replied: "bg-warm",
  meeting: "bg-hot", won: "bg-hot", lost: "bg-invalid",
};

function Pipeline() {
  const { data: companies = [] } = useCompanies();
  const { data: people = [] } = useProfiles();
  const update = useUpdateCompany();
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<Stage | null>(null);

  function move(id: string, stage: Stage) {
    const c = companies.find((x) => x.id === id);
    if (!c || c.stage === stage) return;
    update.mutate({ ids: [id], patch: { stage } }, { onSuccess: () => toast.success(`${c.name} → ${cap(stage)}`) });
  }

  return (
    <div className="space-y-4">
      <div><div className="eyebrow">Board</div><h1 className="mt-1 text-3xl font-semibold">Pipeline</h1></div>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {STAGES.map((s) => {
          const list = companies.filter((c) => c.stage === s);
          return (
            <div key={s}
              onDragOver={(e) => { e.preventDefault(); setOver(s); }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); setOver(null); setDrag(null); move(id, s); }}
              className={cn("flex w-72 shrink-0 flex-col gap-2 rounded-[var(--radius)] p-1 transition-colors duration-150", over === s && "bg-accent")}>
              <div className="panel flex items-center gap-2 px-3 py-2">
                <span className={cn("size-2 rounded-full", stageDot[s])} />
                <span className="text-sm font-medium">{cap(s)}</span>
                <span className="num ml-auto rounded border border-border px-1.5 text-xs text-muted-foreground">{list.length} leads</span>
              </div>
              {list.length === 0 && <div className="rounded-[var(--radius)] border border-dashed border-border p-6 text-center text-xs text-muted-foreground">Drop a lead here</div>}
              {list.map((c) => {
                const lead = c.contacts.find((p) => p.contact_type === "decision_maker") ?? c.contacts[0];
                return (
                  <div key={c.id} draggable
                    onDragStart={(e) => { e.dataTransfer.setData("text/plain", c.id); setDrag(c.id); }}
                    onDragEnd={() => setDrag(null)}
                    className={cn("panel lift cursor-grab p-3 active:cursor-grabbing", drag === c.id && "dragging opacity-80")}>
                    <div className="flex items-start gap-3">
                      <ScoreRing score={c.score} size={36} />
                      <div className="min-w-0 flex-1">
                        <Link to="/companies/$id" params={{ id: c.id }} className="block truncate font-medium hover:text-primary">{c.name}</Link>
                        <div className="num text-xs text-muted-foreground">{fmtDate(c.created_at)}</div>
                      </div>
                      {/* keyboard alternative to dragging */}
                      <select aria-label={`Move ${c.name}`} value={c.stage} onChange={(e) => move(c.id, e.target.value as Stage)}
                        className="h-6 w-6 cursor-pointer appearance-none rounded border-0 bg-transparent text-center text-muted-foreground hover:bg-accent focus-visible:w-auto">
                        {STAGES.map((x) => <option key={x} value={x}>{cap(x)}</option>)}
                      </select>
                    </div>
                    <div className="my-2.5 h-px bg-border" />
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {lead && <div className="truncate">{lead.full_name} · {lead.title}</div>}
                      {lead?.email && <div className="num truncate">{lead.email}</div>}
                      {c.website && <div className="flex items-center gap-1 truncate"><Globe className="size-3" />{c.website.replace(/^https?:\/\//, "")}</div>}
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      <TierChip tier={c.tier} />
                      {c.jobs.some((j) => j.employment_type === "contract") && <Chip>Contract</Chip>}
                      <span className="ml-auto text-xs text-muted-foreground">{people.find((p) => p.id === c.owner_id)?.full_name ?? "Unassigned"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
