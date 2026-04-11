"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { MerchantRule, SpendeeRule } from "@/db/schema";

const M_KEY = ["merchant-rules"] as const;
const S_KEY = ["spendee-rules"] as const;

export type MerchantRuleInput = {
  pattern: string;
  spendId: string;
  source?: "seed" | "user";
};

export type SpendeeRuleInput = {
  spendeeCategory: string;
  spendId: string;
  source?: "seed" | "user";
};

// merchant ---------------------------------------------------------------

export function useMerchantRules() {
  return useQuery({
    queryKey: M_KEY,
    queryFn: () =>
      apiFetch<{ rules: MerchantRule[]; count: number }>("/api/rules/merchant"),
  });
}

export function useCreateMerchantRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: MerchantRuleInput) =>
      apiFetch<{ rule: MerchantRule }>("/api/rules/merchant", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: M_KEY }),
  });
}

export function useUpdateMerchantRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<MerchantRuleInput>;
    }) =>
      apiFetch<{ rule: MerchantRule }>(`/api/rules/merchant/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: M_KEY }),
  });
}

export function useDeleteMerchantRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ deleted: boolean }>(`/api/rules/merchant/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: M_KEY }),
  });
}

// spendee ----------------------------------------------------------------

export function useSpendeeRules() {
  return useQuery({
    queryKey: S_KEY,
    queryFn: () =>
      apiFetch<{ rules: SpendeeRule[]; count: number }>("/api/rules/spendee"),
  });
}

export function useCreateSpendeeRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SpendeeRuleInput) =>
      apiFetch<{ rule: SpendeeRule }>("/api/rules/spendee", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: S_KEY }),
  });
}

export function useUpdateSpendeeRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<SpendeeRuleInput>;
    }) =>
      apiFetch<{ rule: SpendeeRule }>(`/api/rules/spendee/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: S_KEY }),
  });
}

export function useDeleteSpendeeRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ deleted: boolean }>(`/api/rules/spendee/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: S_KEY }),
  });
}
