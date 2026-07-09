/**
 * Supabase Browser Client
 *
 * Use this in Client Components (hooks, event handlers, etc.).
 * Uses the anon key + RLS — never the service role key.
 *
 * Pattern: singleton via module-level cache so we don't create
 * a new client on every render.
 */
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createClient() {
  if (client) return client;

  client = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  return client;
}
