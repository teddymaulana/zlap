import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Everything outside "/zlap-adm" is the public storefront — it has its own
// dev password gate (see app/(storefront)/layout.tsx), not the admin app's
// Supabase auth. "/api/midtrans" is Midtrans's server-to-server webhook — it
// has no Supabase session and verifies itself via signature_key instead (see
// app/api/midtrans/notification/route.ts).
const ADMIN_PREFIX = "/zlap-adm";
const ADMIN_LOGIN_PATH = "/zlap-adm/login";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not run any logic between createServerClient and getUser() — it
  // refreshes the session token, and skipping it causes random logouts.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAdminPath = pathname === ADMIN_PREFIX || pathname.startsWith(`${ADMIN_PREFIX}/`);
  const isAdminLoginPath = pathname === ADMIN_LOGIN_PATH;

  if (isAdminPath && !isAdminLoginPath && !user) {
    const url = request.nextUrl.clone();
    url.pathname = ADMIN_LOGIN_PATH;
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  if (user && isAdminLoginPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/zlap-adm/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
