"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Allocation } from "@/db/schema";

const KEY = ["allocations"] as const;

export type AllocationWithLinks = {
  allocation: Allocation;
  investmentIds: string[];
};

export type AllocationInput = {
  name?: string | null;
  allocationType?: string | null;
  category?: string | null;
  percentage?: number | null;
  investmentIds: string[];
};

export type AllocationFilter = {
  investmentId?: string;
  allocationType?: string;
};

function query(filter: AllocationFilter) {
  const p = new URLSearchParams();
  if (filter.investmentId) p.set("investment_id", filter.investmentId);
  if (filter.allocationType) p.set("allocation_type", filter.allocationType);
  const qs = p.toString();
  return qs ? `?${qs}` : "";
}

export function useAllocations(filter: AllocationFilter = {}) {
  return useQuery({
    queryKey: [...KEY, filter],
    queryFn: () =>
      apiFetch<{ allocations: AllocationWithLinks[]; count: number }>(
        `/api/allocations${query(filter)}`,
      ),
  });
}

export function useAllocation(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () =>
      apiFetch<{ allocation: AllocationWithLinks }>(`/api/allocations/${id}`),
    enabled: !!id,
  });
}

export function useCreateAllocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AllocationInput) =>
      apiFetch<{ allocation: AllocationWithLinks }>("/api/allocations", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateAllocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<AllocationInput>;
    }) =>
      apiFetch<{ allocation: AllocationWithLinks }>(`/api/allocations/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: [...KEY, vars.id] });
    },
  });
}

export function useDeleteAllocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ deleted: boolean }>(`/api/allocations/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
