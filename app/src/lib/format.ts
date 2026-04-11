/**
 * Formatting helpers shared by list pages and the dashboard.
 * Amounts are displayed with the entry's original currency code and
 * a comma-separated thousands grouping.
 */
const amountFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatAmount(value: number | null | undefined): string {
  if (value == null) return "—";
  return amountFmt.format(value);
}

export function formatMoney(
  value: number | null | undefined,
  currency: string | null | undefined,
): string {
  if (value == null) return "—";
  return `${amountFmt.format(value)} ${currency ?? ""}`.trim();
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return iso; // already YYYY-MM-DD; good enough
}
