import { config } from "dotenv";
config({ path: ".env.local" });

import { randomUUID } from "node:crypto";
import { Client } from "@notionhq/client";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { sql } from "drizzle-orm";
import {
  categories,
  spending,
  budget,
  investments,
  allocations,
} from "../src/db/schema";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const libsql = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const db = drizzle(libsql);

const CATEGORIES_DB = process.env.CATEGORIES_DATABASE_ID!;
const SPENDING_DB = process.env.SPENDING_DATABASE_ID!;
const INVESTMENTS_DB = process.env.INVESTMENTS_DATABASE_ID!;
const ALLOCATIONS_DB = process.env.ALLOCATIONS_DATABASE_ID!;

const now = () => Date.now();

// Notion property extractors -------------------------------------------------
type NotionProp = Record<string, unknown>;
const title = (p: NotionProp | undefined): string => {
  const arr = (p as { title?: Array<{ plain_text?: string }> })?.title ?? [];
  return arr.map((t) => t.plain_text ?? "").join("").trim();
};
const richText = (p: NotionProp | undefined): string => {
  const arr = (p as { rich_text?: Array<{ plain_text?: string }> })?.rich_text ?? [];
  return arr.map((t) => t.plain_text ?? "").join("").trim();
};
const num = (p: NotionProp | undefined): number | null => {
  const v = (p as { number?: number | null })?.number;
  return v === undefined ? null : v;
};
// Notion formula properties nest the result under `formula.{type}`.
const formulaNum = (p: NotionProp | undefined): number | null => {
  const f = (p as { formula?: { type?: string; number?: number | null } })?.formula;
  if (!f) return null;
  if (f.type === "number") return f.number ?? null;
  return null;
};
const numOrFormula = (p: NotionProp | undefined): number | null =>
  num(p) ?? formulaNum(p);
const select = (p: NotionProp | undefined): string | null => {
  return (p as { select?: { name?: string } | null })?.select?.name ?? null;
};
const statusProp = (p: NotionProp | undefined): string | null => {
  return (p as { status?: { name?: string } | null })?.status?.name ?? null;
};
const dateStart = (p: NotionProp | undefined): string | null => {
  return (p as { date?: { start?: string } | null })?.date?.start ?? null;
};
const relationIds = (p: NotionProp | undefined): string[] => {
  const arr = (p as { relation?: Array<{ id: string }> })?.relation ?? [];
  return arr.map((r) => r.id);
};
const relationFirst = (p: NotionProp | undefined): string | null => {
  return relationIds(p)[0] ?? null;
};
const rollupString = (p: NotionProp | undefined): string | null => {
  const rollup = (p as { rollup?: { type?: string; string?: string; array?: unknown[] } })?.rollup;
  if (!rollup) return null;
  if (rollup.type === "string") return rollup.string ?? null;
  if (rollup.type === "array" && Array.isArray(rollup.array) && rollup.array.length > 0) {
    const first = rollup.array[0] as Record<string, unknown>;
    if ((first as { type?: string }).type === "rich_text") {
      const rt = (first as { rich_text?: Array<{ plain_text?: string }> }).rich_text ?? [];
      return rt.map((t) => t.plain_text ?? "").join("").trim() || null;
    }
    if ((first as { type?: string }).type === "title") {
      const t = (first as { title?: Array<{ plain_text?: string }> }).title ?? [];
      return t.map((x) => x.plain_text ?? "").join("").trim() || null;
    }
  }
  return null;
};

// Paginated query helper -----------------------------------------------------
// Notion SDK v5: queries happen on data sources, not databases.
async function resolveDataSourceId(databaseId: string): Promise<string> {
  const db: any = await notion.databases.retrieve({ database_id: databaseId });
  const sources = db.data_sources as Array<{ id: string }> | undefined;
  if (!sources || sources.length === 0) {
    throw new Error(`Database ${databaseId} has no data_sources`);
  }
  if (sources.length > 1) {
    console.warn(`  [warn] database ${databaseId} has ${sources.length} data sources; using first`);
  }
  return sources[0].id;
}

async function* queryAll(databaseId: string, filter?: unknown): AsyncGenerator<any> {
  const dataSourceId = await resolveDataSourceId(databaseId);
  let cursor: string | undefined = undefined;
  while (true) {
    const res: any = await notion.dataSources.query({
      data_source_id: dataSourceId,
      start_cursor: cursor,
      page_size: 100,
      ...(filter ? { filter } : {}),
    });
    for (const page of res.results) yield page;
    if (!res.has_more) break;
    cursor = res.next_cursor ?? undefined;
  }
}

