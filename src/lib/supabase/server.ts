/**
 * Supabase Server Client
 *
 * Use this in Server Components, Server Actions, and API Routes.
 * Two variants:
 *   - createClient()        → anon key + RLS (for authenticated user requests)
 *   - createServiceClient() → service role key (bypasses RLS — admin ops only)
 *
 * The service role key MUST NEVER be sent to the browser.
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Creates a server-side Supabase client that reads/writes cookies
 * for session management. Use in Server Components and API routes
 * where you need the currently authenticated user's context.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from a Server Component — cookies can't be set
            // here. The middleware handles session refresh automatically.
          }
        },
      },
    }
  );
}

/**
 * Creates a Supabase admin client using the service role key.
 * This bypasses ALL Row-Level Security policies.
 *
 * ONLY use in:
 *   - /app/api/* route handlers (server-side only)
 *   - Never in Client Components or pages
 *
 * The service role key is stored as a Vercel env var and never exposed
 * to the browser bundle.
 */
export function createServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. This client can only be used server-side."
    );
  }

  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
