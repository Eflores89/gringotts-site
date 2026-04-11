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
  AllocationForm,
  type AllocationFormValues,
} from "@/components/allocations/AllocationForm";
import { PageHeader } from "@/components/common/PageHeader";
import { useCreateAllocation } from "@/hooks/use-allocations";
import { useInvestments } from "@/hooks/use-investments";

function toInput(values: AllocationFormValues) {
  return {
    name: values.name && values.name.length > 0 ? values.name : null,
    allocationType: values.allocationType,
    category: values.category,
    percentage: Number(values.percentage),
    investmentIds: values.investmentIds,
  };
}

export default function NewAllocationPage() {
  const router = useRouter();
  const inv = useInvestments();
  const create = useCreateAllocation();

  async function onSubmit(values: AllocationFormValues) {
    try {
      await create.mutateAsync(toInput(values));
      toast.success("Allocation created");
      router.push("/allocations");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="New allocation" />
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent>
          {inv.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            <AllocationForm
              investments={inv.data?.investments ?? []}
              submitLabel="Create"
              submitting={create.isPending}
              onSubmit={onSubmit}
              onCancel={() => router.push("/allocations")}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
