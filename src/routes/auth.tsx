import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Sign in — SignalDesk" },
      { name: "description", content: "Sign in to SignalDesk, the lead desk for IT staffing teams." },
      { property: "og:title", content: "Sign in — SignalDesk" },
      { property: "og:description", content: "Sign in to your SignalDesk workspace." },
    ],
  }),
  component: AuthPage,
});

function safePath(p?: string) {
  if (!p) return "/today";
  try { const u = new URL(p, window.location.origin); return u.origin === window.location.origin ? u.pathname + u.search : "/today"; }
  catch { return "/today"; }
}

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: safePath(redirect) });
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: name } },
        });
        if (error) throw error;
        toast.success("Check your email to confirm your account.");
        setMode("in");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setBusy(false); }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) return toast.error(r.error.message);
    if (r.redirected) return;
    navigate({ to: safePath(redirect) });
  }

  return (
    <div className="relative z-10 grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-primary shadow-[0_0_12px_var(--primary)]" />
          <span className="font-display text-xl font-semibold">SignalDesk</span>
        </div>
        <h1 className="text-3xl font-semibold">{mode === "in" ? "Back to the desk." : "Open a seat."}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Contract DevOps, SRE, cloud, data, ML & security leads.</p>
        <div className="panel mt-6 space-y-4 p-5">
          <Button variant="outline" className="w-full" onClick={google}>Continue with Google</Button>
          <div className="eyebrow text-center">or email</div>
          <form onSubmit={submit} className="space-y-3">
            {mode === "up" && (
              <div className="space-y-1.5"><Label htmlFor="n">Full name</Label>
                <Input id="n" value={name} onChange={(e) => setName(e.target.value)} required /></div>
            )}
            <div className="space-y-1.5"><Label htmlFor="e">Email</Label>
              <Input id="e" type="email" className="num" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
            <div className="space-y-1.5"><Label htmlFor="p">Password</Label>
              <Input id="p" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
            <Button type="submit" className="w-full" disabled={busy}>{mode === "in" ? "Sign in" : "Create account"}</Button>
          </form>
        </div>
        <button className="mt-4 text-sm text-muted-foreground hover:text-foreground" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "New here? Create an account" : "Have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
