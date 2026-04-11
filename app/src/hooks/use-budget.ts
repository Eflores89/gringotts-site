"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Budget } from "@/db/schema";

const KEY = ["budget"] as const;

export type BudgetInput = {
  transaction?: string | null;
  amount: number;
  currency: string;
  categoryId: string;
  chargeDate: string;
  status?: string | null;
};

export type BudgetFilter = {
  year?: number;
  month?: number;
  categoryId?: string;
};

function query(filter: BudgetFilter) {
  const p = new URLSearchParams();
  if (filter.year) p.set("year", String(filter.year));
  if (filter.month) p.set("month", String(filter.month));
  if (filter.categoryId) p.set("category", filter.categoryId);
  const qs = p.toString();
  return qs ? `?${qs}` : "";
}

export function useBudget(filter: BudgetFilter = {}) {
  return useQuery({
    queryKey: [...KEY, filter],
    queryFn: () =>
      apiFetch<{ budget: Budget[]; count: number }>(`/api/budget${query(filter)}`),
  });
}

export function useBudgetEntry(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => apiFetch<{ budget: Budget }>(`/api/budget/${id}`),
    enabled: !!id,
  });
}

export function useCreateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BudgetInput) =>
      apiFetch<{ budget: Budget }>("/api/budget", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<BudgetInput> }) =>
      apiFetch<{ budget: Budget }>(`/api/budget/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: [...KEY, vars.id] });
    },
  });
}

export function useDeleteBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ deleted: boolean }>(`/api/budget/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
