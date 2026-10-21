import { cn } from "@/lib/utils";
import { cap, type Tier } from "@/lib/data";
import type { ReactNode } from "react";

type Tone = "hot" | "warm" | "cold" | "invalid" | "neutral";
const dot: Record<Tone, string> = {
  hot: "bg-hot", warm: "bg-warm", cold: "bg-cold", invalid: "bg-invalid", neutral: "bg-muted-foreground",
};
const text: Record<Tone, string> = {
  hot: "text-hot", warm: "text-warm", cold: "text-cold", invalid: "text-invalid", neutral: "text-muted-foreground",
};

export function Chip({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2 py-0.5 text-xs font-medium whitespace-nowrap", text[tone], className)}>
      <span className={cn("size-1.5 rounded-full", dot[tone])} />
      {children}
    </span>
  );
}

export const TierChip = ({ tier }: { tier: Tier }) => <Chip tone={tier}>{cap(tier)}</Chip>;

export function EmailChip({ status }: { status: string }) {
  const tone: Tone = status === "valid" ? "hot" : status === "risky" ? "warm" : status === "invalid" ? "invalid" : "neutral";
  return <Chip tone={tone}>Email {cap(status)}</Chip>;
}

export function ScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const r = size / 2 - 4, c = 2 * Math.PI * r;
  const tone = score >= 75 ? "stroke-hot" : score >= 50 ? "stroke-warm" : "stroke-cold";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} className="stroke-border fill-none" strokeWidth={3} />
        <circle cx={size / 2} cy={size / 2} r={r} className={cn("fill-none transition-all", tone)} strokeWidth={3}
          strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} strokeLinecap="round" />
      </svg>
      <span className="num absolute inset-0 grid place-items-center text-sm font-semibold">{score}</span>
    </div>
  );
}

export function Empty({ line, action }: { line: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <p className="text-sm text-muted-foreground">{line}</p>
      {action}
    </div>
  );
}

export function Initials({ name }: { name: string }) {
  const i = name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  return <span className="num grid size-8 shrink-0 place-items-center rounded-full border border-border bg-secondary text-xs font-semibold">{i}</span>;
}
