import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useCompanies, STAGES, ROLE_FAMILIES, cap } from "@/lib/data";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => seo("Reports", "Leads per day, leads by role family and the New-to-Won funnel."),
  component: Reports,
});

const axis = { stroke: "var(--muted-foreground)", fill: "var(--muted-foreground)", fontSize: 12, fontFamily: "var(--font-mono)", tickLine: false, axisLine: false };
const tip = { contentStyle: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontFamily: "var(--font-mono)", fontSize: 12 }, cursor: { fill: "var(--accent)" } };

function Reports() {
  const { data = [] } = useCompanies();
  const jobs = data.flatMap((c) => c.jobs);

  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (13 - i));
    const key = d.toISOString().slice(0, 10);
    return { day: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), leads: jobs.filter((j) => j.found_date === key).length };
  });
  const families = ROLE_FAMILIES.map((f) => ({ family: f, leads: new Set(jobs.filter((j) => j.role_family === f).map((j) => j.company_id)).size }));
  const order = STAGES.filter((s) => s !== "lost");
  const funnel = order.map((s, i) => ({ stage: s, count: data.filter((c) => c.stage !== "lost" && order.indexOf(c.stage) >= i).length }));
  const max = funnel[0]?.count || 1;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div><div className="eyebrow">Analytics</div><h1 className="mt-1 text-3xl font-semibold">Reports</h1></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-4">
          <h2 className="mb-4 font-semibold">Leads per day</h2>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={days}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" {...axis} interval={2} />
                <YAxis {...axis} allowDecimals={false} width={24} />
                <Tooltip {...tip} />
                <Line type="monotone" dataKey="leads" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 2.5, fill: "var(--primary)" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="panel p-4">
          <h2 className="mb-4 font-semibold">Leads by role family</h2>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={families}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="family" {...axis} />
                <YAxis {...axis} allowDecimals={false} width={24} />
                <Tooltip {...tip} />
                <Bar dataKey="leads" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
      <section className="panel p-4">
        <h2 className="mb-4 font-semibold">Funnel: New → Won</h2>
        <div className="space-y-2">
          {funnel.map((f) => (
            <div key={f.stage} className="flex items-center gap-3">
              <span className="eyebrow w-20">{cap(f.stage)}</span>
              <div className="h-7 flex-1 overflow-hidden rounded bg-secondary">
                <div className="h-full rounded bg-primary transition-all duration-150" style={{ width: `${(f.count / max) * 100}%` }} />
              </div>
              <span className="num w-16 text-right text-sm">{f.count} <span className="text-muted-foreground">{Math.round((f.count / max) * 100)}%</span></span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