// Migration steps ------------------------------------------------------------
async function migrateCategories(): Promise<Map<string, string>> {
  console.log("\n[1/4] categories");
  const notionToNew = new Map<string, string>();
  const rows: Array<typeof categories.$inferInsert> = [];
  let count = 0;

  for await (const page of queryAll(CATEGORIES_DB, {
    property: "status",
    status: { equals: "Latest" },
  })) {
    count++;
    const props = page.properties as Record<string, NotionProp>;
    const spendName = richText(props.spend_name) || title(props.spend_name);
    if (!spendName) continue;
    const id = randomUUID();
    notionToNew.set(page.id, id);
    rows.push({
      id,
      notionId: page.id,
      name: title(props.name) || richText(props.name) || spendName,
      spendName,
      spendId: richText(props.spend_id) || null,
      spendGrp: select(props.spend_grp) || richText(props.spend_grp) || null,
      spendLifegrp: select(props.spend_lifegrp) || richText(props.spend_lifegrp) || null,
      status: statusProp(props.status),
      createdAt: Date.parse(page.created_time) || now(),
      updatedAt: now(),
    });
  }

  if (rows.length > 0) {
    // Insert in chunks to avoid libsql param limits
    for (let i = 0; i < rows.length; i += 100) {
      await db
        .insert(categories)
        .values(rows.slice(i, i + 100))
        .onConflictDoNothing({ target: categories.notionId });
    }
  }
  console.log(`  notion=${count} inserted=${rows.length}`);
  return notionToNew;
}

async function migrateSpendingAndBudget(catMap: Map<string, string>) {
  console.log("\n[2/4] spending + budget (partitioned by type)");
  const spendingRows: Array<typeof spending.$inferInsert> = [];
  const budgetRows: Array<typeof budget.$inferInsert> = [];
  let count = 0;
  let skippedNoCat = 0;
  let skippedUnknownType = 0;

  for await (const page of queryAll(SPENDING_DB)) {
    count++;
    const props = page.properties as Record<string, NotionProp>;
    const notionCatId = relationFirst(props.category);
    const categoryId = notionCatId ? catMap.get(notionCatId) ?? null : null;
    if (!categoryId) {
      skippedNoCat++;
      continue;
    }
    const type = select(props.type);
    const amount = num(props.amount) ?? 0;
    const createdAt = Date.parse(page.created_time) || now();
    const baseShared = {
      notionId: page.id,
      transaction: title(props.transaction) || null,
      amount,
      currency: select(props.currency) ?? "EUR",
      categoryId,
      chargeDate: dateStart(props.charge_date) ?? new Date().toISOString().slice(0, 10),
      mm: numOrFormula(props.mm),
      euroMoney: numOrFormula(props.euro_money),
      status: select(props.status) || statusProp(props.status),
      createdAt,
      updatedAt: now(),
    };
    if (type === "spending") {
      spendingRows.push({
        id: randomUUID(),
        ...baseShared,
        moneyDate: dateStart(props.money_date),
        method: select(props.method),
        spendName: rollupString(props.spend_name) || richText(props.spend_name) || null,
      });
    } else if (type === "budget") {
      budgetRows.push({
        id: randomUUID(),
        ...baseShared,
      });
    } else {
      skippedUnknownType++;
    }
  }

  for (let i = 0; i < spendingRows.length; i += 100) {
    await db
      .insert(spending)
      .values(spendingRows.slice(i, i + 100))
      .onConflictDoNothing({ target: spending.notionId });
  }
  for (let i = 0; i < budgetRows.length; i += 100) {
    await db
      .insert(budget)
      .values(budgetRows.slice(i, i + 100))
      .onConflictDoNothing({ target: budget.notionId });
  }
  console.log(
    `  notion=${count} spending=${spendingRows.length} budget=${budgetRows.length} skipped_no_cat=${skippedNoCat} skipped_unknown_type=${skippedUnknownType}`,
  );
}

