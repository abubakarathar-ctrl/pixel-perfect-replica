import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Building2, Columns3, LineChart, LogOut, Moon, Search, Settings, Sun, Sunrise, Table2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCompanies, useMe, ROLE_LABEL } from "@/lib/data";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/today", label: "Today", icon: Sunrise },
  { to: "/leads", label: "Leads", icon: Table2 },
  { to: "/pipeline", label: "Pipeline", icon: Columns3 },
  { to: "/companies", label: "Companies", icon: Building2 },
  { to: "/contacts", label: "Contacts", icon: Users },
  { to: "/reports", label: "Reports", icon: LineChart },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(true);
  const { data: companies } = useCompanies();
  const { data: me } = useMe();

  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("sd-theme", next ? "dark" : "light");
  }
  async function signOut() {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  const go = (fn: () => void) => { setOpen(false); fn(); };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="relative z-10 flex min-h-screen w-full">
        <aside className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-border bg-rail p-1.5 md:inset-y-0 md:left-0 md:right-auto md:w-14 md:flex-col md:justify-start md:gap-1 md:border-r md:border-t-0 md:py-3">
          <div className="mb-4 hidden justify-center md:flex">
            <span className="size-2.5 rounded-full bg-primary shadow-[0_0_12px_var(--primary)]" />
          </div>
          {NAV.map((n) => {
            const active = path.startsWith(n.to) || (n.to === "/companies" && path.startsWith("/companies"));
            return (
              <Tooltip key={n.to}>
                <TooltipTrigger asChild>
                  <Link to={n.to} aria-label={n.label}
                    className={cn("relative grid size-10 place-items-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground md:mx-auto",
                      active && "bg-accent text-foreground")}>
                    {active && <span className="absolute -left-2 hidden h-5 w-0.5 rounded bg-primary md:block" />}
                    <n.icon className="size-[18px]" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{n.label}</TooltipContent>
              </Tooltip>
            );
          })}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col pb-16 md:pb-0 md:pl-14">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur md:px-6">
            <span className="font-display font-semibold md:hidden">SignalDesk</span>
            <button onClick={() => setOpen(true)}
              className="flex h-9 w-full max-w-md items-center gap-2 rounded-md border border-border bg-card px-3 text-sm text-muted-foreground transition-colors duration-150 hover:border-foreground/20">
              <Search className="size-4" />
              <span className="flex-1 text-left">Search companies, contacts…</span>
              <kbd className="num hidden rounded border border-border px-1.5 text-[11px] sm:inline">⌘K</kbd>
            </button>
            <div className="ml-auto flex items-center gap-1">
              <span className="num hidden text-xs text-muted-foreground lg:inline">{me?.email}</span>
              {me && <span className="eyebrow hidden rounded border border-border px-1.5 py-0.5 lg:inline">{ROLE_LABEL[me.role]}</span>}
              <button onClick={toggleTheme} aria-label="Toggle theme" className="grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
                {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </button>
              <button onClick={signOut} aria-label="Sign out" className="grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
                <LogOut className="size-4" />
              </button>
            </div>
          </header>
          <main className="min-w-0 flex-1 p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Jump to a company, contact or page…" />
        <CommandList>
          <CommandEmpty>Nothing matches. Try a company name.</CommandEmpty>
          <CommandGroup heading="Pages">
            {NAV.map((n) => (
              <CommandItem key={n.to} onSelect={() => go(() => navigate({ to: n.to }))}>
                <n.icon className="size-4" /> {n.label}
              </CommandItem>
            ))}
            <CommandItem onSelect={() => go(toggleTheme)}><Sun className="size-4" /> Toggle theme</CommandItem>
          </CommandGroup>
          <CommandGroup heading="Companies">
            {companies?.map((c) => (
              <CommandItem key={c.id} value={c.name} onSelect={() => go(() => navigate({ to: "/companies/$id", params: { id: c.id } }))}>
                <Building2 className="size-4" /> {c.name}
                <span className="num ml-auto text-xs text-muted-foreground">{c.score}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Contacts">
            {companies?.flatMap((c) => c.contacts.map((p) => (
              <CommandItem key={p.id} value={`${p.full_name} ${c.name}`} onSelect={() => go(() => navigate({ to: "/companies/$id", params: { id: c.id } }))}>
                <Users className="size-4" /> {p.full_name}
                <span className="ml-auto text-xs text-muted-foreground">{c.name}</span>
              </CommandItem>
            )))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </TooltipProvider>
  );
}
