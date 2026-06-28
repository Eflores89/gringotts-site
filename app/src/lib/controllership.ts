// Shared types + constants for the controllership graph. Deliberately NOT
// "server-only" and free of db/auth imports, so client components (the graph)
// can import the runtime `PRINCIPAL_ID` value and these types without pulling
// server modules (next/headers) into the client bundle.

// The principal (you) is a synthetic node in the graph with this id. Real
// owner/lender ids are company UUIDs; a null company id means the principal.
export const PRINCIPAL_ID = "principal";

// A stake counts as "controlling" when strictly greater than this percentage.
// Used both for node look-through interest and edge highlighting.
export const CONTROLLING_THRESHOLD = 25;

export type GraphCompany = {
  id: string;
  name: string;
  code: string;
  jurisdictionId: string | null;
  jurisdictionName: string | null;
  jurisdictionCode: string | null;
  entityType: string | null;
  functionalCurrency: string | null;
  notes: string | null;
  // Investments linked to this company (funding rounds). Valuation is the sum
  // of all linked rounds, converted to EUR.
  linkedInvestmentIds: string[];
  valuation: number | null;
  valuationCurrency: string | null;
  // Principal's current direct stake in this company (null if none).
  directStake: number | null;
  // Principal's look-through economic interest (0–100), summed over all paths.
  lookThrough: number;
  controlling: boolean;
};

export type GraphOwnershipEdge = {
  id: string;
  ownerId: string; // PRINCIPAL_ID or a company id
  ownedId: string;
  percentage: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  notes: string | null;
};

export type GraphLoanEdge = {
  id: string;
  lenderId: string; // PRINCIPAL_ID or a company id
  borrowerId: string; // PRINCIPAL_ID or a company id
  principal: number;
  currency: string;
  interestRate: number | null;
  interestType: string;
  compounding: string;
  repaymentType: string;
  paymentFrequency: string;
  originationDate: string | null;
  maturityDate: string | null;
  status: string;
  notes: string | null;
};

export type GraphJurisdiction = {
  id: string;
  name: string;
  code: string;
  corporateTaxRate: number | null;
  participationExemptionThreshold: number | null;
  personalDividendRate: number | null;
  personalCapitalGainsRate: number | null;
};

// Minimal investment shape for the "link valuation" picker on companies.
export type LinkableInvestment = {
  id: string;
  name: string;
  assetType: string | null;
};

export type ControllershipGraph = {
  companies: GraphCompany[];
  ownershipEdges: GraphOwnershipEdge[]; // current edges only (effectiveTo IS NULL)
  loans: GraphLoanEdge[];
  // Full per-company stake history, newest first, for the detail drawer.
  stakeHistory: Record<string, GraphOwnershipEdge[]>;
  // Select options + raw rows for the CRUD forms and data tables.
  jurisdictions: GraphJurisdiction[];
  investments: LinkableInvestment[];
  // Persisted node positions (nodeId → {x,y}); empty = use auto layout.
  nodePositions: Record<string, { x: number; y: number }>;
  // Persisted manual edge waypoints (edgeId → ordered [{x,y}] in flow coords);
  // absent = a straight line between the two node borders.
  edgeWaypoints: Record<string, Array<{ x: number; y: number }>>;
};
