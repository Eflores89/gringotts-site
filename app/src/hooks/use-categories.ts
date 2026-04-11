"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Category } from "@/db/schema";

const KEY = ["categories"] as const;

export type CategoryInput = {
  name: string;
  spendName?: string | null;
  spendId?: string | null;
  spendGrp?: string | null;
  spendLifegrp?: string | null;
  status?: string | null;
};

export function useCategories() {
  return useQuery({
    queryKey: KEY,
    queryFn: () =>
      apiFetch<{ categories: Category[]; count: number }>("/api/categories"),
  });
}

export function useCategory(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => apiFetch<{ category: Category }>(`/api/categories/${id}`),
    enabled: !!id,
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CategoryInput) =>
      apiFetch<{ category: Category }>("/api/categories", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<CategoryInput> }) =>
      apiFetch<{ category: Category }>(`/api/categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: [...KEY, vars.id] });
    },
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ deleted: boolean }>(`/api/categories/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
