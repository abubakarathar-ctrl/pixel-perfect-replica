import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ApolloPerson {
  id?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  title?: string;
  linkedin_url?: string;
  email?: string;
  email_status?: string;
}

function extractDomain(raw: string): string {
  let s = raw.trim();
  if (!/^https?:\/\//i.test(s)) {
    s = "https://" + s;
  }
  try {
    const url = new URL(s);
    return url.hostname.replace(/^www\./i, "");
  } catch {
    return raw.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].trim();
  }
}

function getContactType(title: string | null): "recruiter_hr" | "decision_maker" {
  if (!title) return "decision_maker";
  const t = title.toLowerCase();
  if (/recruiter|talent|hr|human resources|people|sourcer|staffing|hiring/i.test(t)) {
    return "recruiter_hr";
  }
  return "decision_maker";
}

function getEmailStatus(status?: string, email?: string): "valid" | "risky" | "invalid" | "unknown" {
  if (!email) return "unknown";
  if (!status) return "unknown";
  const s = status.toLowerCase();
  if (s === "verified" || s === "valid") return "valid";
  if (s === "extrapolated" || s === "risky" || s === "catchall") return "risky";
  if (s === "invalid" || s === "bounced") return "invalid";
  return "unknown";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    let company_id: string;
    try {
      const body = await req.json();
      company_id = body.company_id;
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body. company_id is required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!company_id) {
      return new Response(
        JSON.stringify({ error: "Missing company_id parameter." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Supabase environment variables are missing." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authenticate caller
    const supabaseCaller = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseCaller.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create service role client for admin checks and DB writes
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Only admins (admin or owner) can call it
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (rolesError) {
      return new Response(
        JSON.stringify({ error: `Error checking permissions: ${rolesError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isAdmin = roles?.some((r) => r.role === "admin" || r.role === "owner");
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Only admins can call this function" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Read the company
    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .select("id, name, website")
      .eq("id", company_id)
      .single();

    if (companyError || !company) {
      return new Response(
        JSON.stringify({ error: "Company not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!company.website || !company.website.trim()) {
      return new Response(
        JSON.stringify({ error: "Company does not have a website configured to search in Apollo." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const domain = extractDomain(company.website);
    if (!domain) {
      return new Response(
        JSON.stringify({ error: "Invalid website domain format." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Read Apollo API key
    const apolloApiKey = Deno.env.get("APOLLO_API_KEY");
    if (!apolloApiKey) {
      return new Response(
        JSON.stringify({
          error: "APOLLO_API_KEY secret is not configured in Supabase. Please add it via Supabase secrets.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const targetTitles = [
      "Recruiter",
      "Talent",
      "HR",
      "CTO",
      "VP Engineering",
      "Head of Data",
      "VP of Engineering",
      "Head of Talent",
      "Talent Partner",
      "Technical Recruiter",
      "Chief Technology Officer",
      "Director of Engineering",
      "VP Technology",
    ];

    // Call Apollo API mixed people search
    const apolloResponse = await fetch("https://api.apollo.io/v1/mixed_people/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": apolloApiKey,
      },
      body: JSON.stringify({
        api_key: apolloApiKey,
        q_organization_domains: domain,
        person_titles: targetTitles,
        page: 1,
        per_page: 50,
      }),
    });

    if (!apolloResponse.ok) {
      const errText = await apolloResponse.text();
      return new Response(
        JSON.stringify({ error: `Apollo API returned ${apolloResponse.status}: ${errText}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apolloData = await apolloResponse.json();
    const people: ApolloPerson[] = apolloData.people || apolloData.contacts || [];

    // Fetch existing contacts for duplicate skipping
    const { data: existingContacts, error: existingError } = await supabaseAdmin
      .from("contacts")
      .select("full_name, email, linkedin_url")
      .eq("company_id", company_id);

    if (existingError) {
      return new Response(
        JSON.stringify({ error: `Error checking existing contacts: ${existingError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const seenEmails = new Set<string>();
    const seenLinkedIns = new Set<string>();
    const seenNames = new Set<string>();

    for (const c of existingContacts || []) {
      if (c.email) seenEmails.add(c.email.trim().toLowerCase());
      if (c.linkedin_url) seenLinkedIns.add(c.linkedin_url.trim().toLowerCase());
      if (c.full_name) seenNames.add(c.full_name.trim().toLowerCase());
    }

    const contactsToInsert = [];

    for (const p of people) {
      const fullName = (p.name || [p.first_name, p.last_name].filter(Boolean).join(" ")).trim();
      if (!fullName) continue;

      const email = p.email ? p.email.trim().toLowerCase() : null;
      const linkedin = p.linkedin_url ? p.linkedin_url.trim().toLowerCase() : null;
      const nameKey = fullName.toLowerCase();

      // Duplicate check: skip if email, linkedin, or name matches existing
      if (email && seenEmails.has(email)) continue;
      if (linkedin && seenLinkedIns.has(linkedin)) continue;
      if (!email && !linkedin && seenNames.has(nameKey)) continue;

      if (email) seenEmails.add(email);
      if (linkedin) seenLinkedIns.add(linkedin);
      seenNames.add(nameKey);

      contactsToInsert.push({
        company_id,
        full_name: fullName,
        title: p.title || null,
        contact_type: getContactType(p.title ?? null),
        linkedin_url: p.linkedin_url || null,
        email: p.email || null,
        email_status: getEmailStatus(p.email_status, p.email),
        source: "apollo",
      });
    }

    let inserted = [];
    if (contactsToInsert.length > 0) {
      const { data, error: insertError } = await supabaseAdmin
        .from("contacts")
        .insert(contactsToInsert)
        .select();

      if (insertError) {
        return new Response(
          JSON.stringify({ error: `Failed to insert contacts: ${insertError.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      inserted = data || [];

      // Log activity
      await supabaseAdmin.from("activities").insert({
        company_id,
        user_id: user.id,
        type: "note",
        body: `Enriched via Apollo: added ${contactsToInsert.length} contact(s) (${people.length} found at ${domain}).`,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        domain,
        found: people.length,
        added: contactsToInsert.length,
        contacts: inserted,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
