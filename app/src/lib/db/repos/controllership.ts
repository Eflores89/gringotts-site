import "server-only";
import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  companies,
  companyInvestments,
  graphEdgeWaypoints,
  graphPositions,
  investments,
  jurisdictions,
  loans,
  ownership,
} from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { toEuro } from "@/lib/fx";
import {
  CONTROLLING_THRESHOLD,
  PRINCIPAL_ID,
  type ControllershipGraph,
  type GraphCompany,
  type GraphOwnershipEdge,
} from "@/lib/controllership";

export { PRINCIPAL_ID } from "@/lib/controllership";
export type {
  ControllershipGraph,
  GraphCompany,
  GraphOwnershipEdge,
  GraphLoanEdge,
} from "@/lib/controllership";

// Investment row → market value in its own currency. Prefer current price,
// fall back to purchase price; times quantity when present.
function marketValueOf(inv: {
  quantity: number | null;
  currentPrice: number | null;
  purchasePrice: number | null;
}): number | null {
  const price = inv.currentPrice ?? inv.purchasePrice;
  if (price == null) return null;
  return inv.quantity != null ? inv.quantity * price : price;
}

// Sum the principal's economic interest in each company over every simple path
// of current ownership edges. Correct for DAGs (our case); cycle-guarded so a
// future cross-holding can't loop forever.
function computeLookThrough(
  edges: Array<{ ownerId: string; ownedId: string; fraction: number }>,
): Map<string, number> {
  const adj = new Map<string, Array<{ ownedId: string; fraction: number }>>();
  for (const e of edges) {
    if (!adj.has(e.ownerId)) adj.set(e.ownerId, []);
    adj.get(e.ownerId)!.push({ ownedId: e.ownedId, fraction: e.fraction });
  }
  const totals = new Map<string, number>();
  const visited = new Set<string>([PRINCIPAL_ID]);
  const walk = (node: string, acc: number) => {
    for (const { ownedId, fraction } of adj.get(node) ?? []) {
      if (visited.has(ownedId)) continue;
      const share = acc * fraction;
      totals.set(ownedId, (totals.get(ownedId) ?? 0) + share);
      visited.add(ownedId);
      walk(ownedId, share);
      visited.delete(ownedId);
    }
  };
  walk(PRINCIPAL_ID, 1);
  return totals;
}

