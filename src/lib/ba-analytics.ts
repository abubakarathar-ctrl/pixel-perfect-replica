import * as XLSX from "xlsx";

export interface BDPerformanceRecord {
  id: string;
  bdName: string;
  date: string;
  period: string;
  applies: number;
  leadsGenerated: number;
  leadsQualified: number;
  applyToLeadRate: number; // percentage (leadsGenerated / applies * 100)
  qualificationRate: number; // percentage (leadsQualified / leadsGenerated * 100)
  targetApplies?: number;
  notes?: string;
}

export interface CloserPerformanceRecord {
  id: string;
  closerName: string;
  date: string;
  period: string;
  qualifiedLeadsReceived: number;
  meetingsHeld: number;
  dealsClosed: number;
  dealsLost: number;
  closeRate: number; // percentage (dealsClosed / meetingsHeld * 100)
  revenueGenerated: number;
  notes?: string;
}

export interface UploadedSheetLog {
  id: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  uploadedBy: string;
  sheetType: "bd_performance" | "closer_performance" | "full_workbook" | "general_company";
  rowCount: number;
  summary: string;
  status: "synced" | "processed" | "warning";
  affectedDashboards: string[];
}

export interface BAAnalyticsStore {
  bdRecords: BDPerformanceRecord[];
  closerRecords: CloserPerformanceRecord[];
  uploadHistory: UploadedSheetLog[];
  lastSyncedAt: string;
}

const STORAGE_KEY = "signaldesk_ba_analytics_v1";

// Initial realistic benchmark data so the dashboard is immediately populated
const INITIAL_BD_RECORDS: BDPerformanceRecord[] = [
  {
    id: "bd-1",
    bdName: "Alex Vance",
    date: "2026-11-09",
    period: "Nov 2026",
    applies: 240,
    leadsGenerated: 54,
    leadsQualified: 32,
    applyToLeadRate: 22.5,
    qualificationRate: 59.3,
    targetApplies: 200,
    notes: "Top performer in Cloud/DevOps staffing applies",
  },
  {
    id: "bd-2",
    bdName: "Sarah Jenkins",
    date: "2026-11-08",
    period: "Nov 2026",
    applies: 195,
    leadsGenerated: 42,
    leadsQualified: 24,
    applyToLeadRate: 21.5,
    qualificationRate: 57.1,
    targetApplies: 200,
    notes: "High conversion on SRE contract roles",
  },
  {
    id: "bd-3",
    bdName: "Hamza Malik",
    date: "2026-11-07",
    period: "Nov 2026",
    applies: 210,
    leadsGenerated: 46,
    leadsQualified: 22,
    applyToLeadRate: 21.9,
    qualificationRate: 47.8,
    targetApplies: 200,
    notes: "Focusing on AI/ML enterprise leads",
  },
  {
    id: "bd-4",
    bdName: "David Kim",
    date: "2026-11-06",
    period: "Nov 2026",
    applies: 180,
    leadsGenerated: 35,
    leadsQualified: 18,
    applyToLeadRate: 19.4,
    qualificationRate: 51.4,
    targetApplies: 180,
    notes: "Security & Kubernetes staffing outreach",
  },
  {
    id: "bd-5",
    bdName: "Rachel Morris",
    date: "2026-11-05",
    period: "Nov 2026",
    applies: 165,
    leadsGenerated: 29,
    leadsQualified: 15,
    applyToLeadRate: 17.6,
    qualificationRate: 51.7,
    targetApplies: 180,
    notes: "Ramping up Data Engineering tier",
  },
];

const INITIAL_CLOSER_RECORDS: CloserPerformanceRecord[] = [
  {
    id: "cl-1",
    closerName: "Elena Rostova",
    date: "2026-11-09",
    period: "Nov 2026",
    qualifiedLeadsReceived: 42,
    meetingsHeld: 34,
    dealsClosed: 14,
    dealsLost: 6,
    closeRate: 41.2,
    revenueGenerated: 168000,
    notes: "Leading contract placements in FinTech & SaaS",
  },
  {
    id: "cl-2",
    closerName: "Marcus Chen",
    date: "2026-11-08",
    period: "Nov 2026",
    qualifiedLeadsReceived: 38,
    meetingsHeld: 29,
    dealsClosed: 11,
    dealsLost: 8,
    closeRate: 37.9,
    revenueGenerated: 132000,
    notes: "Strong DevOps/SRE retainer agreements",
  },
  {
    id: "cl-3",
    closerName: "Liam O'Connor",
    date: "2026-11-07",
    period: "Nov 2026",
    qualifiedLeadsReceived: 31,
    meetingsHeld: 24,
    dealsClosed: 9,
    dealsLost: 5,
    closeRate: 37.5,
    revenueGenerated: 108000,
    notes: "High average deal value on ML infra roles",
  },
];

