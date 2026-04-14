"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Investment } from "@/db/schema";

const KEY = ["investments"] as const;

export type InvestmentInput = {
  name: string;
  ticker?: string | null;
  quantity?: number | null;
  purchasePrice?: number | null;
  purchaseDate?: string | null;
  currentPrice?: number | null;
  currency?: string | null;
  assetType?: string | null;
  vestDate?: string | null;
  notes?: string | null;
  annualGrowthRate?: number | null;
};

export function useInvestments() {
  return useQuery({
    queryKey: KEY,
    queryFn: () =>
      apiFetch<{ investments: Investment[]; count: number }>(
        "/api/investments",
      ),
  });
}

export function useInvestment(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () =>
      apiFetch<{ investment: Investment }>(`/api/investments/${id}`),
    enabled: !!id,
  });
}

export function useCreateInvestment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: InvestmentInput) =>
      apiFetch<{ investment: Investment }>("/api/investments", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateInvestment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<InvestmentInput>;
    }) =>
      apiFetch<{ investment: Investment }>(`/api/investments/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: [...KEY, vars.id] });
    },
  });
}

export function useDeleteInvestment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ deleted: boolean }>(`/api/investments/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useCopyAllocations(targetInvestmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sourceId: string) =>
      apiFetch<{ copied: number }>(
        `/api/investments/${targetInvestmentId}/copy-allocations`,
        { method: "POST", body: JSON.stringify({ sourceId }) },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["allocations"] });
    },
  });
}

export function useRefreshPrices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{
        updated: number;
        failed: number;
        skipped: number;
        total: number;
      }>("/api/investments/prices", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
