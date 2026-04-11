"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Spending } from "@/db/schema";

const KEY = ["spending"] as const;

export type SpendingInput = {
  transaction?: string | null;
  amount: number;
  currency: string;
  categoryId: string;
  chargeDate: string;
  moneyDate?: string | null;
  method?: string | null;
  spendName?: string | null;
  status?: string | null;
};

export type SpendingFilter = {
  year?: number;
  month?: number;
  categoryId?: string;
};

function query(filter: SpendingFilter) {
  const p = new URLSearchParams();
  if (filter.year) p.set("year", String(filter.year));
  if (filter.month) p.set("month", String(filter.month));
  if (filter.categoryId) p.set("category", filter.categoryId);
  const qs = p.toString();
  return qs ? `?${qs}` : "";
}

export function useSpending(filter: SpendingFilter = {}) {
  return useQuery({
    queryKey: [...KEY, filter],
    queryFn: () =>
      apiFetch<{ spending: Spending[]; count: number }>(`/api/spending${query(filter)}`),
  });
}

export function useSpendingEntry(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => apiFetch<{ spending: Spending }>(`/api/spending/${id}`),
    enabled: !!id,
  });
}

export function useCreateSpending() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SpendingInput) =>
      apiFetch<{ spending: Spending }>("/api/spending", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateSpending() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<SpendingInput> }) =>
      apiFetch<{ spending: Spending }>(`/api/spending/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: [...KEY, vars.id] });
    },
  });
}

export function useDeleteSpending() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ deleted: boolean }>(`/api/spending/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