const INITIAL_UPLOAD_HISTORY: UploadedSheetLog[] = [
  {
    id: "upl-1",
    fileName: "Q4_Week45_BD_Applies_Qualified.xlsx",
    fileSize: 48200,
    uploadedAt: "2026-11-08T10:30:00Z",
    uploadedBy: "Business Analyst",
    sheetType: "bd_performance",
    rowCount: 5,
    summary: "Ingested 5 BD reps metrics. 990 total applies, 206 leads, 111 qualified.",
    status: "synced",
    affectedDashboards: ["Admin Dashboard", "BD Head Dashboard"],
  },
  {
    id: "upl-2",
    fileName: "Q4_Week45_Closers_Closing_Metrics.xlsx",
    fileSize: 34100,
    uploadedAt: "2026-11-08T11:15:00Z",
    uploadedBy: "Business Analyst",
    sheetType: "closer_performance",
    rowCount: 3,
    summary: "Ingested 3 Closers. 87 meetings held, 34 deals closed, $408K revenue.",
    status: "synced",
    affectedDashboards: ["Admin Dashboard", "Closer Head Dashboard"],
  },
];

export function getBAStore(): BAAnalyticsStore {
  if (typeof window === "undefined") {
    return {
      bdRecords: INITIAL_BD_RECORDS,
      closerRecords: INITIAL_CLOSER_RECORDS,
      uploadHistory: INITIAL_UPLOAD_HISTORY,
      lastSyncedAt: new Date().toISOString(),
    };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.bdRecords && parsed.closerRecords) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Error reading BA analytics storage:", e);
  }

  const initial: BAAnalyticsStore = {
    bdRecords: INITIAL_BD_RECORDS,
    closerRecords: INITIAL_CLOSER_RECORDS,
    uploadHistory: INITIAL_UPLOAD_HISTORY,
    lastSyncedAt: new Date().toISOString(),
  };
  saveBAStore(initial);
  return initial;
}

export function saveBAStore(store: BAAnalyticsStore): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    window.dispatchEvent(new CustomEvent("ba-analytics-updated", { detail: store }));
  } catch (e) {
    console.error("Error saving BA analytics storage:", e);
  }
}

// Helpers for flexible column name matching
function findKey(row: Record<string, any>, possibleKeys: string[]): string | undefined {
  const rowKeys = Object.keys(row);
  for (const target of possibleKeys) {
    const found = rowKeys.find(
      (k) => k.toLowerCase().replace(/[^a-z0-9]/g, "") === target.toLowerCase().replace(/[^a-z0-9]/g, "")
    );
    if (found) return found;
  }
  return undefined;
}

