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
  IncomeForm,
  type IncomeFormValues,
} from "@/components/income/IncomeForm";
import { PageHeader } from "@/components/common/PageHeader";
import { useCategories } from "@/hooks/use-categories";
import { useCreateIncome } from "@/hooks/use-income";

function toInput(values: IncomeFormValues) {
  const empty = (s: string | undefined) => (s && s.length > 0 ? s : null);
  return {
    description: empty(values.description),
    amount: Number(values.amount),
    currency: values.currency,
    chargeDate: values.chargeDate,
    source: empty(values.source),
    notes: empty(values.notes),
    categoryId: empty(values.categoryId),
    kind: "planned" as const,
  };
}

export default function NewBudgetIncomePage() {
  const router = useRouter();
  const cats = useCategories({ kind: "income" });
  const create = useCreateIncome();

  async function onSubmit(values: IncomeFormValues) {
    try {
      await create.mutateAsync(toInput(values));
      toast.success("Planned income created");
      router.push("/budget");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="New planned income" />
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
            <IncomeForm
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
