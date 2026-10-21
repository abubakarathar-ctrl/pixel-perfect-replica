import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useActivities, useCompanies, useMe, isToday, daysAgo, cap } from "@/lib/data";
import { fetchAndIngestRemoteJobs } from "@/lib/remote-jobs";
import { Chip, Empty, ScoreRing, TierChip } from "@/components/chips";
import { Button } from "@/components/ui/button";
import { seo } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/today")({
  head: () => seo("Today", "New leads, contract roles, verified emails and follow-ups due today."),
  component: Today,
});

function Today() {
  const { data: companies = [], isLoading } = useCompanies();
  const { data: acts = [] } = useActivities();
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [fetchingJobs, setFetchingJobs] = useState(false);

  async function handleFetchRemoteJobs() {
    setFetchingJobs(true);
    try {
      const res = await fetchAndIngestRemoteJobs();
      if (res.addedJobs > 0) {
        toast.success(res.message);
      } else {
        toast.info("All latest remote jobs are already synced.");
      }
      qc.invalidateQueries({ queryKey: ["companies"] });
    } catch (err) {
      toast.error((err as Error).message || "Failed to fetch remote jobs.");
    } finally {
      setFetchingJobs(false);
    }
  }

  const jobs = companies.flatMap((c) => c.jobs);
  const contacts = companies.flatMap((c) => c.contacts);
  const kpis = [
    { label: "New leads today", value: companies.filter((c) => isToday(c.created_at)).length },
    { label: "Contract roles", value: jobs.filter((j) => j.employment_type !== "full_time" && j.is_live).length },
    { label: "Verified emails", value: contacts.filter((c) => c.email_status === "valid").length },
    { label: "Replies this week", value: acts.filter((a) => a.type === "email" && /repl/i.test(a.body ?? "") && daysAgo(a.created_at) <= 7).length + companies.filter((c) => c.stage === "replied").length },
  ];
  const hot = companies.filter((c) => c.tier === "hot");
  const followups = companies.filter((c) => isToday(c.follow_up_date) && (!c.owner_id || c.owner_id === me?.id));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="eyebrow">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</div>
          <h1 className="mt-1 text-3xl font-semibold">Today on the desk</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleFetchRemoteJobs}
          disabled={fetchingJobs}
          className="gap-1.5"
        >
          <RefreshCw className={cn("size-3.5 text-primary", fetchingJobs && "animate-spin")} />
          {fetchingJobs ? "Syncing Remote Jobs..." : "Sync Daily Remote Jobs"}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius)] border border-border bg-border lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="bg-card p-4">
            <div className="eyebrow">{k.label}</div>
            <div className="num mt-2 text-3xl font-semibold">{isLoading ? "—" : String(k.value).padStart(2, "0")}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="panel lg:col-span-3">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="flex items-center gap-2 font-semibold"><span className="size-2 rounded-full bg-hot" /> Hot leads</h2>
            <Link to="/leads" className="text-xs text-muted-foreground hover:text-foreground">All leads →</Link>
          </div>
          {hot.length === 0 ? <Empty line="No hot leads yet. Bump a promising company to Hot." action={<Button size="sm" asChild><Link to="/leads">Review leads</Link></Button>} /> :
            <ul>
              {hot.map((c) => (
                <li key={c.id}>
                  <Link to="/companies/$id" params={{ id: c.id }} className="row-hover flex items-center gap-4 border-b border-border px-4 py-3 last:border-0">
                    <ScoreRing score={c.score} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{c.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{c.jobs.map((j) => j.title).join(" · ")}</div>
                    </div>
                    <div className="hidden gap-1.5 sm:flex">
                      {c.jobs.some((j) => j.employment_type === "contract") && <Chip tone="hot">Contract</Chip>}
                      {c.jobs.some((j) => j.remote_us) && <Chip>Remote US</Chip>}
                    </div>
                    <ArrowUpRight className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>}
        </section>

        <section className="panel lg:col-span-2">
          <div className="border-b border-border px-4 py-3"><h2 className="font-semibold">My follow-ups due today</h2></div>
          {followups.length === 0 ? <Empty line="Inbox zero on follow-ups. Nice." action={<Button size="sm" variant="outline" asChild><Link to="/pipeline">Open pipeline</Link></Button>} /> :
            <ul>
              {followups.map((c) => (
                <li key={c.id}>
                  <Link to="/companies/$id" params={{ id: c.id }} className="row-hover flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-0">
                    <div><div className="font-medium">{c.name}</div><div className="eyebrow mt-0.5">{cap(c.stage)}</div></div>
                    <TierChip tier={c.tier} />
                  </Link>
                </li>
              ))}
            </ul>}
        </section>
      </div>
    </div>
  );
}
