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
    // 'spend' (default) or 'income' — segregates pickers across forms.
    kind: text("kind").notNull().default("spend"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    index("categories_spend_id_idx").on(t.spendId),
    index("categories_kind_idx").on(t.kind),
  ],
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
    // 'planned' (default) — budgeted income; 'actual' — once we start
    // logging real receipts.
    kind: text("kind").notNull().default("planned"),
    categoryId: text("category_id").references(() => categories.id),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    index("income_charge_date_idx").on(t.chargeDate),
    index("income_mm_idx").on(t.mm),
    index("income_kind_idx").on(t.kind),
    index("income_category_idx").on(t.categoryId),
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

// ─── Controllership & taxes ─────────────────────────────────────────────
// Models controlling stakes across companies and the tax implications on the
// principal (the app's single user). Ownership is a directed graph: an owner
// (the principal, or another company) holds a percentage of a company. Stakes
// are time-versioned via effective-dating — see `ownership`.

export const jurisdictions = sqliteTable("jurisdictions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  // ISO-ish short code, e.g. "ES", "MX".
  code: text("code").notNull().unique(),
  // Tax parameters — nullable until requirements are defined (Phase 3).
  corporateTaxRate: real("corporate_tax_rate"),
  participationExemptionThreshold: real("participation_exemption_threshold"),
  personalDividendRate: real("personal_dividend_rate"),
  personalCapitalGainsRate: real("personal_capital_gains_rate"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const companies = sqliteTable(
  "companies",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    // Short handle, e.g. "mcf".
    code: text("code").notNull().unique(),
    // Link to the valuation in the investments section. Nullable so a company
    // can exist before it is matched to an investment row.
    investmentId: text("investment_id").references(() => investments.id, {
      onDelete: "set null",
    }),
    jurisdictionId: text("jurisdiction_id").references(() => jurisdictions.id),
    entityType: text("entity_type"),
    functionalCurrency: text("functional_currency"),
    notes: text("notes"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [index("companies_jurisdiction_idx").on(t.jurisdictionId)],
);

// Ownership edges, time-versioned. Each row is a stake that holds over a
// period: it applies on date D when
//   effective_from <= D AND (effective_to IS NULL OR D < effective_to).
// The current stake for an (owner, owned) pair is the row with
// effective_to IS NULL. A change in percentage closes the old row (sets
// effective_to) and opens a new one — preserving cap-table history.
export const ownership = sqliteTable(
  "ownership",
  {
    id: text("id").primaryKey(),
    // null owner = the principal (you). Otherwise a holding company.
    ownerCompanyId: text("owner_company_id").references(() => companies.id, {
      onDelete: "cascade",
    }),
    ownedCompanyId: text("owned_company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    percentage: real("percentage").notNull(),
    // ISO date (YYYY-MM-DD) the stake takes effect.
    effectiveFrom: text("effective_from").notNull(),
    // ISO date the stake ends; null = still current.
    effectiveTo: text("effective_to"),
    // Per-edge tax escape hatches (Phase 3).
    withholdingOverride: real("withholding_override"),
    intercompanyExempt: integer("intercompany_exempt"),
    notes: text("notes"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    index("ownership_owned_idx").on(t.ownedCompanyId),
    index("ownership_owner_idx").on(t.ownerCompanyId),
    index("ownership_effective_idx").on(t.effectiveFrom, t.effectiveTo),
  ],
);

// Junction: many-to-many between companies and investments. A company can be
// funded over several investment rounds, each represented by its own
// investment row; the company's valuation is the sum of all linked rounds.
// Supersedes the single companies.investment_id column (now deprecated/unused).
export const companyInvestments = sqliteTable(
  "company_investments",
  {
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    investmentId: text("investment_id")
      .notNull()
      .references(() => investments.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.companyId, t.investmentId] }),
    index("company_inv_company_idx").on(t.companyId),
    index("company_inv_investment_idx").on(t.investmentId),
  ],
);

// Loan agreements — a second kind of edge in the ownership graph: debt rather
// than equity. Lender and borrower are each either the principal (null) or a
// company, so this covers you→company and company→company (intercompany) loans.
// Interest is taxable income to the lender; principal repayment is return of
// capital. The repayment schedule lives in `loanPayments`.
export const loans = sqliteTable(
  "loans",
  {
    id: text("id").primaryKey(),
    // null = the principal (you).
    lenderCompanyId: text("lender_company_id").references(() => companies.id, {
      onDelete: "cascade",
    }),
    borrowerCompanyId: text("borrower_company_id").references(
      () => companies.id,
      { onDelete: "cascade" },
    ),
    principal: real("principal").notNull(),
    currency: text("currency").notNull(),
    // Annual interest rate as a percentage, e.g. 5.0 = 5%.
    interestRate: real("interest_rate"),
    interestType: text("interest_type").notNull().default("fixed"), // fixed | variable
    compounding: text("compounding").notNull().default("simple"), // simple | monthly | annual
    repaymentType: text("repayment_type").notNull().default("bullet"), // bullet | amortizing | interest_only | on_demand
    // monthly | quarterly | annual | at_end | none
    // 'at_end': interest is paid in a single instalment at maturity, accrued
    // over the final year of the term (per the schedule generator, when built).
    paymentFrequency: text("payment_frequency").notNull().default("none"),
    originationDate: text("origination_date"),
    maturityDate: text("maturity_date"),
    status: text("status").notNull().default("active"), // draft | active | repaid | defaulted
    notes: text("notes"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    index("loans_lender_idx").on(t.lenderCompanyId),
    index("loans_borrower_idx").on(t.borrowerCompanyId),
    index("loans_status_idx").on(t.status),
  ],
);

// Movements against a loan. `kind` separates the projected schedule
// ('scenario') from recorded reality ('actual'); `paidDate` is null until an
// actual payment lands. Interest rows are the taxable events.
export const loanPayments = sqliteTable(
  "loan_payments",
  {
    id: text("id").primaryKey(),
    loanId: text("loan_id")
      .notNull()
      .references(() => loans.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().default("scenario"), // scenario | actual
    paymentType: text("payment_type").notNull(), // disbursement | interest | principal | fee
    amount: real("amount").notNull(),
    currency: text("currency").notNull(),
    dueDate: text("due_date"),
    paidDate: text("paid_date"),
    notes: text("notes"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    index("loan_payments_loan_idx").on(t.loanId),
    index("loan_payments_kind_idx").on(t.kind),
    index("loan_payments_due_idx").on(t.dueDate),
  ],
);

export type Jurisdiction = typeof jurisdictions.$inferSelect;
export type NewJurisdiction = typeof jurisdictions.$inferInsert;
export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
export type Ownership = typeof ownership.$inferSelect;
export type NewOwnership = typeof ownership.$inferInsert;
export type Loan = typeof loans.$inferSelect;
export type NewLoan = typeof loans.$inferInsert;
export type LoanPayment = typeof loanPayments.$inferSelect;
export type NewLoanPayment = typeof loanPayments.$inferInsert;
export type CompanyInvestment = typeof companyInvestments.$inferSelect;
export type NewCompanyInvestment = typeof companyInvestments.$inferInsert;

// User-arranged positions for the controllership graph, persisted so a
// hand-tuned layout syncs across devices. nodeId is "principal" (you) or a
// company id. Absence of a row means "use the automatic layout".
export const graphPositions = sqliteTable("graph_positions", {
  nodeId: text("node_id").primaryKey(),
  x: real("x").notNull(),
  y: real("y").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export type GraphPosition = typeof graphPositions.$inferSelect;
export type NewGraphPosition = typeof graphPositions.$inferInsert;

// Manual waypoints for controllership graph edges. `points` is a JSON array of
// {x,y} in flow coordinates; the edge is drawn as straight segments through
// them. No row = a straight line between the two node borders.
export const graphEdgeWaypoints = sqliteTable("graph_edge_waypoints", {
  edgeId: text("edge_id").primaryKey(),
  points: text("points").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export type GraphEdgeWaypoint = typeof graphEdgeWaypoints.$inferSelect;
export type NewGraphEdgeWaypoint = typeof graphEdgeWaypoints.$inferInsert;

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
