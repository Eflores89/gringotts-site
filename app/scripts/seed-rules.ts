import { config } from "dotenv";
config({ path: ".env.local" });

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import { merchantRules, spendeeRules } from "../src/db/schema";

const libsql = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const db = drizzle(libsql);

const DATA_DIR = resolve(__dirname, "../../data");

function parseCsv(path: string): Array<{ first: string; spendId: string }> {
  const text = readFileSync(path, "utf8");
  const rows: Array<{ first: string; spendId: string }> = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith("#")) continue;
    if (i === 0 && line.includes(",") && /spend_id/i.test(line)) continue; // header
    const comma = line.indexOf(",");
    if (comma < 0) continue;
    const first = line.slice(0, comma).trim();
    const spendId = line.slice(comma + 1).trim();
    if (!first || !spendId) continue;
    rows.push({ first, spendId });
  }
  return rows;
}

async function main() {
  console.log("[0/2] reset rule tables");
  await db.run(sql`DELETE FROM merchant_rules`);
  await db.run(sql`DELETE FROM spendee_rules`);

  console.log("[1/2] merchant_rules from data/merchant-categories.csv");
  const merchants = parseCsv(resolve(DATA_DIR, "merchant-categories.csv"));
  const now = Date.now();
  const mRows = merchants.map(({ first, spendId }) => ({
    id: randomUUID(),
    pattern: first,
    spendId,
    source: "seed" as const,
    createdAt: now,
    updatedAt: now,
  }));
  for (let i = 0; i < mRows.length; i += 100) {
    await db.insert(merchantRules).values(mRows.slice(i, i + 100));
  }
  console.log(`  inserted=${mRows.length}`);

  console.log("[2/2] spendee_rules from data/spendee-category-map.csv");
  const spendees = parseCsv(resolve(DATA_DIR, "spendee-category-map.csv"));
  const sRows = spendees.map(({ first, spendId }) => ({
    id: randomUUID(),
    spendeeCategory: first,
    spendId,
    source: "seed" as const,
    createdAt: now,
    updatedAt: now,
  }));
  for (let i = 0; i < sRows.length; i += 100) {
    await db.insert(spendeeRules).values(sRows.slice(i, i + 100));
  }
  console.log(`  inserted=${sRows.length}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("SEED FAILED:", err);
  process.exit(1);
});
