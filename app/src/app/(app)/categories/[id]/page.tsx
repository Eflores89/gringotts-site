"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CategoryForm,
  type CategoryFormValues,
} from "@/components/categories/CategoryForm";
import { PageHeader } from "@/components/common/PageHeader";
import { useCategory, useUpdateCategory } from "@/hooks/use-categories";

function toPatch(values: CategoryFormValues) {
  const empty = (s: string | undefined) => (s && s.length > 0 ? s : null);
  return {
    name: values.name,
    spendName: empty(values.spendName),
    spendId: empty(values.spendId),
    spendGrp: empty(values.spendGrp),
    spendLifegrp: empty(values.spendLifegrp),
    status: empty(values.status),
  };
}

export default function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data, isLoading, isError, error } = useCategory(id);
  const update = useUpdateCategory();

  async function onSubmit(values: CategoryFormValues) {
    try {
      await update.mutateAsync({ id, patch: toPatch(values) });
      toast.success("Saved");
      router.push("/categories");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Edit category" />
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-2/3" />
            </div>
          ) : isError || !data ? (
            <p className="text-sm text-destructive">
              {error instanceof Error ? error.message : "Not found"}
            </p>
          ) : (
            <CategoryForm
              initial={data.category}
              submitLabel="Save"
              submitting={update.isPending}
              onSubmit={onSubmit}
              onCancel={() => router.push("/categories")}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
