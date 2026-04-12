"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Income } from "@/db/schema";

const KEY = ["income"] as const;

export type IncomeInput = {
  description?: string | null;
  amount: number;
  currency: string;
  chargeDate: string;
  source?: string | null;
  notes?: string | null;
  fxRate?: number | null;
};

export function useIncome(filter?: { year?: number; month?: number }) {
  const p = new URLSearchParams();
  if (filter?.year) p.set("year", String(filter.year));
  if (filter?.month) p.set("month", String(filter.month));
  const qs = p.toString();
  return useQuery({
    queryKey: [...KEY, filter],
    queryFn: () => apiFetch<{ income: Income[]; count: number }>(`/api/income${qs ? `?${qs}` : ""}`),
  });
}

export function useIncomeEntry(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => apiFetch<{ income: Income }>(`/api/income/${id}`),
    enabled: !!id,
  });
}

export function useCreateIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: IncomeInput) =>
      apiFetch<{ income: Income }>("/api/income", {
        method: "POST", body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<IncomeInput> }) =>
      apiFetch<{ income: Income }>(`/api/income/${id}`, {
        method: "PATCH", body: JSON.stringify(patch),
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: [...KEY, vars.id] });
    },
  });
}

export function useDeleteIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ deleted: boolean }>(`/api/income/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
