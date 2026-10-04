// POST { email, full_name, role } — admins invite a new user (owner / technician / admin).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: caller } = await admin.auth.getUser(jwt);
  if (!caller.user) return json({ error: "unauthorized" }, 401);
  const { data: profile } = await admin.from("profiles").select("role").eq("id", caller.user.id).single();
  if (profile?.role !== "admin") return json({ error: "forbidden" }, 403);

  const { email, full_name, role } = await req.json();
  if (!email || !["owner", "technician", "admin"].includes(role)) return json({ error: "email and valid role required" }, 400);
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { data: { full_name }, redirectTo: Deno.env.get("APP_URL") });
  if (error) return json({ error: error.message }, 400);
  await admin.auth.admin.updateUserById(data.user.id, { app_metadata: { role } });
  await admin.from("profiles").upsert({ id: data.user.id, email, full_name, role });
  return json({ ok: true, id: data.user.id });
});
