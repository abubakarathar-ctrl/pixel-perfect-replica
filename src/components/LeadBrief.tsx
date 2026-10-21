import { useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { generateLeadBrief } from "@/lib/lead-brief.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { Activity, CompanyFull } from "@/lib/data";

function buildProfile(c: CompanyFull) {
  return [
    `${c.name} — ${c.funding_stage ?? "stage unknown"}, ${c.size ?? "?"} employees, ${c.location ?? "location unknown"}.`,
    c.website && `Website: ${c.website}`,
    `Score ${c.score}/100, tier ${c.tier}, pipeline stage ${c.stage}.`,
    c.jobs.length && `Open roles: ${c.jobs.map((j) => `${j.title} (${j.employment_type.replace("_", " ")}${j.remote_us ? ", remote US" : ""})`).join("; ")}.`,
    c.contacts.length && `Contacts: ${c.contacts.map((p) => `${p.full_name}, ${p.title} (email ${p.email_status})`).join("; ")}.`,
  ].filter(Boolean).join("\n");
}

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i} className="text-foreground">{part.slice(2, -2)}</strong> : part,
  );
}

function Brief({ text }: { text: string }) {
  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {text.split("\n").filter((l) => l.trim()).map((l, i) => {
        const t = l.replace(/^#+\s*/, "");
        if (/^\s*[-*•]\s+/.test(t)) return <div key={i} className="flex gap-2 pl-1"><span className="text-primary">•</span><span>{inline(t.replace(/^\s*[-*•]\s+/, ""))}</span></div>;
        const action = /recommended next action/i.test(t);
        return <p key={i} className={action ? "mt-3 rounded-md border border-primary/40 bg-primary/10 p-3" : ""}>{inline(t)}</p>;
      })}
    </div>
  );
}

export function LeadBrief({ company, activities }: { company: CompanyFull; activities: Activity[] }) {
  const run = useServerFn(generateLeadBrief);
  const [profile, setProfile] = useState(() => buildProfile(company));
  const [notes, setNotes] = useState(() => activities.slice(0, 15).map((a) => `- [${a.type}] ${a.body}`).join("\n"));
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function go() {
    setBusy(true); setError("");
    try {
      const r = await run({ data: { profile, notes } });
      if ("error" in r) setError(r.error); else setBrief(r.brief);
    } catch (e) {
      setError((e as Error).message.includes("profile") ? "Add a bit more company profile." : "Couldn't generate the brief. Please try again.");
    } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="panel space-y-3 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="brief-profile">Company profile</Label>
          <Textarea id="brief-profile" rows={7} value={profile} onChange={(e) => setProfile(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="brief-notes">Activity notes</Label>
          <Textarea id="brief-notes" rows={6} placeholder="Calls, emails, replies, objections…" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <Button onClick={go} disabled={busy || profile.trim().length < 10} className="w-full">
          <Sparkles /> {busy ? "Writing brief…" : brief ? "Regenerate brief" : "Generate lead brief"}
        </Button>
      </div>
      <div className="panel p-4" aria-live="polite">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Lead brief</h3>
          {brief && <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => { navigator.clipboard.writeText(brief); toast.success("Brief copied"); }}>Copy</button>}
        </div>
        {error ? <p className="text-sm text-invalid">{error}</p>
          : busy ? <div className="space-y-2">{[90, 75, 85, 60].map((w) => <div key={w} className="h-3 animate-pulse rounded bg-secondary" style={{ width: `${w}%` }} />)}</div>
          : brief ? <Brief text={brief} />
          : <p className="text-sm text-muted-foreground">Review the profile and notes, then generate an AI-powered brief with a recommended next action.</p>}
      </div>
    </div>
  );
}
