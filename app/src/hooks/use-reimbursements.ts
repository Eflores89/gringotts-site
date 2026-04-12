"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { SpendingReimbursement } from "@/db/schema";

const KEY = ["reimbursements"] as const;

export function useReimbursements(spendingId: string) {
  return useQuery({
    queryKey: [...KEY, spendingId],
    queryFn: () =>
      apiFetch<{ reimbursements: SpendingReimbursement[] }>(
        `/api/spending/${spendingId}/reimbursements`,
      ),
  });
}

export function useCreateReimbursement(spendingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      amount: number;
      currency: string;
      description?: string | null;
      reimbursedDate?: string | null;
      fxRate?: number | null;
    }) =>
      apiFetch<{ reimbursement: SpendingReimbursement }>(
        `/api/spending/${spendingId}/reimbursements`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, spendingId] }),
  });
}

export function useDeleteReimbursement(spendingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reimbId: string) =>
      apiFetch<{ deleted: boolean }>(
        `/api/spending/${spendingId}/reimbursements/${reimbId}`,
        { method: "DELETE" },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, spendingId] }),
  });
}
