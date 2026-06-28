# Controllership & Taxes Feature - Design Plan

> Status: **data foundation built & seeded; loan tables built**.
> `jurisdictions`, `companies`, time-versioned `ownership` (migration
> `0004_controllership.sql`), and `loans` + `loan_payments` (migration
> `0005_loans.sql`) exist and are applied to Turso. Tax/flow tables
> (`tax_treaties`, `distributions`, `principal`) are designed below but **not
> yet built**. Detailed requirements to be appended at the bottom.

## Purpose

Model controlling (and minority) stakes across multiple companies and the
**tax implications on the principal (you)**. Companies can be owned directly by
you or by other companies, so the structure is an **ownership graph**, not a
flat list. Each company links to its valuation in the existing investments
section. The end goal is to visualize — via an interactive graph — how money
flows from one company to another (and ultimately to you), and what taxes each
hop implies.

## Decisions locked

| Decision | Choice |
|----------|--------|
| Jurisdictions | **Multiple / cross-border** — needs a jurisdiction + treaty layer |
| Money flow | **Both projected scenarios and actual recorded distributions** |
| Visualization | **Interactive graph** via `@xyflow/react` (React Flow) |
| Build start | Plan only for now; build begins once requirements are detailed |

## Core concept: ownership graph

- **Nodes** = the principal (you) + each company
- **Edges** = a stake: *owner → company @ percentage*, where the owner is
  **either you or another company**
- A **controlling stake** is look-through `> 25%` (flagged/highlighted; set by
  `CONTROLLING_THRESHOLD` in `src/lib/controllership.ts`)
- **Look-through ownership** = product of stakes along each path
  (you own 60% of HoldCo, HoldCo owns 50% of MCF → your look-through in MCF =
  30%, your share of value = 0.30 × valuation)

## Data model

### `companies` — legal entities
| Field | Type | Description |
|-------|------|-------------|
| `id` | text PK | |
| `name` | text | Display name |
| `code` | text | Short handle (e.g. `mcf`) |
| `jurisdictionId` | text FK → `jurisdictions.id` | Drives tax |
| `entityType` | text | LLC, S.A., SARL, etc. |
| `functionalCurrency` | text | |
| `notes` | text | |
| ~~`investmentId`~~ | text, nullable | **Deprecated** — superseded by `company_investments` (kept unused) |

### `company_investments` — junction (companies ⇄ investments) ✅ built
Many-to-many: a company is funded over several **investment rounds**, each its
own `investments` row. The company's valuation = **sum of all linked rounds,
converted to EUR**. Mirrors `allocation_investments`.

| Field | Type | Description |
|-------|------|-------------|
| `companyId` | text FK → `companies.id` (cascade) | |
| `investmentId` | text FK → `investments.id` (cascade) | composite PK with `companyId` |

### `jurisdictions` — one row per country in play
| Field | Type | Description |
|-------|------|-------------|
| `id` | text PK | |
| `name`, `code` | text | Country + ISO code |
| `corporateTaxRate` | real | Tax on company profits |
| `participationExemptionThreshold` | real | Ownership % above which inbound intercompany dividends are exempt |
| `personalDividendRate` | real | Personal tax on dividends for a resident |
| `personalCapitalGainsRate` | real | Personal CGT for a resident |

### `tax_treaties` — cross-border withholding matrix
| Field | Type | Description |
|-------|------|-------------|
| `sourceJurisdictionId` | text FK | Where the income originates |
| `recipientJurisdictionId` | text FK | Where the recipient is resident |
| `dividendWithholdingRate` | real | Default (portfolio) dividend rate |
| `qualifyingRate` | real | Reduced treaty dividend rate for qualifying holdings |
| `qualifyingThreshold` | real | Ownership % to earn the qualifying rate |
| `interestWithholdingRate` | real | Withholding on cross-border **interest** (loans) — typically distinct from the dividend rate |

Fallback order: treaty qualifying rate (if stake ≥ threshold) → treaty default
rate → source jurisdiction statutory rate.

### `ownership` — stakes (graph edges), **time-versioned**
Each row is a stake that holds over a period. A stake applies on date `D` when
`effective_from <= D AND (effective_to IS NULL OR D < effective_to)`. The
**current** stake for an `(owner, owned)` pair is the row with
`effective_to IS NULL`. Changing a percentage closes the old row (sets
`effective_to`) and opens a new one — preserving full cap-table history.