async function migrateInvestments(): Promise<Map<string, string>> {
  console.log("\n[3/4] investments");
  const notionToNew = new Map<string, string>();
  const rows: Array<typeof investments.$inferInsert> = [];
  let count = 0;

  for await (const page of queryAll(INVESTMENTS_DB)) {
    count++;
    const props = page.properties as Record<string, NotionProp>;
    const name = title(props.name);
    if (!name) continue;
    const id = randomUUID();
    notionToNew.set(page.id, id);
    rows.push({
      id,
      notionId: page.id,
      name,
      ticker: richText(props.ticker) || null,
      quantity: num(props.quantity),
      purchasePrice: num(props.purchase_price),
      purchaseDate: dateStart(props.purchase_date),
      currentPrice: num(props.current_price),
      currency: select(props.currency),
      assetType: select(props.asset_type),
      vestDate: dateStart(props.vest_date),
      lastPriceUpdate: dateStart(props.last_price_update),
      notes: richText(props.notes) || null,
      annualGrowthRate: num(props.annual_growth_rate),
      createdAt: Date.parse(page.created_time) || now(),
      updatedAt: now(),
    });
  }

  for (let i = 0; i < rows.length; i += 100) {
    await db
      .insert(investments)
      .values(rows.slice(i, i + 100))
      .onConflictDoNothing({ target: investments.notionId });
  }
  console.log(`  notion=${count} inserted=${rows.length}`);
  return notionToNew;
}

async function migrateAllocations(invMap: Map<string, string>) {
  console.log("\n[4/4] allocations");
  const rows: Array<typeof allocations.$inferInsert> = [];
  let count = 0;
  let skippedNoInv = 0;
  let multiRelation = 0;

  for await (const page of queryAll(ALLOCATIONS_DB)) {
    count++;
    const props = page.properties as Record<string, NotionProp>;
    const invIds = relationIds(props.investments);
    if (invIds.length === 0) {
      skippedNoInv++;
      continue;
    }
    if (invIds.length > 1) multiRelation++;
    const newInv = invMap.get(invIds[0]);
    if (!newInv) {
      skippedNoInv++;
      continue;
    }
    rows.push({
      id: randomUUID(),
      notionId: page.id,
      name: title(props.name) || null,
      investmentId: newInv,
      allocationType: select(props.allocation_type),
      category: select(props.category),
      percentage: num(props.percentage),
      createdAt: Date.parse(page.created_time) || now(),
      updatedAt: now(),
    });
  }

  for (let i = 0; i < rows.length; i += 100) {
    await db
      .insert(allocations)
      .values(rows.slice(i, i + 100))
      .onConflictDoNothing({ target: allocations.notionId });
  }
  console.log(
    `  notion=${count} inserted=${rows.length} skipped_no_inv=${skippedNoInv} multi_relation_warning=${multiRelation}`,
  );
}

async function printSanityTotals() {
  console.log("\n[sanity] spending totals by month (euro_money)");
  const res = await db.all<{ mm: number; total: number; cnt: number }>(
    sql`SELECT mm as mm, COALESCE(SUM(euro_money),0) as total, COUNT(*) as cnt FROM spending GROUP BY mm ORDER BY mm`,
  );
  for (const r of res) console.log(`  mm=${r.mm} count=${r.cnt} total=${r.total?.toFixed?.(2) ?? r.total}`);
  const bu = await db.all<{ cnt: number; total: number }>(
    sql`SELECT COUNT(*) as cnt, COALESCE(SUM(euro_money),0) as total FROM budget`,
  );
  console.log(`  budget rows=${bu[0]?.cnt ?? 0} total=${bu[0]?.total?.toFixed?.(2) ?? 0}`);
}

async function reset() {
  console.log("[0/4] reset (delete all rows in FK order)");
  // Order matters: children first, then parents.
  await db.run(sql`DELETE FROM allocations`);
  await db.run(sql`DELETE FROM merchant_rules`);
  await db.run(sql`DELETE FROM spendee_rules`);
  await db.run(sql`DELETE FROM investments`);
  await db.run(sql`DELETE FROM spending`);
  await db.run(sql`DELETE FROM budget`);
  await db.run(sql`DELETE FROM categories`);
}

async function main() {
  const start = Date.now();
  await reset();
  const catMap = await migrateCategories();
  await migrateSpendingAndBudget(catMap);
  const invMap = await migrateInvestments();
  await migrateAllocations(invMap);
  await printSanityTotals();
  console.log(`\nDone in ${((Date.now() - start) / 1000).toFixed(1)}s`);
  process.exit(0);
}

main().catch((err) => {
  console.error("\nMIGRATION FAILED:", err);
  process.exit(1);
});
