"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  InvestmentForm,
  type InvestmentFormValues,
} from "@/components/investments/InvestmentForm";
import { PageHeader } from "@/components/common/PageHeader";
import { useCreateInvestment } from "@/hooks/use-investments";

function toInput(values: InvestmentFormValues) {
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

export default function NewInvestmentPage() {
  const router = useRouter();
  const create = useCreateInvestment();

  async function onSubmit(values: InvestmentFormValues) {
    try {
      await create.mutateAsync(toInput(values));
      toast.success("Investment created");
      router.push("/investments");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="New investment" />
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent>
          <InvestmentForm
            submitLabel="Create"
            submitting={create.isPending}
            onSubmit={onSubmit}
            onCancel={() => router.push("/investments")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