| Field | Type | Description |
|-------|------|-------------|
| `id` | text PK | |
| `ownerCompanyId` | text FK → `companies.id`, **nullable → null = you** | Holder of the stake |
| `ownedCompanyId` | text FK → `companies.id` | Company held |
| `percentage` | real | Stake (0–100) |
| `effectiveFrom` | text (ISO date), NOT NULL | When the stake takes effect |
| `effectiveTo` | text (ISO date), nullable | When it ends; `null` = current |
| `withholdingOverride` | real, nullable | Per-edge override of treaty/statutory withholding |
| `intercompanyExempt` | int (bool), nullable | Force participation exemption on this edge |
| `notes` | | |

### `distributions` — projected + actual
| Field | Type | Description |
|-------|------|-------------|
| `id` | text PK | |
| `companyId` | text FK → `companies.id` | Distributing company |
| `amount`, `currency` | | |
| `asOfDate` | text | |
| `kind` | text | `'scenario'` or `'actual'` |
| `notes` | text | |

### `loans` — loan agreements (debt edges) ✅ built
A loan is a second kind of edge in the graph — *debt* rather than *equity*.
Lender and borrower are each the principal (`null`) or a company, so this
covers you→company and company→company (intercompany) loans. Interest is
taxable income to the lender (the event for your tax statement); principal
repayment is return of capital, not taxable.

| Field | Type | Description |
|-------|------|-------------|
| `id` | text PK | |
| `lenderCompanyId` | text FK → `companies.id`, **nullable → null = you** | Who lends |
| `borrowerCompanyId` | text FK → `companies.id`, **nullable → null = you** | Who borrows |
| `principal`, `currency` | | Amount advanced |
| `interestRate` | real | Annual %, e.g. `5.0` |
| `interestType` | text | `fixed` / `variable` |
| `compounding` | text | `simple` / `monthly` / `annual` |
| `repaymentType` | text | `bullet` / `amortizing` / `interest_only` / `on_demand` |
| `paymentFrequency` | text | `monthly` / `quarterly` / `annual` / `at_end` / `none` (`at_end` = single interest instalment at maturity, accrued over the final year) |
| `originationDate`, `maturityDate` | text (ISO) | Term |
| `status` | text | `draft` / `active` / `repaid` / `defaulted` |
| `notes` | | |

### `loan_payments` — movements ledger (projected + actual) ✅ built
The repayment schedule is generated from the loan terms as `scenario` rows;
recorded payments are `actual` rows. Interest rows are the taxable events.

| Field | Type | Description |
|-------|------|-------------|
| `id` | text PK | |
| `loanId` | text FK → `loans.id` | |
| `kind` | text | `scenario` (projected) / `actual` (recorded) |
| `paymentType` | text | `disbursement` / `interest` / `principal` / `fee` |
| `amount`, `currency` | | |
| `dueDate` | text (ISO) | Scheduled date |
| `paidDate` | text (ISO), nullable | When actually paid; `null` until then |
| `notes` | | |

### `principal` — single config row (you)
| Field | Type | Description |
|-------|------|-------------|
| `residenceJurisdictionId` | text FK | Where you are tax-resident |
| `applyForeignTaxCredit` | int (bool) | Credit foreign withholding against domestic personal tax |

## Tax engine logic (cross-border)

For each distribution, walk **up** the ownership graph applying per hop:

1. **Withholding at source** — look up `tax_treaties[source → recipient]`; use
   the qualifying rate if the stake clears the threshold, else the default, else
   the source statutory rate (or `withholdingOverride`).
2. **At a company recipient** — participation exemption? If stake ≥ threshold
   (or `intercompanyExempt`), no further corporate tax; otherwise tax at the
   recipient's `corporateTaxRate`, crediting withholding already paid.
3. **At you (top of graph)** — personal dividend tax in your residence
   jurisdiction, **minus accumulated foreign tax credits** (capped at the
   domestic liability) when `applyForeignTaxCredit` is set.
4. **Output** — gross → net to you, total tax, effective rate, and a
   per-jurisdiction breakdown of where tax was paid.

Cross-holdings handled with cycle protection. Computed on the fly; no stored
per-hop ledger.

### Interest flows (loans)

Loan interest is a parallel money flow with its own tax treatment, evaluated
per interest payment:

1. **Withholding at source** — `tax_treaties.interestWithholdingRate` for the
   borrower→lender jurisdiction pair (distinct from the dividend rate).
