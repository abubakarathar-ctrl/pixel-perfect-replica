import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  profile: z.string().trim().min(10, "Add a bit more company profile").max(8000),
  notes: z.string().trim().max(8000).default(""),
});

const INSTRUCTIONS = `You are a sales strategist for a US IT staffing firm that places contract DevOps, SRE, cloud, data, ML and security engineers at startups.
Given a company profile and activity notes, write a concise lead brief in Markdown with exactly these sections:
**Snapshot** — 2 sentences on who they are and why they need contract talent now.
**Signals** — 3 short bullets (hiring signals, urgency, fit).
**Risks** — 1-2 short bullets.
**Recommended next action** — one specific action (who to contact, channel, angle, when) in 1-2 sentences.
Stay under 170 words. Use only the facts provided; say "unknown" rather than inventing details.`;

export const generateLeadBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<{ brief: string } | { error: string }> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { error: "AI is not configured for this app." };
    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText } = await import("ai");
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
    try {
      const result = streamText({
        model: provider.responses("openai/gpt-6-astra"),
        system: INSTRUCTIONS,
        messages: [{ role: "user", content: `COMPANY PROFILE:\n${data.profile}\n\nACTIVITY NOTES:\n${data.notes || "(none)"}` }],
        maxRetries: 0,
        providerOptions: {
          openai: {
            store: false,
            forceReasoning: true,
            reasoningEffort: "low",
            reasoningSummary: "auto",
            include: ["reasoning.encrypted_content"],
          },
        },
      });
      const brief = (await result.text).trim();
      if (!brief) return { error: "The AI returned no brief. Try adding more detail." };
      return { brief };
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      console.error("lead brief failed", status, e);
      if (status === 429) return { error: "Too many requests right now — wait a moment and try again." };
      if (status === 402) return { error: "AI credits are used up. Add credits in Settings → Plans & credits." };
      if (status === 403) return { error: "AI access is blocked for this workspace." };
      return { error: "Couldn't generate the brief. Please try again." };
    }
  });
