import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Copy, ExternalLink, Globe, Linkedin } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActivities, useCompany, useMe, useUpdateCompany, STAGES, TIERS, cap, fmtDate, type Contact, type Stage, type Tier } from "@/lib/data";
import { LeadBrief } from "@/components/LeadBrief";
import { Chip, EmailChip, Empty, Initials, ScoreRing, TierChip } from "@/components/chips";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/companies/$id")({
  head: () => seo("Company", "Company jobs, contacts and activity."),
  component: CompanyPage,
});

const sel = "h-8 rounded-md border border-border bg-card px-2 text-xs";

function CompanyPage() {
  const { id } = Route.useParams();
  const { data: c, isLoading } = useCompany(id);
  const { data: acts = [] } = useActivities(id);
  const { data: me } = useMe();
  const update = useUpdateCompany();
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [type, setType] = useState<"note" | "email" | "call" | "meeting">("note");

  if (isLoading) return <div className="eyebrow">Loading…</div>;
  if (!c) return <Empty line="This company isn't on your desk." action={<Button asChild size="sm"><Link to="/leads">Back to leads</Link></Button>} />;

  async function log() {
    if (!note.trim() || !me) return;
    const { error } = await supabase.from("activities").insert({ company_id: id, user_id: me.id, type, body: note.trim() });
    if (error) { toast.error(error.message); return; }
    setNote("");
    qc.invalidateQueries({ queryKey: ["activities"] });
  }

  const recruiters = c.contacts.filter((x) => x.contact_type === "recruiter_hr");
  const deciders = c.contacts.filter((x) => x.contact_type === "decision_maker");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link to="/leads" className="text-xs text-muted-foreground hover:text-foreground">← Leads</Link>
      <div className="panel flex flex-wrap items-center gap-5 p-5">
        <ScoreRing score={c.score} size={72} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold">{c.name}</h1>
            <TierChip tier={c.tier} />
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>{c.funding_stage}</span><span className="num">{c.size} ppl</span><span>{c.location}</span>
            {c.website && <a href={c.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground"><Globe className="size-3.5" />{c.website.replace(/^https?:\/\//, "")}</a>}
            {c.linkedin_url && <a href={c.linkedin_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground"><Linkedin className="size-3.5" />LinkedIn</a>}
          </div>
        </div>
        <div className="flex gap-2">
          <select aria-label="Tier" className={sel} value={c.tier} onChange={(e) => update.mutate({ ids: [c.id], patch: { tier: e.target.value as Tier } })}>
            {TIERS.map((t) => <option key={t} value={t}>{cap(t)}</option>)}
          </select>
          <select aria-label="Stage" className={sel} value={c.stage} onChange={(e) => update.mutate({ ids: [c.id], patch: { stage: e.target.value as Stage } })}>
            {STAGES.map((t) => <option key={t} value={t}>{cap(t)}</option>)}
          </select>
        </div>
      </div>

      <Tabs defaultValue="jobs">
        <TabsList>
          <TabsTrigger value="jobs">Jobs <span className="num ml-1 text-muted-foreground">{c.jobs.length}</span></TabsTrigger>
          <TabsTrigger value="contacts">Contacts <span className="num ml-1 text-muted-foreground">{c.contacts.length}</span></TabsTrigger>
          <TabsTrigger value="brief">AI brief</TabsTrigger>
          <TabsTrigger value="activity">Activity <span className="num ml-1 text-muted-foreground">{acts.length}</span></TabsTrigger>
        </TabsList>

        <TabsContent value="jobs" className="panel mt-3">
          {c.jobs.length === 0 ? <Empty line="No open roles tracked yet." /> : c.jobs.map((j) => (
            <div key={j.id} className="row-hover flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-0">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{j.title}</div>
                <div className="num text-xs text-muted-foreground">{j.source} · found {fmtDate(j.found_date)}</div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Chip>{j.role_family}</Chip>
                <Chip tone={j.employment_type === "contract" ? "hot" : j.employment_type === "contract_friendly" ? "warm" : "neutral"}>
                  {j.employment_type === "contract" ? "Contract" : j.employment_type === "contract_friendly" ? "Contract-friendly" : "Full-time"}
                </Chip>
                {j.remote_us && <Chip>Remote US</Chip>}
                {!j.is_live && <Chip tone="invalid">Closed</Chip>}
              </div>
              {j.job_url && <a href={j.job_url} target="_blank" rel="noreferrer" aria-label="Open job" className="text-muted-foreground hover:text-foreground"><ExternalLink className="size-4" /></a>}
            </div>
          ))}
        </TabsContent>

        <TabsContent value="contacts" className="mt-3 grid gap-4 md:grid-cols-2">
          <ContactGroup title="Recruiter / HR" list={recruiters} />
          <ContactGroup title="Decision makers" list={deciders} />
        </TabsContent>

        <TabsContent value="brief" className="mt-3">
          <LeadBrief company={c} activities={acts} />
        </TabsContent>

        <TabsContent value="activity" className="mt-3 space-y-3">
          <div className="panel space-y-2 p-3">
            <Textarea placeholder="Log a note, call or email…" value={note} onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") log(); }} />
            <div className="flex items-center gap-2">
              <select aria-label="Activity type" className={sel} value={type} onChange={(e) => setType(e.target.value as typeof type)}>
                {(["note", "email", "call", "meeting"] as const).map((t) => <option key={t} value={t}>{cap(t)}</option>)}
              </select>
              <span className="eyebrow ml-auto hidden sm:inline">⌘↵ to log</span>
              <Button size="sm" onClick={log} disabled={!note.trim()}>Log activity</Button>
            </div>
          </div>
          <div className="panel">
            {acts.length === 0 ? <Empty line="Nothing logged yet. Start the thread." /> : acts.map((a) => (
              <div key={a.id} className="flex gap-3 border-b border-border px-4 py-3 last:border-0">
                <span className="eyebrow w-24 shrink-0 pt-0.5">{a.type.replace("_", " ")}</span>
                <p className="flex-1 text-sm">{a.body}</p>
                <span className="num shrink-0 text-xs text-muted-foreground">{fmtDate(a.created_at)}</span>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ContactGroup({ title, list }: { title: string; list: Contact[] }) {
  return (
    <div className="panel">
      <div className="eyebrow border-b border-border px-4 py-2.5">{title}</div>
      {list.length === 0 ? <Empty line="No one here yet." /> : list.map((p) => (
        <div key={p.id} className="row-hover flex items-start gap-3 border-b border-border px-4 py-3 last:border-0">
          <Initials name={p.full_name} />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{p.full_name}</span>
              {p.linkedin_url && <a href={p.linkedin_url} target="_blank" rel="noreferrer" aria-label="LinkedIn" className="text-muted-foreground hover:text-primary"><Linkedin className="size-3.5" /></a>}
            </div>
            <div className="text-xs text-muted-foreground">{p.title}</div>
            {p.email && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="num truncate text-xs">{p.email}</span>
                <button aria-label="Copy email" className="text-muted-foreground hover:text-foreground"
                  onClick={() => { navigator.clipboard.writeText(p.email!); toast.success("Email copied"); }}><Copy className="size-3.5" /></button>
                <EmailChip status={p.email_status} />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
