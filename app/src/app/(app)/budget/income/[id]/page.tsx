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
  IncomeForm,
  type IncomeFormValues,
} from "@/components/income/IncomeForm";
import { PageHeader } from "@/components/common/PageHeader";
import { useCategories } from "@/hooks/use-categories";
import { useIncomeEntry, useUpdateIncome } from "@/hooks/use-income";

function toPatch(values: IncomeFormValues) {
  const empty = (s: string | undefined) => (s && s.length > 0 ? s : null);
  return {
    description: empty(values.description),
    amount: Number(values.amount),
    currency: values.currency,
    chargeDate: values.chargeDate,
    source: empty(values.source),
    notes: empty(values.notes),
    categoryId: empty(values.categoryId),
  };
}

export default function EditBudgetIncomePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const cats = useCategories({ kind: "income" });
  const entry = useIncomeEntry(id);
  const update = useUpdateIncome();

  async function onSubmit(values: IncomeFormValues) {
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
      <PageHeader title="Edit planned income" />
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
            <IncomeForm
              initial={entry.data.income}
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
