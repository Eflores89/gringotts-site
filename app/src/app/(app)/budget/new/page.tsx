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
  BudgetForm,
  type BudgetFormValues,
} from "@/components/budget/BudgetForm";
import { PageHeader } from "@/components/common/PageHeader";
import { useCategories } from "@/hooks/use-categories";
import { useCreateBudget } from "@/hooks/use-budget";

function toInput(values: BudgetFormValues) {
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

export default function NewBudgetPage() {
  const router = useRouter();
  const cats = useCategories();
  const create = useCreateBudget();

  async function onSubmit(values: BudgetFormValues) {
    try {
      await create.mutateAsync(toInput(values));
      toast.success("Budget entry created");
      router.push("/budget");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="New budget entry" />
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
            <BudgetForm
              categories={cats.data?.categories ?? []}
              submitLabel="Create"
              submitting={create.isPending}
              onSubmit={onSubmit}
              onCancel={() => router.push("/budget")}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
