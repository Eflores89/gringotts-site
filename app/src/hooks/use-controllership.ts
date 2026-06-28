"use client";
import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export type JurisdictionPayload = {
  name: string;
  code: string;
  corporateTaxRate?: number | null;
  participationExemptionThreshold?: number | null;
  personalDividendRate?: number | null;
  personalCapitalGainsRate?: number | null;
};

export type CompanyPayload = {
  name: string;
  code: string;
  jurisdictionId?: string | null;
  entityType?: string | null;
  functionalCurrency?: string | null;
  investmentIds?: string[];
  notes?: string | null;
};

export type OwnershipPayload = {
  ownerCompanyId?: string | null;
  ownedCompanyId: string;
  percentage: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  notes?: string | null;
};

export type LoanPayload = {
  lenderCompanyId?: string | null;
  borrowerCompanyId?: string | null;
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

const post = <T>(path: string, body: unknown) =>
  apiFetch<T>(path, { method: "POST", body: JSON.stringify(body) });
const patchReq = <T>(path: string, body: unknown) =>
  apiFetch<T>(path, { method: "PATCH", body: JSON.stringify(body) });
const del = (path: string) => apiFetch<{ deleted: boolean }>(path, { method: "DELETE" });

// One create/update/remove trio per resource. The graph itself is a server
// component, so callers refresh it via router.refresh() in their handlers.
function useResource<TCreate, TUpdate = Partial<TCreate>>(base: string) {
  const create = useMutation({ mutationFn: (b: TCreate) => post(base, b) });
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TUpdate }) =>
      patchReq(`${base}/${id}`, patch),
  });
  const remove = useMutation({ mutationFn: (id: string) => del(`${base}/${id}`) });
  return { create, update, remove };
}

export type NodePosition = { nodeId: string; x: number; y: number };

export function useSavePositions() {
  return useMutation({
    mutationFn: (positions: NodePosition[]) =>
      post("/api/controllership/positions", { positions }),
  });
}

export function useClearPositions() {
  return useMutation({
    mutationFn: () => del("/api/controllership/positions"),
  });
}

export type EdgeWaypoints = Record<string, Array<{ x: number; y: number }>>;

export function useSaveWaypoints() {
  return useMutation({
    mutationFn: (waypoints: EdgeWaypoints) =>
      post("/api/controllership/waypoints", { waypoints }),
  });
}

export function useClearWaypoints() {
  return useMutation({
    mutationFn: () => del("/api/controllership/waypoints"),
  });
}

export const useJurisdictionCrud = () =>
  useResource<JurisdictionPayload>("/api/controllership/jurisdictions");
export const useCompanyCrud = () =>
  useResource<CompanyPayload>("/api/controllership/companies");
export const useOwnershipCrud = () =>
  useResource<OwnershipPayload>("/api/controllership/ownership");
export const useLoanCrud = () =>
  useResource<LoanPayload>("/api/controllership/loans");