2. **Lender side** — interest is taxable income: personal interest-income tax
   if the lender is you (net of foreign tax credit), corporate income if a
   company.
3. **Borrower side** — interest may be deductible, subject to related-party
   arm's-length / thin-cap / interest-limitation rules (Spain & Mexico both
   apply these). Flagged for detailed requirements.
4. **Principal** repayments are return of capital — not taxable.

## Visualization (React Flow)

- `@xyflow/react` with auto-layout (dagre/elk), you at the root
- Nodes = companies; badges for jurisdiction, your look-through %, linked
  valuation. Edges labeled with stake %; controlling stakes (>25%) emphasized in
  the money-green accent.
- **Flow mode**: pick a company + distribution amount → the path to you
  animates, each edge annotated gross/tax/net, each node showing its tax bite; a
  side panel summarizes effective rate and per-jurisdiction tax split.
- **Debt edges**: loans drawn distinctly from equity (e.g. dashed); the flow
  overlay includes interest (taxable) and principal (not taxable) movements.

## Seeded data (initial)

Run via `npx tsx scripts/seed-controllership.ts` (idempotent by code; verify
with `scripts/verify-controllership.mjs`). All stakes held directly by you
(`ownerCompanyId = null`); `effective_from` is the placeholder `2025-01-01`.

| Company | Jurisdiction | Your stake | Controlling (>25%)? |
|---------|--------------|-----------|---------------------|
| MCF | Spain | 50% | yes |
| Nutria | Spain | 0.47% | no |
| Capra | Spain | 51% | yes |
| Tara Brooch | Mexico | 60% | yes |

No inter-company ownership edges seeded yet (you mentioned some companies are
linked to each other — to be added).

## Build phases

1. **Entities + graph** — `companies`, `jurisdictions`, `ownership` ✅ **done**:
   tables + seed, interactive React Flow graph, and full CRUD UI (Add menu +
   Data-tables drawer with edit/delete) over companies, stakes, loans, and
   jurisdictions. REST routes under `/api/controllership/*`, mutation hooks in
   `use-controllership.ts`, server graph refreshed via `router.refresh()`.
   Companies link to **multiple investment rounds** (`company_investments`
   m2m); valuation = sum of rounds in EUR, shown on nodes and the detail drawer.
   Graph is hand-arrangeable: nodes drag freely; edges are **straight polylines
   with floating endpoints** (attach to the node side facing the route, not a
   fixed top/bottom), auto-offset into parallel lines when they share a pair,
   and **routable by waypoints** (double-click a line to add a point, drag to
   bend, double-click a point to remove). Node positions persist to
   `graph_positions` and edge waypoints to `graph_edge_waypoints` (JSON per
   edge), so the layout syncs across devices. "Reset layout" clears both.
   *Still to do here:* look-through *value* attribution to you (your stake ×
   each company's valuation) — Phase 3.
2. **Loans** — `loans`, `loan_payments` ✅ tables + loan CRUD done; schedule
   generator (terms → projected interest/principal rows), payment recording,
   and debt edges already render in the graph.
3. **Valuations** — look-through value to you per company.
4. **Tax + flow** — `tax_treaties`, `distributions`, the engine (dividends +
   interest), the flow overlay (scenario + actual).
5. **Reporting** — consolidated personal exposure (incl. interest income for
   your tax statement), actual-vs-projected reconciliation, what-if scenarios.

## Open / to-be-detailed requirements

_(append as defined)_

- [ ] Real `effective_from` (acquisition) dates per stake — currently the
      `2025-01-01` placeholder
- [ ] Inter-company ownership edges ("some are linked to each other")
- [ ] Spain & Mexico tax rates (corporate, withholding, personal dividend/CGT)
- [ ] Treaty rates between the relevant country pairs (incl. Spain↔Mexico),
      for **both** dividends and interest
- [ ] Your residence jurisdiction + foreign-tax-credit rules
- [ ] Which existing `assetType: "company"` investments map to which companies
- [ ] Handling of non-dividend flows (management fees)
- [ ] Loan agreements: the actual loans to enter (parties, principal, rate,
      term, repayment type/frequency)
- [ ] Interest-deductibility rules for related-party loans (arm's-length /
      thin-cap / interest-limitation) in Spain & Mexico

✅ Resolved: stakes are **time-versioned** (`effectiveFrom`/`effectiveTo`);
loans support **you↔company and company↔company** with generated schedules +
recorded actuals (`loans` / `loan_payments` built); **controlling threshold is
`> 25%`** look-through.
