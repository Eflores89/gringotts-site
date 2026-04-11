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
  SpendingForm,
  type SpendingFormValues,
} from "@/components/spending/SpendingForm";
import { PageHeader } from "@/components/common/PageHeader";
import { useCategories } from "@/hooks/use-categories";
import {
  useSpendingEntry,
  useUpdateSpending,
} from "@/hooks/use-spending";

function toPatch(values: SpendingFormValues) {
  const empty = (s: string | undefined) => (s && s.length > 0 ? s : null);
  return {
    transaction: empty(values.transaction),
    amount: Number(values.amount),
    currency: values.currency,
    categoryId: values.categoryId,
    chargeDate: values.chargeDate,
    moneyDate: empty(values.moneyDate),
    method: empty(values.method),
    spendName: empty(values.spendName),
    status: empty(values.status),
  };
}

export default function EditSpendingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const cats = useCategories();
  const entry = useSpendingEntry(id);
  const update = useUpdateSpending();

  async function onSubmit(values: SpendingFormValues) {
    try {
      await update.mutateAsync({ id, patch: toPatch(values) });
      toast.success("Saved");
      router.push("/spending");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Edit spending entry" />
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
              {entry.error instanceof Error
                ? entry.error.message
                : "Not found"}
            </p>
          ) : (
            <SpendingForm
              initial={entry.data.spending}
              categories={cats.data?.categories ?? []}
              submitLabel="Save"
              submitting={update.isPending}
              onSubmit={onSubmit}
              onCancel={() => router.push("/spending")}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