function parseNumber(val: any, fallback = 0): number {
  if (val === undefined || val === null || val === "") return fallback;
  if (typeof val === "number") return isNaN(val) ? fallback : val;
  const cleaned = String(val).replace(/[^0-9.-]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? fallback : num;
}

export interface ParsedSheetResult {
  bdRecords: BDPerformanceRecord[];
  closerRecords: CloserPerformanceRecord[];
  detectedType: "bd_performance" | "closer_performance" | "full_workbook" | "general_company";
  rowCount: number;
  summary: string;
}

export async function parseExcelOrCsvFile(file: File): Promise<ParsedSheetResult> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array" });

  let parsedBD: BDPerformanceRecord[] = [];
  let parsedClosers: CloserPerformanceRecord[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
    if (!rows.length) continue;

    // Detect if this sheet contains BD data or Closer data
    const sample = rows[0];
    const bdNameKey = findKey(sample, ["bd", "bdname", "bdrep", "businessdeveloper", "rep", "agent"]);
    const appliesKey = findKey(sample, ["applies", "applications", "totalapplies", "applied", "appliesdone"]);
    const leadsGenKey = findKey(sample, ["leadsgenerated", "leadsgen", "leads", "leadcreated", "genleads"]);
    const leadsQualKey = findKey(sample, ["leadsqualified", "qualifiedleads", "qualified", "sql", "leadqual"]);

    const closerNameKey = findKey(sample, ["closer", "closername", "accountexecutive", "ae"]);
    const meetingsKey = findKey(sample, ["meetings", "meetingsheld", "calls", "discoverycalls", "demos"]);
    const dealsClosedKey = findKey(sample, ["dealsclosed", "closedwon", "dealswon", "closed", "won"]);

    // Process BD rows
    if ((bdNameKey || appliesKey || leadsGenKey) && !closerNameKey) {
      rows.forEach((r, idx) => {
        const name = String(r[bdNameKey || Object.keys(r)[0]] || "").trim();
        if (!name) return;

        const applies = parseNumber(r[appliesKey || ""], 0);
        const leadsGen = parseNumber(r[leadsGenKey || ""], 0);
        const leadsQual = parseNumber(r[leadsQualKey || ""], 0);

        const dateKey = findKey(r, ["date", "day", "timestamp"]);
        const periodKey = findKey(r, ["period", "week", "month", "quarter"]);
        const notesKey = findKey(r, ["notes", "comment", "remarks", "role"]);

        const applyToLead = applies > 0 ? (leadsGen / applies) * 100 : 0;
        const qualRate = leadsGen > 0 ? (leadsQual / leadsGen) * 100 : 0;

        parsedBD.push({
          id: `bd-upl-${Date.now()}-${idx}`,
          bdName: name,
          date: String(r[dateKey || ""] || new Date().toISOString().slice(0, 10)),
          period: String(r[periodKey || ""] || "Current Period"),
          applies,
          leadsGenerated: leadsGen,
          leadsQualified: leadsQual,
          applyToLeadRate: parseFloat(applyToLead.toFixed(1)),
          qualificationRate: parseFloat(qualRate.toFixed(1)),
          notes: r[notesKey || ""] ? String(r[notesKey || ""]) : undefined,
        });
      });
    }

    // Process Closer rows
    if (closerNameKey || (dealsClosedKey && meetingsKey)) {
      rows.forEach((r, idx) => {
        const name = String(r[closerNameKey || Object.keys(r)[0]] || "").trim();
        if (!name) return;

        const leadsRecvKey = findKey(r, ["qualifiedleadsreceived", "qualifiedleads", "leadsreceived", "intake"]);
        const revenueKey = findKey(r, ["revenue", "revenuegenerated", "contractvalue", "dealvalue", "amount", "totalvalue"]);
        const dealsLostKey = findKey(r, ["dealslost", "closedlost", "lost"]);
        const dateKey = findKey(r, ["date", "day", "timestamp"]);
        const periodKey = findKey(r, ["period", "week", "month"]);
        const notesKey = findKey(r, ["notes", "comment", "remarks"]);

        const leadsRecv = parseNumber(r[leadsRecvKey || ""], 0);
        const meetings = parseNumber(r[meetingsKey || ""], 0);
        const dealsWon = parseNumber(r[dealsClosedKey || ""], 0);
        const dealsLost = parseNumber(r[dealsLostKey || ""], 0);
        const revenue = parseNumber(r[revenueKey || ""], 0);
        const closeRate = meetings > 0 ? (dealsWon / meetings) * 100 : 0;

        parsedClosers.push({
          id: `cl-upl-${Date.now()}-${idx}`,
          closerName: name,
          date: String(r[dateKey || ""] || new Date().toISOString().slice(0, 10)),
          period: String(r[periodKey || ""] || "Current Period"),
          qualifiedLeadsReceived: leadsRecv,
          meetingsHeld: meetings,
          dealsClosed: dealsWon,
          dealsLost: dealsLost,
          closeRate: parseFloat(closeRate.toFixed(1)),
          revenueGenerated: revenue,
          notes: r[notesKey || ""] ? String(r[notesKey || ""]) : undefined,
        });
      });
    }
  }

  // Determine detected type
  let detectedType: "bd_performance" | "closer_performance" | "full_workbook" | "general_company" = "general_company";
  if (parsedBD.length > 0 && parsedClosers.length > 0) {
    detectedType = "full_workbook";
  } else if (parsedBD.length > 0) {
    detectedType = "bd_performance";
  } else if (parsedClosers.length > 0) {
    detectedType = "closer_performance";
  }

  const rowCount = parsedBD.length + parsedClosers.length;
  let summary = `Parsed ${rowCount} records.`;
  if (parsedBD.length > 0 && parsedClosers.length > 0) {
    summary = `Parsed ${parsedBD.length} BD records and ${parsedClosers.length} Closer records.`;
  } else if (parsedBD.length > 0) {
    summary = `Parsed ${parsedBD.length} BD performance records across ${new Set(parsedBD.map((r) => r.bdName)).size} reps.`;
  } else if (parsedClosers.length > 0) {
    summary = `Parsed ${parsedClosers.length} Closer performance records across ${new Set(parsedClosers.map((r) => r.closerName)).size} closers.`;
  }

  return {
    bdRecords: parsedBD,
    closerRecords: parsedClosers,
    detectedType,
    rowCount,
    summary,
  };
}

