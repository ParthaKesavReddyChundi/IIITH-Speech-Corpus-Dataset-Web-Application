/**
 * Next.js Middleware — Route Protection & Session Refresh
 *
 * Responsibilities:
 * 1. Refresh Supabase auth session on every request (keeps JWTs fresh)
 * 2. Redirect unauthenticated users to /login
 * 3. Role-based routing:
 *    - admin role → /admin/...
 *    - student role → /student/...
 * 4. Prevent authenticated users from accessing /login
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // Create a Supabase client that can read/write cookies in the middleware
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Do not add logic between createServerClient and getUser().
  // Any early return will cause session refresh to fail.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Public paths that don't require authentication
  const isPublicPath = pathname.startsWith("/login") || pathname === "/";

  // ── Not authenticated ──────────────────────────────────────────────────────
  if (!user) {
    if (!isPublicPath) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("redirectedFrom", pathname);
      return NextResponse.redirect(redirectUrl);
    }
    return supabaseResponse;
  }

  // ── Authenticated — fetch user role ───────────────────────────────────────
  // We fetch the role from our users table (not from auth.users metadata)
  // to keep role management in one place.
  const { data: userRecord } = await supabase
    .from("users")
    .select("role")
    .eq("auth_uid", user.id)
    .single<{ role: "admin" | "student" }>();

  const role: "admin" | "student" = userRecord?.role ?? "student";

  // Redirect away from /login if already authenticated
  if (pathname.startsWith("/login") || pathname === "/") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = role === "admin" ? "/admin/dashboard" : "/student/dashboard";
    return NextResponse.redirect(redirectUrl);
  }

  // Prevent students from accessing admin routes
  if (pathname.startsWith("/admin") && role !== "admin") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/student/dashboard";
    return NextResponse.redirect(redirectUrl);
  }

  // Prevent admins from accessing student routes (redirect to admin dashboard)
  if (pathname.startsWith("/student") && role === "admin") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/admin/dashboard";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     * - /api/* (API routes handle their own auth)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api/).*)",
  ],
};
