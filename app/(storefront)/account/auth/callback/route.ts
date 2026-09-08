import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { continueWithGoogle } from "@/app/actions/customer";

// Landing point for the Google OAuth redirect (see GoogleSignInButton).
// Supabase Auth only handles the OAuth handshake here — the storefront's
// actual session system is customer_sessions (lib/customerAuth.ts), same as
// password login, so this bridges the resulting Supabase Auth user into our
// own customers table via continueWithGoogle and then signs Supabase Auth
// back out. Only /zlap-adm uses real Supabase Auth sessions (see
// lib/supabase/middleware.ts) — a storefront customer should never end up
// with one sitting in their cookies.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const loginError = (message: string) =>
    NextResponse.redirect(`${url.origin}/account/login?error=${encodeURIComponent(message)}`);

  if (!code) return loginError("Google sign-in failed");

  const supabase = await createClient();
  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  const googleUser = data.user;
  if (exchangeError || !googleUser?.email) {
    return loginError("Google sign-in failed");
  }

  const name =
    (googleUser.user_metadata?.full_name as string | undefined) ??
    (googleUser.user_metadata?.name as string | undefined) ??
    null;
  const result = await continueWithGoogle(googleUser.email, name);

  await supabase.auth.signOut();

  if (result.error) return loginError(result.error);
  return NextResponse.redirect(`${url.origin}/account`);
}