export function commitParsedData(
  parsed: ParsedSheetResult,
  fileName: string,
  fileSize: number
): { store: BAAnalyticsStore; log: UploadedSheetLog } {
  const current = getBAStore();

  // Determine affected dashboards
  const affected: string[] = ["Admin Dashboard"];
  if (parsed.bdRecords.length > 0) affected.push("BD Head Dashboard");
  if (parsed.closerRecords.length > 0) affected.push("Closer Head Dashboard");

  // Merge or prepend records
  const updatedBD = [...parsed.bdRecords, ...current.bdRecords];
  const updatedClosers = [...parsed.closerRecords, ...current.closerRecords];

  const log: UploadedSheetLog = {
    id: `log-${Date.now()}`,
    fileName,
    fileSize,
    uploadedAt: new Date().toISOString(),
    uploadedBy: "Business Analyst",
    sheetType: parsed.detectedType,
    rowCount: parsed.rowCount,
    summary: parsed.summary,
    status: "synced",
    affectedDashboards: affected,
  };

  const updatedStore: BAAnalyticsStore = {
    bdRecords: updatedBD,
    closerRecords: updatedClosers,
    uploadHistory: [log, ...current.uploadHistory],
    lastSyncedAt: new Date().toISOString(),
  };

  saveBAStore(updatedStore);
  return { store: updatedStore, log };
}

// Downloadable Excel template generator for Business Analysts
export function generateSampleExcelTemplate(): void {
  const wb = XLSX.utils.book_new();

  // 1. BD Performance Sheet
  const bdData = [
    {
      "BD Name": "Alex Vance",
      Date: "2026-11-09",
      Period: "Week 45",
      Applies: 240,
      "Leads Generated": 54,
      "Leads Qualified": 32,
      Notes: "Target exceeded in Cloud/DevOps",
    },
    {
      "BD Name": "Sarah Jenkins",
      Date: "2026-11-09",
      Period: "Week 45",
      Applies: 195,
      "Leads Generated": 42,
      "Leads Qualified": 24,
      Notes: "High response rate on SRE contracts",
    },
    {
      "BD Name": "Hamza Malik",
      Date: "2026-11-09",
      Period: "Week 45",
      Applies: 210,
      "Leads Generated": 46,
      "Leads Qualified": 22,
      Notes: "AI/ML infra focus",
    },
  ];
  const wsBD = XLSX.utils.json_to_sheet(bdData);
  XLSX.utils.book_append_sheet(wb, wsBD, "BD Performance");

  // 2. Closer Performance Sheet
  const closerData = [
    {
      "Closer Name": "Elena Rostova",
      Date: "2026-11-09",
      Period: "Week 45",
      "Qualified Leads Received": 42,
      "Meetings Held": 34,
      "Deals Closed": 14,
      "Deals Lost": 6,
      Revenue: 168000,
      Notes: "FinTech & Enterprise contracts closed",
    },
    {
      "Closer Name": "Marcus Chen",
      Date: "2026-11-09",
      Period: "Week 45",
      "Qualified Leads Received": 38,
      "Meetings Held": 29,
      "Deals Closed": 11,
      "Deals Lost": 8,
      Revenue: 132000,
      Notes: "DevOps staffing retainers",
    },
  ];
  const wsCloser = XLSX.utils.json_to_sheet(closerData);
  XLSX.utils.book_append_sheet(wb, wsCloser, "Closer Performance");

  XLSX.writeFile(wb, "SignalDesk_BA_Metrics_Template.xlsx");
}
