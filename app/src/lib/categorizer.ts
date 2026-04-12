import "server-only";
import { db } from "@/db/client";
import {
  categories,
  merchantRules,
  spendeeRules,
} from "@/db/schema";
import { isNotNull } from "drizzle-orm";
import { mmFromIsoDate, toEuro } from "./fx";

export type RowToCategorize = {
  transaction: string;
  amount: number;
  currency: string;
  chargeDate: string;
  spendeeCategory: string;
  method?: string;
  sourceFile?: string;
};

export type MatchTier = "merchant" | "spendee" | "manual" | "broken";

export type CategorizedRow = RowToCategorize & {
  spendId: string | null;
  categoryId: string | null;
  categoryName: string | null;
  matchedRule: string | null;
  matchTier: MatchTier;
  euroMoney: number;
  mm: number | null;
};

const SPENDEE_IGNORE = new Set(["", "all-nonspec", "general"]);

/**
 * Run the two-tier categorizer over a batch of parsed rows. Loads
 * merchant rules, spendee rules, and the spend_id → category map in
 * three parallel queries; returns rows enriched with category_id and
 * a match_tier badge.
 */
export async function categorizeRows(
  rows: RowToCategorize[],
  fxRates?: Record<string, number>,
  monthOverride?: number,
): Promise<CategorizedRow[]> {
  const [merchants, spendees, cats] = await Promise.all([
    db.select().from(merchantRules),
    db.select().from(spendeeRules),
    db
      .select({ id: categories.id, spendId: categories.spendId, name: categories.name })
      .from(categories)
      .where(isNotNull(categories.spendId)),
  ]);

  // Sort merchants longest-first so a more specific pattern wins.
  const sortedMerchants = [...merchants].sort(
    (a, b) => b.pattern.length - a.pattern.length,
  );

  // spend_id → { categoryId, categoryName }
  const catBySpendId = new Map<string, { id: string; name: string }>();
  for (const c of cats) {
    if (c.spendId) catBySpendId.set(c.spendId, { id: c.id, name: c.name });
  }

  return rows.map((row) => {
    const desc = row.transaction.toLowerCase();
    let spendId: string | null = null;
    let matchedRule: string | null = null;
    let matchTier: MatchTier = "manual";

    // Tier 1: merchant pattern (substring match on description)
    for (const r of sortedMerchants) {
      if (desc.includes(r.pattern)) {
        spendId = r.spendId;
        matchedRule = r.pattern;
        matchTier = "merchant";
        break;
      }
    }

    // Tier 2: spendee category (case-insensitive exact match)
    if (!spendId) {
      const cat = row.spendeeCategory.toLowerCase().trim();
      if (!SPENDEE_IGNORE.has(cat)) {
        for (const r of spendees) {
          if (r.spendeeCategory.toLowerCase() === cat) {
            spendId = r.spendId;
            matchedRule = r.spendeeCategory;
            matchTier = "spendee";
            break;
          }
        }
      }
    }

    let categoryId: string | null = null;
    let categoryName: string | null = null;
    if (spendId) {
      const resolved = catBySpendId.get(spendId);
      if (resolved) {
        categoryId = resolved.id;
        categoryName = resolved.name;
      } else {
        // The rule pointed at a spend_id that no longer exists in
        // categories. Surface as "broken" so the user can fix it.
        matchTier = "broken";
      }
    }

    return {
      ...row,
      spendId,
      categoryId,
      categoryName,
      matchedRule,
      matchTier,
      euroMoney: fxRates
        ? row.amount * (fxRates[row.currency.toUpperCase()] ?? 1)
        : toEuro(row.amount, row.currency),
      mm: monthOverride ?? mmFromIsoDate(row.chargeDate),
    };
  });
}
