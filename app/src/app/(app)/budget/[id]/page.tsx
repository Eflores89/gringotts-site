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
  BudgetForm,
  type BudgetFormValues,
} from "@/components/budget/BudgetForm";
import { PageHeader } from "@/components/common/PageHeader";
import { useCategories } from "@/hooks/use-categories";
import { useBudgetEntry, useUpdateBudget } from "@/hooks/use-budget";

function toPatch(values: BudgetFormValues) {
  const empty = (s: string | undefined) => (s && s.length > 0 ? s : null);
  return {
    transaction: empty(values.transaction),
    amount: Number(values.amount),
    currency: values.currency,
    categoryId: values.categoryId,
    chargeDate: values.chargeDate,
    status: empty(values.status),
  };
}

export default function EditBudgetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const cats = useCategories();
  const entry = useBudgetEntry(id);
  const update = useUpdateBudget();

  async function onSubmit(values: BudgetFormValues) {
    try {
      await update.mutateAsync({ id, patch: toPatch(values) });
      toast.success("Saved");
      router.push("/budget");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Edit budget entry" />
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent>
          {entry.isLoading || cats.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-2/3" />
            </div>
          ) : entry.isError || !entry.data ? (
            <p className="text-sm text-destructive">
              {entry.error instanceof Error ? entry.error.message : "Not found"}
            </p>
          ) : (
            <BudgetForm
              initial={entry.data.budget}
              categories={cats.data?.categories ?? []}
              submitLabel="Save"
              submitting={update.isPending}
              onSubmit={onSubmit}
              onCancel={() => router.push("/budget")}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
