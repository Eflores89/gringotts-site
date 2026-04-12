import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  primaryKey,
} from "drizzle-orm/sqlite-core";

export const categories = sqliteTable(
  "categories",
  {
    id: text("id").primaryKey(),
    notionId: text("notion_id").unique(),
    name: text("name").notNull(),
    spendName: text("spend_name"),
    spendId: text("spend_id").unique(),
    spendGrp: text("spend_grp"),
    spendLifegrp: text("spend_lifegrp"),
    status: text("status"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [index("categories_spend_id_idx").on(t.spendId)],
);

export const spending = sqliteTable(
  "spending",
  {
    id: text("id").primaryKey(),
    notionId: text("notion_id").unique(),
    transaction: text("transaction"),
    amount: real("amount").notNull(),
    currency: text("currency").notNull(),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id),
    chargeDate: text("charge_date").notNull(),
    moneyDate: text("money_date"),
    method: text("method"),
    mm: integer("mm"),
    euroMoney: real("euro_money"),
    spendName: text("spend_name"),
    status: text("status"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    index("spending_charge_date_idx").on(t.chargeDate),
    index("spending_category_idx").on(t.categoryId),
    index("spending_mm_idx").on(t.mm),
  ],
);

export const budget = sqliteTable(
  "budget",
  {
    id: text("id").primaryKey(),
    notionId: text("notion_id").unique(),
    transaction: text("transaction"),
    amount: real("amount").notNull(),
    currency: text("currency").notNull(),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id),
    chargeDate: text("charge_date").notNull(),
    mm: integer("mm"),
    euroMoney: real("euro_money"),
    status: text("status"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    index("budget_charge_date_idx").on(t.chargeDate),
    index("budget_category_idx").on(t.categoryId),
    index("budget_mm_idx").on(t.mm),
  ],
);

export const investments = sqliteTable(
  "investments",
  {
    id: text("id").primaryKey(),
    notionId: text("notion_id").unique(),
    name: text("name").notNull(),
    ticker: text("ticker"),
    quantity: real("quantity"),
    purchasePrice: real("purchase_price"),
    purchaseDate: text("purchase_date"),
    currentPrice: real("current_price"),
    currency: text("currency"),
    assetType: text("asset_type"),
    vestDate: text("vest_date"),
    lastPriceUpdate: text("last_price_update"),
    notes: text("notes"),
    annualGrowthRate: real("annual_growth_rate"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [index("investments_ticker_idx").on(t.ticker)],
);

export const allocations = sqliteTable("allocations", {
  id: text("id").primaryKey(),
  notionId: text("notion_id").unique(),
  name: text("name"),
  allocationType: text("allocation_type"),
  category: text("category"),
  percentage: real("percentage"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// Junction table: many-to-many between allocations and investments.
// A single allocation row (e.g. "Tech 30%") can apply to multiple
// investments that share the same exposure.
export const allocationInvestments = sqliteTable(
  "allocation_investments",
  {
    allocationId: text("allocation_id")
      .notNull()
      .references(() => allocations.id, { onDelete: "cascade" }),
    investmentId: text("investment_id")
      .notNull()
      .references(() => investments.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.allocationId, t.investmentId] }),
    index("alloc_inv_allocation_idx").on(t.allocationId),
    index("alloc_inv_investment_idx").on(t.investmentId),
  ],
);

export const merchantRules = sqliteTable(
  "merchant_rules",
  {
    id: text("id").primaryKey(),
    pattern: text("pattern").notNull(),
    spendId: text("spend_id")
      .notNull()
      .references(() => categories.spendId),
    source: text("source").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [index("merchant_rules_pattern_idx").on(t.pattern)],
);

export const spendeeRules = sqliteTable(
  "spendee_rules",
  {
    id: text("id").primaryKey(),
    spendeeCategory: text("spendee_category").notNull(),
    spendId: text("spend_id")
      .notNull()
      .references(() => categories.spendId),
    source: text("source").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [index("spendee_rules_category_idx").on(t.spendeeCategory)],
);

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Spending = typeof spending.$inferSelect;
export type NewSpending = typeof spending.$inferInsert;
export type Budget = typeof budget.$inferSelect;
export type NewBudget = typeof budget.$inferInsert;
export type Investment = typeof investments.$inferSelect;
export type NewInvestment = typeof investments.$inferInsert;
export type Allocation = typeof allocations.$inferSelect;
export type NewAllocation = typeof allocations.$inferInsert;
export type AllocationInvestment = typeof allocationInvestments.$inferSelect;
export type NewAllocationInvestment = typeof allocationInvestments.$inferInsert;
export const paymentMethods = sqliteTable("payment_methods", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const income = sqliteTable(
  "income",
  {
    id: text("id").primaryKey(),
    description: text("description"),
    amount: real("amount").notNull(),
    currency: text("currency").notNull(),
    chargeDate: text("charge_date").notNull(),
    mm: integer("mm"),
    euroMoney: real("euro_money"),
    source: text("source"),
    notes: text("notes"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    index("income_charge_date_idx").on(t.chargeDate),
    index("income_mm_idx").on(t.mm),
  ],
);

export const spendingReimbursements = sqliteTable(
  "spending_reimbursements",
  {
    id: text("id").primaryKey(),
    spendingId: text("spending_id")
      .notNull()
      .references(() => spending.id, { onDelete: "cascade" }),
    amount: real("amount").notNull(),
    currency: text("currency").notNull(),
    euroMoney: real("euro_money"),
    description: text("description"),
    reimbursedDate: text("reimbursed_date"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [index("reimb_spending_idx").on(t.spendingId)],
);

export type MerchantRule = typeof merchantRules.$inferSelect;
export type NewMerchantRule = typeof merchantRules.$inferInsert;
export type SpendeeRule = typeof spendeeRules.$inferSelect;
export type NewSpendeeRule = typeof spendeeRules.$inferInsert;
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type NewPaymentMethod = typeof paymentMethods.$inferInsert;
export type Income = typeof income.$inferSelect;
export type NewIncome = typeof income.$inferInsert;
export type SpendingReimbursement = typeof spendingReimbursements.$inferSelect;
export type NewSpendingReimbursement = typeof spendingReimbursements.$inferInsert;
