import { createDemoApi } from "@/infrastructure/demo/demo-backend";
import { createSupabaseApi } from "@/infrastructure/supabase/supabase-backend";
import type { Api } from "@/application/ports/backend";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Supabase when configured, otherwise the self-contained demo backend. */
export const api: Api = url && key ? createSupabaseApi(url, key) : createDemoApi();
export type { Api } from "@/application/ports/backend";
