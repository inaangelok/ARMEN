// POST { alert_id } — or a Supabase Database Webhook payload ({ type: "INSERT", record }) on public.alerts.
// Sends e-mail + push for critical alerts. Called by `ingest` and by the alerts webhook (for COMM_LOST from pg_cron).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { notifyAlert } from "../_shared/notify.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const secret = Deno.env.get("NOTIFY_WEBHOOK_SECRET");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${serviceKey}` && (!secret || req.headers.get("x-webhook-secret") !== secret)) return json({ error: "unauthorized" }, 401);

  const body = await req.json();
  const record = body.record ?? body;
  const alertId = record.alert_id ?? record.id;
  if (!alertId) return json({ error: "alert_id required" }, 400);
  if (body.record && record.severity !== "critical") return json({ skipped: "not critical" });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, { auth: { persistSession: false } });
  return json(await notifyAlert(admin, alertId));
});
