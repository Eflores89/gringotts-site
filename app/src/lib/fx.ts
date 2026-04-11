/**
 * Hardcoded FX rates (to EUR). Matches the old js/config.js values.
 * Promoting these to a DB table is out of scope for the rebuild.
 */
export const FX_TO_EUR: Record<string, number> = {
  EUR: 1.0,
  USD: 0.92,
  MXN: 0.054,
  GBP: 1.17,
};

export const CURRENCIES = ["EUR", "MXN", "USD", "GBP"] as const;
export type Currency = (typeof CURRENCIES)[number];

export function toEuro(amount: number, currency: string): number {
  const rate = FX_TO_EUR[currency.toUpperCase()] ?? 1;
  return amount * rate;
}

export function mmFromIsoDate(iso: string): number | null {
  // ISO YYYY-MM-DD → month 1..12
  const m = /^\d{4}-(\d{2})-/.exec(iso);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n >= 1 && n <= 12 ? n : null;
}