export async function getControllershipGraph(): Promise<ControllershipGraph> {
  await requireAuth();

  const [
    companyRows,
    ownershipRows,
    loanRows,
    jurisdictionRows,
    investmentRows,
    companyInvRows,
    positionRows,
    waypointRows,
  ] = await Promise.all([
    db
      .select({
        id: companies.id,
        name: companies.name,
        code: companies.code,
        jurisdictionId: companies.jurisdictionId,
        jurisdictionName: jurisdictions.name,
        jurisdictionCode: jurisdictions.code,
        entityType: companies.entityType,
        functionalCurrency: companies.functionalCurrency,
        notes: companies.notes,
      })
      .from(companies)
      .leftJoin(jurisdictions, eq(jurisdictions.id, companies.jurisdictionId))
      .orderBy(asc(companies.name)),
    db.select().from(ownership).orderBy(asc(ownership.effectiveFrom)),
    db.select().from(loans),
    db.select().from(jurisdictions).orderBy(asc(jurisdictions.name)),
    db
      .select({
        id: investments.id,
        name: investments.name,
        assetType: investments.assetType,
        quantity: investments.quantity,
        currentPrice: investments.currentPrice,
        purchasePrice: investments.purchasePrice,
        currency: investments.currency,
      })
      .from(investments)
      .orderBy(asc(investments.name)),
    db.select().from(companyInvestments),
    db.select().from(graphPositions),
    db.select().from(graphEdgeWaypoints),
  ]);

  const edgeId = (ownerId: string | null) => ownerId ?? PRINCIPAL_ID;

  // Investment lookup + per-company linked-investment ids, for valuation.
  const investmentById = new Map(investmentRows.map((i) => [i.id, i]));
  const linkedByCompany = new Map<string, string[]>();
  for (const link of companyInvRows) {
    (linkedByCompany.get(link.companyId) ??
      linkedByCompany.set(link.companyId, []).get(link.companyId)!).push(
      link.investmentId,
    );
  }

  // Sum a company's linked rounds, each converted to EUR. null if no priced
  // investment is linked.
  const valuationEur = (companyId: string): number | null => {
    const ids = linkedByCompany.get(companyId);
    if (!ids?.length) return null;
    let total = 0;
    let any = false;
    for (const invId of ids) {
      const inv = investmentById.get(invId);
      if (!inv) continue;
      const mv = marketValueOf(inv);
      if (mv == null) continue;
      total += toEuro(mv, inv.currency ?? "EUR");
      any = true;
    }
    return any ? total : null;
  };

  // Current ownership edges (effectiveTo IS NULL) drive the live graph.
  const currentOwnership = ownershipRows.filter((r) => r.effectiveTo == null);

  const lookThrough = computeLookThrough(
    currentOwnership.map((r) => ({
      ownerId: edgeId(r.ownerCompanyId),
      ownedId: r.ownedCompanyId,
      fraction: r.percentage / 100,
    })),
  );

  // Principal's current direct stake per company (owner = principal).
  const directStake = new Map<string, number>();
  for (const r of currentOwnership) {
    if (r.ownerCompanyId == null) directStake.set(r.ownedCompanyId, r.percentage);
  }

  const graphCompanies: GraphCompany[] = companyRows.map((c) => {
    const lt = (lookThrough.get(c.id) ?? 0) * 100;
    return {
      id: c.id,
      name: c.name,
      code: c.code,
      jurisdictionId: c.jurisdictionId,
      jurisdictionName: c.jurisdictionName,
      jurisdictionCode: c.jurisdictionCode,
      entityType: c.entityType,
      functionalCurrency: c.functionalCurrency,
      notes: c.notes,
      linkedInvestmentIds: linkedByCompany.get(c.id) ?? [],
      valuation: valuationEur(c.id),
      valuationCurrency: valuationEur(c.id) != null ? "EUR" : null,
      directStake: directStake.get(c.id) ?? null,
      lookThrough: lt,
      controlling: lt > CONTROLLING_THRESHOLD,
    };
  });

  const toEdge = (r: (typeof ownershipRows)[number]): GraphOwnershipEdge => ({
    id: r.id,
    ownerId: edgeId(r.ownerCompanyId),
    ownedId: r.ownedCompanyId,
    percentage: r.percentage,
    effectiveFrom: r.effectiveFrom,
    effectiveTo: r.effectiveTo,
    notes: r.notes,
  });

  const stakeHistory: Record<string, GraphOwnershipEdge[]> = {};
  for (const r of ownershipRows) {
    (stakeHistory[r.ownedCompanyId] ??= []).push(toEdge(r));
  }
  // Newest first within each company.
  for (const id of Object.keys(stakeHistory)) {
    stakeHistory[id].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  }

  return {
    companies: graphCompanies,
    ownershipEdges: currentOwnership.map(toEdge),
    loans: loanRows.map((l) => ({
      id: l.id,
      lenderId: edgeId(l.lenderCompanyId),
      borrowerId: edgeId(l.borrowerCompanyId),
      principal: l.principal,
      currency: l.currency,
      interestRate: l.interestRate,
      interestType: l.interestType,
      compounding: l.compounding,
      repaymentType: l.repaymentType,
      paymentFrequency: l.paymentFrequency,
      originationDate: l.originationDate,
      maturityDate: l.maturityDate,
      status: l.status,
      notes: l.notes,
    })),
    stakeHistory,
    jurisdictions: jurisdictionRows.map((j) => ({
      id: j.id,
      name: j.name,
      code: j.code,
      corporateTaxRate: j.corporateTaxRate,
      participationExemptionThreshold: j.participationExemptionThreshold,
      personalDividendRate: j.personalDividendRate,
      personalCapitalGainsRate: j.personalCapitalGainsRate,
    })),
    investments: investmentRows.map((i) => ({
      id: i.id,
      name: i.name,
      assetType: i.assetType,
    })),
    nodePositions: Object.fromEntries(
      positionRows.map((p) => [p.nodeId, { x: p.x, y: p.y }]),
    ),
    edgeWaypoints: Object.fromEntries(
      waypointRows.map((w) => {
        let pts: Array<{ x: number; y: number }> = [];
        try {
          pts = JSON.parse(w.points);
        } catch {
          pts = [];
        }
        return [w.edgeId, pts];
      }),
    ),
  };
}

// Node positions ──────────────────────────────────────────────────────────────

export type NodePosition = { nodeId: string; x: number; y: number };

// Replace-all: the client sends every node's position on each save, so a
// wholesale swap keeps the table in sync (last write wins across devices).
export async function saveGraphPositions(positions: NodePosition[]) {
  await requireAuth();
  await db.delete(graphPositions);
  if (positions.length) {
    const ts = Date.now();
    await db
      .insert(graphPositions)
      .values(positions.map((p) => ({ nodeId: p.nodeId, x: p.x, y: p.y, updatedAt: ts })));
  }
}

