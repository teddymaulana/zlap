// Turns a stored status value like "refund_pending" into "Refund pending"
// for display — the underlying value stays lowercase/underscored.
export function formatStatus(status: string): string {
  const withSpaces = status.replace(/_/g, " ");
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}
