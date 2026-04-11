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
  InvestmentForm,
  type InvestmentFormValues,
} from "@/components/investments/InvestmentForm";
import { PageHeader } from "@/components/common/PageHeader";
import {
  useInvestment,
  useUpdateInvestment,
} from "@/hooks/use-investments";
import { InvestmentAllocationsPanel } from "@/components/allocations/InvestmentAllocationsPanel";

function toPatch(values: InvestmentFormValues) {
  const empty = (s: string | undefined) => (s && s.length > 0 ? s : null);
  const numOrNull = (v: number | string | undefined) =>
    typeof v === "number" && Number.isFinite(v)
      ? v
      : typeof v === "string" && v !== ""
        ? Number(v)
        : null;
  return {
    name: values.name,
    ticker: empty(values.ticker),
    quantity: numOrNull(values.quantity),
    purchasePrice: numOrNull(values.purchasePrice),
    purchaseDate: empty(values.purchaseDate),
    currentPrice: numOrNull(values.currentPrice),
    currency: empty(values.currency),
    assetType: empty(values.assetType),
    vestDate: empty(values.vestDate),
    notes: empty(values.notes),
    annualGrowthRate: numOrNull(values.annualGrowthRate),
  };
}

export default function EditInvestmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const inv = useInvestment(id);
  const update = useUpdateInvestment();

  async function onSubmit(values: InvestmentFormValues) {
    try {
      await update.mutateAsync({ id, patch: toPatch(values) });
      toast.success("Saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Edit investment" />
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent>
          {inv.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-2/3" />
            </div>
          ) : inv.isError || !inv.data ? (
            <p className="text-sm text-destructive">
              {inv.error instanceof Error ? inv.error.message : "Not found"}
            </p>
          ) : (
            <InvestmentForm
              initial={inv.data.investment}
              submitLabel="Save"
              submitting={update.isPending}
              onSubmit={onSubmit}
              onCancel={() => router.push("/investments")}
            />
          )}
        </CardContent>
      </Card>

      <InvestmentAllocationsPanel investmentId={id} />
    </div>
  );
}