export async function clearGraphPositions() {
  await requireAuth();
  await db.delete(graphPositions);
}

export type EdgeWaypoints = Record<string, Array<{ x: number; y: number }>>;

// Replace-all: client sends every edge's full waypoint list each save.
export async function saveEdgeWaypoints(waypoints: EdgeWaypoints) {
  await requireAuth();
  await db.delete(graphEdgeWaypoints);
  const entries = Object.entries(waypoints).filter(([, pts]) => pts.length > 0);
  if (entries.length) {
    const ts = Date.now();
    await db.insert(graphEdgeWaypoints).values(
      entries.map(([edgeId, pts]) => ({
        edgeId,
        points: JSON.stringify(pts),
        updatedAt: ts,
      })),
    );
  }
}

export async function clearEdgeWaypoints() {
  await requireAuth();
  await db.delete(graphEdgeWaypoints);
}

// ─── CRUD ───────────────────────────────────────────────────────────────────
// Inputs are validated at the API layer (zod); these trust their callers and
// only normalize empty strings to null. `null` company id on an ownership/loan
// party means the principal (you).

const now = () => Date.now();

// Jurisdictions ──────────────────────────────────────────────────────────────

export type JurisdictionInput = {
  name: string;
  code: string;
  corporateTaxRate?: number | null;
  participationExemptionThreshold?: number | null;
  personalDividendRate?: number | null;
  personalCapitalGainsRate?: number | null;
};

export async function createJurisdiction(input: JurisdictionInput) {
  await requireAuth();
  const ts = now();
  const row = {
    id: randomUUID(),
    name: input.name,
    code: input.code,
    corporateTaxRate: input.corporateTaxRate ?? null,
    participationExemptionThreshold: input.participationExemptionThreshold ?? null,
    personalDividendRate: input.personalDividendRate ?? null,
    personalCapitalGainsRate: input.personalCapitalGainsRate ?? null,
    createdAt: ts,
    updatedAt: ts,
  };
  await db.insert(jurisdictions).values(row);
  return row;
}

export async function updateJurisdiction(
  id: string,
  patch: Partial<JurisdictionInput>,
) {
  await requireAuth();
  const update: Record<string, unknown> = { updatedAt: now() };
  for (const k of [
    "name",
    "code",
    "corporateTaxRate",
    "participationExemptionThreshold",
    "personalDividendRate",
    "personalCapitalGainsRate",
  ] as const) {
    if (patch[k] !== undefined) update[k] = patch[k];
  }
  const [row] = await db
    .update(jurisdictions)
    .set(update)
    .where(eq(jurisdictions.id, id))
    .returning();
  return row ?? null;
}

export async function deleteJurisdiction(id: string) {
  await requireAuth();
  const res = await db
    .delete(jurisdictions)
    .where(eq(jurisdictions.id, id))
    .returning({ id: jurisdictions.id });
  return res.length > 0;
}

// Companies ──────────────────────────────────────────────────────────────────

export type CompanyInput = {
  name: string;
  code: string;
  jurisdictionId?: string | null;
  entityType?: string | null;
  functionalCurrency?: string | null;
  // Linked investment rounds (many-to-many). When provided on update, it
  // replaces the full set of links for the company.
  investmentIds?: string[];
  notes?: string | null;
};

// Replace a company's investment links with exactly `ids`.
async function setCompanyInvestments(companyId: string, ids: string[]) {
  await db
    .delete(companyInvestments)
    .where(eq(companyInvestments.companyId, companyId));
  const unique = [...new Set(ids)];
  if (unique.length) {
    await db
      .insert(companyInvestments)
      .values(unique.map((investmentId) => ({ companyId, investmentId })));
  }
}

export async function createCompany(input: CompanyInput) {
  await requireAuth();
  const ts = now();
  const row = {
    id: randomUUID(),
    name: input.name,
    code: input.code,
    jurisdictionId: input.jurisdictionId ?? null,
    entityType: input.entityType ?? null,
    functionalCurrency: input.functionalCurrency ?? null,
    investmentId: null,
    notes: input.notes ?? null,
    createdAt: ts,
    updatedAt: ts,
  };
  await db.insert(companies).values(row);
  if (input.investmentIds?.length) {
    await setCompanyInvestments(row.id, input.investmentIds);
  }
  return row;
}

