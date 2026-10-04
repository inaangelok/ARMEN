// Sends e-mail (Resend) and Web Push notifications for an alert.
// Secrets: RESEND_API_KEY, NOTIFY_FROM, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, APP_URL
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

type Lang = "hy" | "en" | "ru";

const TITLES: Record<string, Record<Lang, string>> = {
  MODULE_OVER_TEMP: { hy: "Մոդուլի գերտաքացում", en: "Module over-temperature", ru: "Перегрев модуля" },
  CELL_IMBALANCE: { hy: "Բջիջների լարման անհավասարակշռություն", en: "Cell voltage imbalance", ru: "Дисбаланс напряжения ячеек" },
  SOH_LOW: { hy: "Մոդուլի SOH-ը նվազել է", en: "Module SOH dropped", ru: "Снижение SOH модуля" },
  COOLANT_HIGH: { hy: "Հովացուցիչի բարձր ջերմաստիճան", en: "High coolant temperature", ru: "Высокая температура охлаждающей жидкости" },
  COOLING_PUMP_FAULT: { hy: "Հովացման պոմպի անսարքություն", en: "Cooling pump fault", ru: "Неисправность насоса охлаждения" },
  COMM_LOST: { hy: "Կապը կայանի հետ կորել է", en: "Communication lost", ru: "Потеряна связь со станцией" },
  FIRE_SYSTEM_FAULT: { hy: "Հրդեհաշիջման համակարգի անսարքություն", en: "Fire suppression system fault", ru: "Неисправность системы пожаротушения" },
  FIRE_TRIGGERED: { hy: "ՀՐԴԵՀԱՅԻՆ ԱՀԱԶԱՆԳ", en: "FIRE ALARM", ru: "ПОЖАРНАЯ ТРЕВОГА" },
  INVERTER_ERROR: { hy: "Ինվերտորի սխալ", en: "Inverter error", ru: "Ошибка инвертора" },
};
const CRITICAL: Record<Lang, string> = { hy: "Կրիտիկական ահազանգ", en: "Critical alert", ru: "Критическое оповещение" };
const OPEN_APP: Record<Lang, string> = { hy: "Բացել ARMEN Care-ը", en: "Open ARMEN Care", ru: "Открыть ARMEN Care" };
const FIRE_HELP: Record<Lang, string> = {
  hy: "Անմիջապես հեռացեք շենքից, մի բացեք կաբինետը և զանգահարեք 911։",
  en: "Leave the building immediately, do not open the cabinet and call 911.",
  ru: "Немедленно покиньте здание, не открывайте шкаф и позвоните 911.",
};

export async function notifyAlert(admin: SupabaseClient, alertId: string) {
  const { data: alert } = await admin.from("alerts").select("*, stations(id, name, technician_id, customers(owner_id))").eq("id", alertId).single();
  if (!alert || alert.notified_at) return { skipped: true };
  const station = alert.stations as { id: string; name: string; technician_id: string | null; customers: { owner_id: string | null } };
  const ids = [station.customers?.owner_id, station.technician_id].filter(Boolean) as string[];
  const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin");
  const recipientIds = [...new Set([...ids, ...(admins ?? []).map((a) => a.id)])];
  const { data: people } = await admin.from("profiles").select("*").in("id", recipientIds);

  const appUrl = Deno.env.get("APP_URL") ?? "";
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
  if (vapidPublic && vapidPrivate) webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") ?? "mailto:support@armen.am", vapidPublic, vapidPrivate);

  let emails = 0, pushes = 0;
  for (const p of people ?? []) {
    const lang = (p.language ?? "hy") as Lang;
    const title = `${CRITICAL[lang]}: ${TITLES[alert.code]?.[lang] ?? alert.code}`;
    const params = Object.entries(alert.params ?? {}).map(([k, v]) => `${k}: ${v}`).join(", ");
    const body = `${station.name}${params ? ` — ${params}` : ""}${alert.code === "FIRE_TRIGGERED" ? `\n${FIRE_HELP[lang]}` : ""}`;

    if (resendKey && p.notify_email && p.email) {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: Deno.env.get("NOTIFY_FROM") ?? "ARMEN Care <alerts@armen.am>",
          to: [p.email],
          subject: title,
          html: `<div style="font-family:sans-serif"><h2 style="color:#C62828">${title}</h2><p>${body.replace(/\n/g, "<br>")}</p>${appUrl ? `<p><a href="${appUrl}/app/alerts" style="background:#22382F;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">${OPEN_APP[lang]}</a></p>` : ""}</div>`,
        }),
      });
      if (r.ok) emails++;
    }
    if (vapidPublic && vapidPrivate && p.notify_push) {
      const { data: subs } = await admin.from("push_subscriptions").select("*").eq("user_id", p.id);
      for (const s of subs ?? []) {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title, body, url: "/app/alerts" }));
          pushes++;
        } catch (e) {
          if ((e as { statusCode?: number }).statusCode === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
        }
      }
    }
  }
  await admin.from("alerts").update({ notified_at: new Date().toISOString() }).eq("id", alertId);
  return { emails, pushes };
}
