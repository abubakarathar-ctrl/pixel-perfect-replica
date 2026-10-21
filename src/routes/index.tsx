import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "SignalDesk — Today" },
      { name: "description", content: "Your daily lead desk: hot leads, contract roles and follow-ups." },
      { property: "og:title", content: "SignalDesk" },
      { property: "og:description", content: "Lead management for contract tech staffing teams." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    throw redirect({ to: data.user ? "/today" : "/auth" });
  },
});
