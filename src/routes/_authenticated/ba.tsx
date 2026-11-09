import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  BarChart3,
  Building,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  FileUp,
  HelpCircle,
  Layers,
  Percent,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  Upload,
  UserCheck,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import {
  getBAStore,
  saveBAStore,
  parseExcelOrCsvFile,
  commitParsedData,
  generateSampleExcelTemplate,
  type BAAnalyticsStore,
  type BDPerformanceRecord,
  type CloserPerformanceRecord,
  type ParsedSheetResult,
} from "@/lib/ba-analytics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Chip, Initials } from "@/components/chips";
import { seo } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/ba")({
  head: () => seo("BA Dashboard", "Business Analyst Hub — Excel sheet ingestion, BD & closer metrics sync."),
  component: BADashboardPage,
});

const chartAxis = {
  stroke: "var(--muted-foreground)",
  fill: "var(--muted-foreground)",
  fontSize: 12,
  fontFamily: "var(--font-mono)",
  tickLine: false,
  axisLine: false,
};

const chartTip = {
  contentStyle: {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    fontFamily: "var(--font-mono)",
    fontSize: 12,
  },
  cursor: { fill: "var(--accent)" },
};

function BADashboardPage() {
  const [store, setStore] = useState<BAAnalyticsStore>(() => getBAStore());
  const [activeTab, setActiveTab] = useState<"overview" | "bd" | "closers" | "upload">("overview");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all");
  const [bdSearch, setBdSearch] = useState("");
  const [closerSearch, setCloserSearch] = useState("");

  // File upload staging state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [stagedResult, setStagedResult] = useState<ParsedSheetResult | null>(null);

  // Subscribe to updates from other tabs or actions
  useEffect(() => {
    function handleUpdate() {
      setStore(getBAStore());
    }
    window.addEventListener("ba-analytics-updated", handleUpdate);
    return () => window.removeEventListener("ba-analytics-updated", handleUpdate);
  }, []);

  // Filtered BD Records
  const filteredBD = useMemo(() => {
    return store.bdRecords.filter((r) => {
      if (selectedPeriod !== "all" && r.period !== selectedPeriod) return false;
      if (bdSearch && !r.bdName.toLowerCase().includes(bdSearch.toLowerCase())) return false;
      return true;
    });
  }, [store.bdRecords, selectedPeriod, bdSearch]);

  // Filtered Closer Records
  const filteredClosers = useMemo(() => {
    return store.closerRecords.filter((r) => {
      if (selectedPeriod !== "all" && r.period !== selectedPeriod) return false;
      if (closerSearch && !r.closerName.toLowerCase().includes(closerSearch.toLowerCase())) return false;
      return true;
    });
  }, [store.closerRecords, selectedPeriod, closerSearch]);

  // Distinct periods for selector
  const availablePeriods = useMemo(() => {
    const set = new Set<string>();
    store.bdRecords.forEach((r) => r.period && set.add(r.period));
    store.closerRecords.forEach((r) => r.period && set.add(r.period));
    return Array.from(set);
  }, [store]);

  // Aggregated KPIs
  const kpis = useMemo(() => {
    const totalApplies = filteredBD.reduce((acc, r) => acc + (r.applies || 0), 0);
    const totalLeadsGen = filteredBD.reduce((acc, r) => acc + (r.leadsGenerated || 0), 0);
    const totalLeadsQual = filteredBD.reduce((acc, r) => acc + (r.leadsQualified || 0), 0);
    const applyToLeadRate = totalApplies > 0 ? ((totalLeadsGen / totalApplies) * 100).toFixed(1) : "0.0";
    const leadQualRate = totalLeadsGen > 0 ? ((totalLeadsQual / totalLeadsGen) * 100).toFixed(1) : "0.0";

    const totalMeetings = filteredClosers.reduce((acc, r) => acc + (r.meetingsHeld || 0), 0);
    const totalDealsClosed = filteredClosers.reduce((acc, r) => acc + (r.dealsClosed || 0), 0);
    const totalRevenue = filteredClosers.reduce((acc, r) => acc + (r.revenueGenerated || 0), 0);
    const overallCloseRate = totalMeetings > 0 ? ((totalDealsClosed / totalMeetings) * 100).toFixed(1) : "0.0";

    return {
      totalApplies,
      totalLeadsGen,
      totalLeadsQual,
      applyToLeadRate,
      leadQualRate,
      totalMeetings,
      totalDealsClosed,
      totalRevenue,
      overallCloseRate,
      activeBDs: new Set(filteredBD.map((r) => r.bdName)).size,
      activeClosers: new Set(filteredClosers.map((r) => r.closerName)).size,
    };
  }, [filteredBD, filteredClosers]);

  // Chart data: BD breakdown
  const bdChartData = useMemo(() => {
    // group by BD Name
    const map = new Map<string, { name: string; applies: number; leads: number; qualified: number }>();
    filteredBD.forEach((r) => {
      const existing = map.get(r.bdName) || { name: r.bdName, applies: 0, leads: 0, qualified: 0 };
      existing.applies += r.applies;
      existing.leads += r.leadsGenerated;
      existing.qualified += r.leadsQualified;
      map.set(r.bdName, existing);
    });
    return Array.from(map.values()).slice(0, 8);
  }, [filteredBD]);

  // Chart data: Closer breakdown
  const closerChartData = useMemo(() => {
    const map = new Map<string, { name: string; meetings: number; won: number; revenue: number }>();
    filteredClosers.forEach((r) => {
      const existing = map.get(r.closerName) || { name: r.closerName, meetings: 0, won: 0, revenue: 0 };
      existing.meetings += r.meetingsHeld;
      existing.won += r.dealsClosed;
      existing.revenue += r.revenueGenerated;
      map.set(r.closerName, existing);
    });
    return Array.from(map.values()).slice(0, 8);
  }, [filteredClosers]);

  // Handle file select
  async function handleFileProcess(file: File) {
    if (!file) return;
    setIsParsing(true);
    setStagedFile(file);
    try {
      const parsed = await parseExcelOrCsvFile(file);
      setStagedResult(parsed);
      setActiveTab("upload");
      toast.info(`Parsed ${file.name}: ${parsed.summary}`);
    } catch (err) {
      toast.error(`Error parsing spreadsheet: ${(err as Error).message}`);
      setStagedFile(null);
      setStagedResult(null);
    } finally {
      setIsParsing(false);
    }
  }

  function handleConfirmSync() {
    if (!stagedFile || !stagedResult) return;
    const { store: updated, log } = commitParsedData(stagedResult, stagedFile.name, stagedFile.size);
    setStore(updated);
    setStagedFile(null);
    setStagedResult(null);
    toast.success(`Synced "${log.fileName}" to all affected dashboards!`);
    setActiveTab("overview");
  }

  function handleResetSample() {
    localStorage.removeItem("signaldesk_ba_analytics_v1");
    setStore(getBAStore());
    toast.success("Reset BA metrics to baseline benchmark data.");
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="eyebrow">Data Intelligence</span>
            <span className="flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 font-mono text-[11px] text-primary">
              <span className="size-1.5 rounded-full bg-primary animate-pulse" />
              Live Sync Active
            </span>
          </div>
          <h1 className="mt-1 text-3xl font-semibold">Business Analyst Hub</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Ingest Excel metrics for BD applies, qualified leads, and closers with live sync to Admin & Head desks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx, .xls, .csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileProcess(file);
              e.target.value = "";
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={generateSampleExcelTemplate}
            className="h-8 gap-1.5 text-xs"
          >
            <Download className="size-3.5 text-muted-foreground" />
            Download Excel Template
          </Button>

          <Button
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isParsing}
            className="h-8 gap-1.5 text-xs"
          >
            <FileSpreadsheet className="size-3.5" />
            {isParsing ? "Parsing Sheet..." : "Upload Excel Sheet"}
          </Button>
        </div>
      </div>

      {/* Downstream Sync Architecture Status Cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="panel relative overflow-hidden p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded bg-primary/15 text-primary">
                <Building className="size-4" />
              </span>
              <div>
                <div className="font-medium text-sm">Admin Dashboard</div>
                <div className="text-[11px] text-muted-foreground">Executive Rollup</div>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-400">
              <CheckCircle2 className="size-3" /> Synced
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2 text-xs">
            <span className="text-muted-foreground">Total Pipelined</span>
            <span className="num font-semibold">${(kpis.totalRevenue / 1000).toFixed(0)}K</span>
          </div>
        </div>

        <div className="panel relative overflow-hidden p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded bg-hot/15 text-hot">
                <Target className="size-4" />
              </span>
              <div>
                <div className="font-medium text-sm">BD Head Dashboard</div>
                <div className="text-[11px] text-muted-foreground">Applies & Qual Roster</div>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-400">
              <CheckCircle2 className="size-3" /> Synced
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2 text-xs">
            <span className="text-muted-foreground">Active BD Reps</span>
            <span className="num font-semibold">{kpis.activeBDs} Reps · {kpis.totalApplies} Applies</span>
          </div>
        </div>

        <div className="panel relative overflow-hidden p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded bg-warm/15 text-warm">
                <UserCheck className="size-4" />
              </span>
              <div>
                <div className="font-medium text-sm">Closer Head Dashboard</div>
                <div className="text-[11px] text-muted-foreground">Meetings & Win Rates</div>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-400">
              <CheckCircle2 className="size-3" /> Synced
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2 text-xs">
            <span className="text-muted-foreground">Win Rate</span>
            <span className="num font-semibold">{kpis.overallCloseRate}% ({kpis.totalDealsClosed} Won)</span>
          </div>
        </div>
      </div>

      {/* KPI Stats Rollup */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius)] border border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
        <div className="bg-card p-4">
          <div className="eyebrow">BD Applies</div>
          <div className="num mt-2 text-2xl font-semibold">{kpis.totalApplies.toLocaleString()}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">{kpis.activeBDs} active BD reps</div>
        </div>

        <div className="bg-card p-4">
          <div className="eyebrow">Leads Generated</div>
          <div className="num mt-2 text-2xl font-semibold text-primary">{kpis.totalLeadsGen.toLocaleString()}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">{kpis.applyToLeadRate}% apply-to-lead</div>
        </div>

        <div className="bg-card p-4">
          <div className="eyebrow">Leads Qualified</div>
          <div className="num mt-2 text-2xl font-semibold text-hot">{kpis.totalLeadsQual.toLocaleString()}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">{kpis.leadQualRate}% qualification rate</div>
        </div>

        <div className="bg-card p-4">
          <div className="eyebrow">Closer Meetings</div>
          <div className="num mt-2 text-2xl font-semibold">{kpis.totalMeetings.toLocaleString()}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">{kpis.activeClosers} active closers</div>
        </div>

        <div className="bg-card p-4">
          <div className="eyebrow">Deals Won</div>
          <div className="num mt-2 text-2xl font-semibold text-emerald-400">{kpis.totalDealsClosed}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">{kpis.overallCloseRate}% close rate</div>
        </div>

        <div className="bg-card p-4">
          <div className="eyebrow">Total Closed Value</div>
          <div className="num mt-2 text-2xl font-semibold">${(kpis.totalRevenue / 1000).toFixed(0)}k</div>
          <div className="mt-1 text-[11px] text-muted-foreground">Staffing contracts</div>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow text-xs">Period Filter:</span>
          <button
            onClick={() => setSelectedPeriod("all")}
            className={cn(
              "h-7 rounded-full border px-3 text-xs transition-colors duration-150",
              selectedPeriod === "all"
                ? "border-primary bg-primary text-primary-foreground font-medium"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            All Periods
          </button>
          {availablePeriods.map((p) => (
            <button
              key={p}
              onClick={() => setSelectedPeriod(p)}
              className={cn(
                "h-7 rounded-full border px-3 text-xs transition-colors duration-150",
                selectedPeriod === p
                  ? "border-primary bg-primary text-primary-foreground font-medium"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              {p}
            </button>
          ))}
        </div>

        <button
          onClick={handleResetSample}
          className="text-xs text-muted-foreground hover:text-foreground underline decoration-dotted"
        >
          Reset to default benchmark data
        </button>
      </div>

      {/* Main Tabbed Interface */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="bg-secondary/50 p-1">
          <TabsTrigger value="overview" className="gap-1.5 text-xs">
            <BarChart3 className="size-3.5" /> Overview & Trends
          </TabsTrigger>
          <TabsTrigger value="bd" className="gap-1.5 text-xs">
            <Target className="size-3.5" /> BD Team ({filteredBD.length})
          </TabsTrigger>
          <TabsTrigger value="closers" className="gap-1.5 text-xs">
            <UserCheck className="size-3.5" /> Closers ({filteredClosers.length})
          </TabsTrigger>
          <TabsTrigger value="upload" className="gap-1.5 text-xs">
            <Upload className="size-3.5" /> Excel Upload & Sync {stagedResult && "●"}
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Overview & Visual Analytics */}
        <TabsContent value="overview" className="mt-4 space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* BD Funnel Chart */}
            <div className="panel p-5">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div>
                  <h3 className="font-semibold">BD Team Performance by Rep</h3>
                  <p className="text-xs text-muted-foreground">Applies done vs Leads Generated vs Leads Qualified</p>
                </div>
                <span className="eyebrow">Applies ➔ Leads</span>
              </div>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bdChartData}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" {...chartAxis} />
                    <YAxis {...chartAxis} allowDecimals={false} />
                    <Tooltip {...chartTip} />
                    <Legend wrapperStyle={{ fontSize: "11px", fontFamily: "var(--font-mono)" }} />
                    <Bar dataKey="applies" name="Applies Done" fill="var(--color-cold)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="leads" name="Leads Gen" fill="var(--primary)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="qualified" name="Leads Qualified" fill="var(--hot)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Closer Funnel Chart */}
            <div className="panel p-5">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div>
                  <h3 className="font-semibold">Closer Team Conversion</h3>
                  <p className="text-xs text-muted-foreground">Meetings Held vs Deals Closed (Won)</p>
                </div>
                <span className="eyebrow">Close Velocity</span>
              </div>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={closerChartData}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" {...chartAxis} />
                    <YAxis {...chartAxis} allowDecimals={false} />
                    <Tooltip {...chartTip} />
                    <Legend wrapperStyle={{ fontSize: "11px", fontFamily: "var(--font-mono)" }} />
                    <Bar dataKey="meetings" name="Meetings Held" fill="var(--color-muted-foreground)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="won" name="Deals Won" fill="var(--warm)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Quick Leaderboard Tables */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Top BDs */}
            <div className="panel">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Target className="size-4 text-hot" /> Top BD Performers by Qualified Leads
                </h4>
                <button onClick={() => setActiveTab("bd")} className="text-xs text-primary hover:underline">
                  View All →
                </button>
              </div>
              <div className="divide-y divide-border">
                {filteredBD.slice(0, 4).map((bd, i) => (
                  <div key={bd.id} className="row-hover flex items-center justify-between px-4 py-3 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="num text-xs text-muted-foreground w-4">#{i + 1}</span>
                      <Initials name={bd.bdName} />
                      <div>
                        <div className="font-medium">{bd.bdName}</div>
                        <div className="num text-xs text-muted-foreground">
                          {bd.applies} applies · {bd.leadsGenerated} leads
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="num font-semibold text-hot">{bd.leadsQualified} qualified</div>
                      <div className="num text-xs text-muted-foreground">{bd.qualificationRate}% qual rate</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Closers */}
            <div className="panel">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <UserCheck className="size-4 text-warm" /> Top Closers by Revenue & Win Rate
                </h4>
                <button onClick={() => setActiveTab("closers")} className="text-xs text-primary hover:underline">
                  View All →
                </button>
              </div>
              <div className="divide-y divide-border">
                {filteredClosers.slice(0, 4).map((cl, i) => (
                  <div key={cl.id} className="row-hover flex items-center justify-between px-4 py-3 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="num text-xs text-muted-foreground w-4">#{i + 1}</span>
                      <Initials name={cl.closerName} />
                      <div>
                        <div className="font-medium">{cl.closerName}</div>
                        <div className="num text-xs text-muted-foreground">
                          {cl.meetingsHeld} meetings · {cl.closeRate}% win rate
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="num font-semibold text-emerald-400">
                        ${(cl.revenueGenerated / 1000).toFixed(0)}k won
                      </div>
                      <div className="num text-xs text-muted-foreground">{cl.dealsClosed} deals closed</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: BD Team Performance Breakdown */}
        <TabsContent value="bd" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search BD rep name..."
                value={bdSearch}
                onChange={(e) => setBdSearch(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
            <div className="text-xs text-muted-foreground">
              Showing <span className="num font-medium text-foreground">{filteredBD.length}</span> BD entries
            </div>
          </div>

          <div className="panel overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="eyebrow border-b border-border text-left">
                  <th className="px-3.5 py-2.5 font-normal">BD Rep</th>
                  <th className="px-3 py-2.5 font-normal">Period</th>
                  <th className="px-3 py-2.5 font-normal text-right">Applies Done</th>
                  <th className="px-3 py-2.5 font-normal text-right">Leads Gen</th>
                  <th className="px-3 py-2.5 font-normal text-right">Leads Qualified</th>
                  <th className="px-3 py-2.5 font-normal text-right">Apply ➔ Lead %</th>
                  <th className="px-3 py-2.5 font-normal text-right">Qual Rate %</th>
                  <th className="px-3 py-2.5 font-normal">Pacing</th>
                  <th className="px-3.5 py-2.5 font-normal">Notes / Role Focus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredBD.map((r) => {
                  const onTrack = (r.targetApplies && r.applies >= r.targetApplies) || r.applies >= 180;
                  return (
                    <tr key={r.id} className="row-hover">
                      <td className="px-3.5 py-3">
                        <div className="flex items-center gap-2">
                          <Initials name={r.bdName} />
                          <span className="font-medium">{r.bdName}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground font-mono">{r.period}</td>
                      <td className="num px-3 py-3 text-right font-medium">{r.applies}</td>
                      <td className="num px-3 py-3 text-right text-primary font-medium">{r.leadsGenerated}</td>
                      <td className="num px-3 py-3 text-right text-hot font-semibold">{r.leadsQualified}</td>
                      <td className="num px-3 py-3 text-right text-xs">{r.applyToLeadRate}%</td>
                      <td className="num px-3 py-3 text-right text-xs font-medium">{r.qualificationRate}%</td>
                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[11px] font-mono",
                            onTrack ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"
                          )}
                        >
                          {onTrack ? "On Target" : "Pacing"}
                        </span>
                      </td>
                      <td className="px-3.5 py-3 text-xs text-muted-foreground truncate max-w-xs">{r.notes || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Tab 3: Closer Team Performance Breakdown */}
        <TabsContent value="closers" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search closer name..."
                value={closerSearch}
                onChange={(e) => setCloserSearch(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
            <div className="text-xs text-muted-foreground">
              Showing <span className="num font-medium text-foreground">{filteredClosers.length}</span> closer entries
            </div>
          </div>

          <div className="panel overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="eyebrow border-b border-border text-left">
                  <th className="px-3.5 py-2.5 font-normal">Closer</th>
                  <th className="px-3 py-2.5 font-normal">Period</th>
                  <th className="px-3 py-2.5 font-normal text-right">Qualified Leads In</th>
                  <th className="px-3 py-2.5 font-normal text-right">Meetings Held</th>
                  <th className="px-3 py-2.5 font-normal text-right">Deals Won</th>
                  <th className="px-3 py-2.5 font-normal text-right">Deals Lost</th>
                  <th className="px-3 py-2.5 font-normal text-right">Close Rate %</th>
                  <th className="px-3 py-2.5 font-normal text-right">Revenue Won</th>
                  <th className="px-3.5 py-2.5 font-normal">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredClosers.map((r) => (
                  <tr key={r.id} className="row-hover">
                    <td className="px-3.5 py-3">
                      <div className="flex items-center gap-2">
                        <Initials name={r.closerName} />
                        <span className="font-medium">{r.closerName}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground font-mono">{r.period}</td>
                    <td className="num px-3 py-3 text-right">{r.qualifiedLeadsReceived}</td>
                    <td className="num px-3 py-3 text-right font-medium">{r.meetingsHeld}</td>
                    <td className="num px-3 py-3 text-right text-emerald-400 font-semibold">{r.dealsClosed}</td>
                    <td className="num px-3 py-3 text-right text-muted-foreground">{r.dealsLost}</td>
                    <td className="num px-3 py-3 text-right text-xs font-semibold">{r.closeRate}%</td>
                    <td className="num px-3 py-3 text-right font-semibold text-emerald-400">
                      ${r.revenueGenerated.toLocaleString()}
                    </td>
                    <td className="px-3.5 py-3 text-xs text-muted-foreground truncate max-w-xs">{r.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Tab 4: Excel Ingestion & History */}
        <TabsContent value="upload" className="mt-4 space-y-6">
          {/* File Dropper Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleFileProcess(file);
            }}
            className={cn(
              "panel flex flex-col items-center justify-center border-2 border-dashed p-8 text-center transition-colors",
              isDragging ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40"
            )}
          >
            <div className="grid size-12 place-items-center rounded-full bg-secondary text-primary mb-3">
              <FileUp className="size-6" />
            </div>
            <h3 className="font-semibold text-base">Drag and drop your Excel spreadsheet</h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-md">
              Supports <strong className="text-foreground">.xlsx</strong>, <strong className="text-foreground">.xls</strong>, and <strong className="text-foreground">.csv</strong>. Automatically maps BD applies, leads generated, qualified leads, and closer deals.
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Button
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isParsing}
                className="gap-1.5"
              >
                <FileSpreadsheet className="size-3.5" />
                Select File from Computer
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={generateSampleExcelTemplate}
                className="gap-1.5"
              >
                <Download className="size-3.5" />
                Get Pre-formatted Template
              </Button>
            </div>
          </div>

          {/* Staged File Preview / Confirmation */}
          {stagedResult && stagedFile && (
            <div className="panel border-primary/40 bg-card p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="eyebrow text-primary">Staged for Synchronization</span>
                    <Chip tone="hot">{stagedResult.detectedType.replace("_", " ").toUpperCase()}</Chip>
                  </div>
                  <h3 className="mt-1 font-semibold text-lg">{stagedFile.name}</h3>
                  <p className="text-xs text-muted-foreground">{stagedResult.summary}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setStagedFile(null);
                      setStagedResult(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleConfirmSync} className="gap-1.5 bg-emerald-600 hover:bg-emerald-500">
                    <Sparkles className="size-3.5" /> Confirm & Push to Dashboards
                  </Button>
                </div>
              </div>

              {/* Sample preview tables */}
              {stagedResult.bdRecords.length > 0 && (
                <div className="space-y-2">
                  <div className="eyebrow text-xs">Previewing BD Records ({stagedResult.bdRecords.length} rows)</div>
                  <div className="panel max-h-48 overflow-y-auto overflow-x-auto text-xs">
                    <table className="w-full text-left">
                      <thead className="eyebrow border-b border-border bg-secondary/50">
                        <tr>
                          <th className="p-2">BD Rep</th>
                          <th className="p-2">Period</th>
                          <th className="p-2 text-right">Applies</th>
                          <th className="p-2 text-right">Leads Gen</th>
                          <th className="p-2 text-right">Leads Qual</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {stagedResult.bdRecords.slice(0, 5).map((r, i) => (
                          <tr key={i}>
                            <td className="p-2 font-medium">{r.bdName}</td>
                            <td className="p-2 font-mono">{r.period}</td>
                            <td className="p-2 num text-right">{r.applies}</td>
                            <td className="p-2 num text-right text-primary">{r.leadsGenerated}</td>
                            <td className="p-2 num text-right text-hot">{r.leadsQualified}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {stagedResult.closerRecords.length > 0 && (
                <div className="space-y-2">
                  <div className="eyebrow text-xs">Previewing Closer Records ({stagedResult.closerRecords.length} rows)</div>
                  <div className="panel max-h-48 overflow-y-auto overflow-x-auto text-xs">
                    <table className="w-full text-left">
                      <thead className="eyebrow border-b border-border bg-secondary/50">
                        <tr>
                          <th className="p-2">Closer</th>
                          <th className="p-2">Meetings</th>
                          <th className="p-2 text-right">Deals Won</th>
                          <th className="p-2 text-right">Win Rate</th>
                          <th className="p-2 text-right">Revenue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {stagedResult.closerRecords.slice(0, 5).map((r, i) => (
                          <tr key={i}>
                            <td className="p-2 font-medium">{r.closerName}</td>
                            <td className="p-2 num">{r.meetingsHeld}</td>
                            <td className="p-2 num text-right text-emerald-400">{r.dealsClosed}</td>
                            <td className="p-2 num text-right">{r.closeRate}%</td>
                            <td className="p-2 num text-right text-emerald-400">${r.revenueGenerated.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Ingestion & Upload History Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm">Spreadsheet Ingestion History</h3>
                <p className="text-xs text-muted-foreground">Audit log of all uploaded sheets and their affected dashboards.</p>
              </div>
              <span className="eyebrow text-xs">{store.uploadHistory.length} uploads logged</span>
            </div>

            <div className="panel overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead>
                  <tr className="eyebrow border-b border-border text-left">
                    <th className="px-3.5 py-2.5 font-normal">File Name</th>
                    <th className="px-3 py-2.5 font-normal">Type</th>
                    <th className="px-3 py-2.5 font-normal">Uploaded At</th>
                    <th className="px-3 py-2.5 font-normal">Rows</th>
                    <th className="px-3 py-2.5 font-normal">Downstream Dashboards</th>
                    <th className="px-3.5 py-2.5 font-normal">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {store.uploadHistory.map((item) => (
                    <tr key={item.id} className="row-hover text-xs">
                      <td className="px-3.5 py-3 font-medium flex items-center gap-2">
                        <FileSpreadsheet className="size-4 text-primary shrink-0" />
                        <span className="truncate max-w-xs">{item.fileName}</span>
                      </td>
                      <td className="px-3 py-3">
                        <Chip>{item.sheetType.replace("_", " ")}</Chip>
                      </td>
                      <td className="px-3 py-3 num text-muted-foreground">
                        {new Date(item.uploadedAt).toLocaleString()}
                      </td>
                      <td className="num px-3 py-3 font-medium">{item.rowCount}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          {item.affectedDashboards.map((d) => (
                            <span key={d} className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-mono">
                              {d}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3.5 py-3">
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-mono text-[11px]">
                          <CheckCircle2 className="size-3" /> Synced
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
