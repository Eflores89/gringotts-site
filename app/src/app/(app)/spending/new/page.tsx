"use client";

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
import { useCreateSpending } from "@/hooks/use-spending";

function toInput(values: SpendingFormValues) {
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

export default function NewSpendingPage() {
  const router = useRouter();
  const cats = useCategories();
  const create = useCreateSpending();

  async function onSubmit(values: SpendingFormValues) {
    try {
      await create.mutateAsync(toInput(values));
      toast.success("Entry created");
      router.push("/spending");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="New spending entry" />
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent>
          {cats.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-2/3" />
            </div>
          ) : (
            <SpendingForm
              categories={cats.data?.categories ?? []}
              submitLabel="Create"
              submitting={create.isPending}
              onSubmit={onSubmit}
              onCancel={() => router.push("/spending")}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
