// Shared by every app/api/mobile/* route that requires a signed-in
// customer — the mobile app has no cookie jar, so it sends the session id
// createCustomerSession returned at login as a Bearer token instead (see
// the comment on that function in lib/customerAuth.ts).
export function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}
