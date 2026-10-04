// Composition root: the only place that knows every layer. It picks the backend adapter
// (Supabase when configured, otherwise the in-browser demo) and wires the application.
import { createAppServices, type AppServices } from "@/application/app-services";
import { createDemoBackend } from "@/infrastructure/demo/demo-backend";
import { createSupabaseBackend } from "@/infrastructure/supabase/supabase-backend";
import { createWebPushRegistrar } from "@/infrastructure/browser/web-push";
import { systemClock } from "@/infrastructure/system-clock";

export function createServices(): AppServices {
  // import.meta.env is read directly so Vite can drop the unused adapter from the bundle.
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  const backend = url && key ? createSupabaseBackend(url, key) : createDemoBackend();
  return createAppServices({ backend, clock: systemClock, push: createWebPushRegistrar(import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) });
}
