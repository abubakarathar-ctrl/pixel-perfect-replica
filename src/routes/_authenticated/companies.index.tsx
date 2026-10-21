import { createFileRoute, Link } from "@tanstack/react-router";
import { Globe, MapPin } from "lucide-react";
import { useCompanies, cap } from "@/lib/data";
import { Chip, Empty, ScoreRing, TierChip } from "@/components/chips";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/companies/")({
  head: () => seo("Companies", "Every startup on the desk, with score, tier and open roles."),
  component: Companies,
});

function Companies() {
  const { data = [], isLoading } = useCompanies();
  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div><div className="eyebrow">Accounts</div><h1 className="mt-1 text-3xl font-semibold">Companies <span className="num text-lg text-muted-foreground">{data.length}</span></h1></div>
      {!isLoading && data.length === 0 && <Empty line="No companies yet. Import a CSV from Leads." />}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {data.map((c) => (
          <Link key={c.id} to="/companies/$id" params={{ id: c.id }} className="panel lift block p-4">
            <div className="flex items-start gap-3">
              <ScoreRing score={c.score} size={40} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.funding_stage} · <span className="num">{c.size}</span></div>
              </div>
            </div>
            <div className="my-3 h-px bg-border" />
            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5"><MapPin className="size-3" />{c.location}</div>
              {c.website && <div className="flex items-center gap-1.5 truncate"><Globe className="size-3" />{c.website.replace(/^https?:\/\//, "")}</div>}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <TierChip tier={c.tier} /><Chip>{cap(c.stage)}</Chip>
              <Chip>{c.jobs.length} roles</Chip>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
