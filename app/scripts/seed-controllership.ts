import { config } from "dotenv";
config({ path: ".env.local" });

import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { companies, jurisdictions, ownership } from "../src/db/schema";

const libsql = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const db = drizzle(libsql);

// Placeholder start date — no real acquisition dates were provided. Stakes are
// time-versioned, so replace this with the true effective date per company
// once known (closing the row and opening a new one preserves history).
const SEED_EFFECTIVE_FROM = "2025-01-01";

const JURISDICTIONS = [
  { code: "ES", name: "Spain" },
  { code: "MX", name: "Mexico" },
];

const COMPANIES = [
  { code: "mcf", name: "MCF", jurisdiction: "ES", percentage: 50 },
  { code: "nutria", name: "Nutria", jurisdiction: "ES", percentage: 0.47 },
  { code: "capra", name: "Capra", jurisdiction: "ES", percentage: 51 },
  { code: "tara-brooch", name: "Tara Brooch", jurisdiction: "MX", percentage: 60 },
];

async function upsertJurisdiction(code: string, name: string, now: number) {
  const [existing] = await db
    .select()
    .from(jurisdictions)
    .where(eq(jurisdictions.code, code));
  if (existing) return existing.id;
  const id = randomUUID();
  await db.insert(jurisdictions).values({
    id,
    code,
    name,
    corporateTaxRate: null,
    participationExemptionThreshold: null,
    personalDividendRate: null,
    personalCapitalGainsRate: null,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

async function upsertCompany(
  code: string,
  name: string,
  jurisdictionId: string,
  now: number,
) {
  const [existing] = await db
    .select()
    .from(companies)
    .where(eq(companies.code, code));
  if (existing) return existing.id;
  const id = randomUUID();
  await db.insert(companies).values({
    id,
    code,
    name,
    investmentId: null,
    jurisdictionId,
    entityType: null,
    functionalCurrency: null,
    notes: null,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

// Principal (you) holds the stake → owner_company_id is null.
async function ensureCurrentStake(
  ownedCompanyId: string,
  percentage: number,
  now: number,
) {
  const [existing] = await db
    .select()
    .from(ownership)
    .where(
      and(
        isNull(ownership.ownerCompanyId),
        eq(ownership.ownedCompanyId, ownedCompanyId),
        isNull(ownership.effectiveTo),
      ),
    );
  if (existing) return false;
  await db.insert(ownership).values({
    id: randomUUID(),
    ownerCompanyId: null,
    ownedCompanyId,
    percentage,
    effectiveFrom: SEED_EFFECTIVE_FROM,
    effectiveTo: null,
    withholdingOverride: null,
    intercompanyExempt: null,
    notes: null,
    createdAt: now,
    updatedAt: now,
  });
  return true;
}

async function main() {
  const now = Date.now();

  console.log("[1/3] jurisdictions");
  const jurisdictionIds = new Map<string, string>();
  for (const j of JURISDICTIONS) {
    jurisdictionIds.set(j.code, await upsertJurisdiction(j.code, j.name, now));
    console.log(`  ${j.name} (${j.code})`);
  }

  console.log("[2/3] companies");
  const companyIds = new Map<string, string>();
  for (const c of COMPANIES) {
    const jId = jurisdictionIds.get(c.jurisdiction)!;
    companyIds.set(c.code, await upsertCompany(c.code, c.name, jId, now));
    console.log(`  ${c.name} (${c.code}) → ${c.jurisdiction}`);
  }

  console.log(`[3/3] stakes (principal → company), from ${SEED_EFFECTIVE_FROM}`);
  for (const c of COMPANIES) {
    const inserted = await ensureCurrentStake(
      companyIds.get(c.code)!,
      c.percentage,
      now,
    );
    console.log(`  ${c.name}: ${c.percentage}% ${inserted ? "(inserted)" : "(already present, skipped)"}`);
  }

  console.log("done. NOTE: effective_from is a placeholder — set real dates when known.");
  process.exit(0);
}

main().catch((err) => {
  console.error("SEED FAILED:", err);
  process.exit(1);
});