export async function updateCompany(id: string, patch: Partial<CompanyInput>) {
  await requireAuth();
  const update: Record<string, unknown> = { updatedAt: now() };
  for (const k of [
    "name",
    "code",
    "jurisdictionId",
    "entityType",
    "functionalCurrency",
    "notes",
  ] as const) {
    if (patch[k] !== undefined) update[k] = patch[k];
  }
  const [row] = await db
    .update(companies)
    .set(update)
    .where(eq(companies.id, id))
    .returning();
  if (!row) return null;
  if (patch.investmentIds !== undefined) {
    await setCompanyInvestments(id, patch.investmentIds);
  }
  return row;
}

export async function deleteCompany(id: string) {
  await requireAuth();
  // ownership/loan edges referencing this company cascade (see schema).
  const res = await db
    .delete(companies)
    .where(eq(companies.id, id))
    .returning({ id: companies.id });
  return res.length > 0;
}

// Ownership (stakes) ──────────────────────────────────────────────────────────

export type OwnershipInput = {
  ownerCompanyId?: string | null; // null = principal (you)
  ownedCompanyId: string;
  percentage: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  notes?: string | null;
};

export async function createOwnership(input: OwnershipInput) {
  await requireAuth();
  const ts = now();
  const row = {
    id: randomUUID(),
    ownerCompanyId: input.ownerCompanyId ?? null,
    ownedCompanyId: input.ownedCompanyId,
    percentage: input.percentage,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo ?? null,
    withholdingOverride: null,
    intercompanyExempt: null,
    notes: input.notes ?? null,
    createdAt: ts,
    updatedAt: ts,
  };
  await db.insert(ownership).values(row);
  return row;
}

export async function updateOwnership(
  id: string,
  patch: Partial<OwnershipInput>,
) {
  await requireAuth();
  const update: Record<string, unknown> = { updatedAt: now() };
  for (const k of [
    "ownerCompanyId",
    "ownedCompanyId",
    "percentage",
    "effectiveFrom",
    "effectiveTo",
    "notes",
  ] as const) {
    if (patch[k] !== undefined) update[k] = patch[k];
  }
  const [row] = await db
    .update(ownership)
    .set(update)
    .where(eq(ownership.id, id))
    .returning();
  return row ?? null;
}

export async function deleteOwnership(id: string) {
  await requireAuth();
  const res = await db
    .delete(ownership)
    .where(eq(ownership.id, id))
    .returning({ id: ownership.id });
  return res.length > 0;
}

// Loans ───────────────────────────────────────────────────────────────────────

export type LoanInput = {
  lenderCompanyId?: string | null; // null = principal
  borrowerCompanyId?: string | null; // null = principal
  principal: number;
  currency: string;
  interestRate?: number | null;
  interestType?: string;
  compounding?: string;
  repaymentType?: string;
  paymentFrequency?: string;
  originationDate?: string | null;
  maturityDate?: string | null;
  status?: string;
  notes?: string | null;
};

export async function createLoan(input: LoanInput) {
  await requireAuth();
  const ts = now();
  const row = {
    id: randomUUID(),
    lenderCompanyId: input.lenderCompanyId ?? null,
    borrowerCompanyId: input.borrowerCompanyId ?? null,
    principal: input.principal,
    currency: input.currency,
    interestRate: input.interestRate ?? null,
    interestType: input.interestType ?? "fixed",
    compounding: input.compounding ?? "simple",
    repaymentType: input.repaymentType ?? "bullet",
    paymentFrequency: input.paymentFrequency ?? "none",
    originationDate: input.originationDate ?? null,
    maturityDate: input.maturityDate ?? null,
    status: input.status ?? "active",
    notes: input.notes ?? null,
    createdAt: ts,
    updatedAt: ts,
  };
  await db.insert(loans).values(row);
  return row;
}

export async function updateLoan(id: string, patch: Partial<LoanInput>) {
  await requireAuth();
  const update: Record<string, unknown> = { updatedAt: now() };
  for (const k of [
    "lenderCompanyId",
    "borrowerCompanyId",
    "principal",
    "currency",
    "interestRate",
    "interestType",
    "compounding",
    "repaymentType",
    "paymentFrequency",
    "originationDate",
    "maturityDate",
    "status",
    "notes",
  ] as const) {
    if (patch[k] !== undefined) update[k] = patch[k];
  }
  const [row] = await db
    .update(loans)
    .set(update)
    .where(eq(loans.id, id))
    .returning();
  return row ?? null;
}

export async function deleteLoan(id: string) {
  await requireAuth();
  const res = await db
    .delete(loans)
    .where(eq(loans.id, id))
    .returning({ id: loans.id });
  return res.length > 0;
}
