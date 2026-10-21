import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Copy, Linkedin } from "lucide-react";
import { toast } from "sonner";
import { useCompanies } from "@/lib/data";
import { EmailChip, Empty, Initials, Chip } from "@/components/chips";
import { seo } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/contacts")({
  head: () => seo("Contacts", "Recruiters and decision makers across your leads."),
  component: Contacts,
});

function Contacts() {
  const { data = [], isLoading } = useCompanies();
  const [kind, setKind] = useState<"" | "recruiter_hr" | "decision_maker">("");
  const rows = data.flatMap((c) => c.contacts.map((p) => ({ ...p, company: c }))).filter((p) => !kind || p.contact_type === kind);
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><div className="eyebrow">People</div><h1 className="mt-1 text-3xl font-semibold">Contacts <span className="num text-lg text-muted-foreground">{rows.length}</span></h1></div>
        <div className="flex gap-1.5">
          {([["", "All"], ["recruiter_hr", "Recruiter / HR"], ["decision_maker", "Decision makers"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setKind(k)} className={cn("h-8 rounded-full border px-3 text-xs transition-colors duration-150", kind === k ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground")}>{l}</button>
          ))}
        </div>
      </div>
      <div className="panel">
        {!isLoading && rows.length === 0 && <Empty line="No contacts yet." />}
        {rows.map((p) => (
          <div key={p.id} className="row-hover flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-0">
            <Initials name={p.full_name} />
            <div className="min-w-[180px] flex-1">
              <div className="font-medium">{p.full_name}</div>
              <div className="text-xs text-muted-foreground">{p.title} · <Link to="/companies/$id" params={{ id: p.company.id }} className="hover:text-foreground">{p.company.name}</Link></div>
            </div>
            <Chip>{p.contact_type === "recruiter_hr" ? "Recruiter / HR" : "Decision maker"}</Chip>
            {p.email && <span className="num text-xs">{p.email}</span>}
            {p.email && <button aria-label="Copy email" className="text-muted-foreground hover:text-foreground" onClick={() => { navigator.clipboard.writeText(p.email!); toast.success("Email copied"); }}><Copy className="size-3.5" /></button>}
            <EmailChip status={p.email_status} />
            {p.linkedin_url && <a href={p.linkedin_url} target="_blank" rel="noreferrer" aria-label="LinkedIn" className="text-muted-foreground hover:text-primary"><Linkedin className="size-4" /></a>}
          </div>
        ))}
      </div>
    </div>
  );
}
