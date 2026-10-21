import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  role: z.enum(["owner", "manager", "bd"]),
  redirectTo: z.string().url().optional(),
});

export const inviteTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true } | { error: string }> => {
    const { data: roles } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    const mine = (roles ?? []).map((r) => r.role as string);
    const isOwner = mine.some((r) => r === "owner" || r === "admin");
    const isManager = isOwner || mine.includes("manager");
    if (!isManager) return { error: "Only owners and managers can add team members." };
    if (!isOwner && data.role !== "bd") return { error: "Managers can only add BD team members." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      data: { full_name: data.fullName },
      redirectTo: data.redirectTo,
    });
    if (error || !created.user) return { error: error?.message ?? "Couldn't invite that person." };
    const uid = created.user.id;
    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    const { error: rErr } = await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: data.role });
    if (rErr) return { error: rErr.message };
    return { ok: true };
  });
