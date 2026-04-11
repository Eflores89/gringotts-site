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
  AllocationForm,
  type AllocationFormValues,
} from "@/components/allocations/AllocationForm";
import { PageHeader } from "@/components/common/PageHeader";
import {
  useAllocation,
  useUpdateAllocation,
} from "@/hooks/use-allocations";
import { useInvestments } from "@/hooks/use-investments";

function toPatch(values: AllocationFormValues) {
  return {
    name: values.name && values.name.length > 0 ? values.name : null,
    allocationType: values.allocationType,
    category: values.category,
    percentage: Number(values.percentage),
    investmentIds: values.investmentIds,
  };
}

export default function EditAllocationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const alloc = useAllocation(id);
  const inv = useInvestments();
  const update = useUpdateAllocation();

  async function onSubmit(values: AllocationFormValues) {
    try {
      await update.mutateAsync({ id, patch: toPatch(values) });
      toast.success("Saved");
      router.push("/allocations");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Edit allocation" />
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent>
          {alloc.isLoading || inv.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : alloc.isError || !alloc.data ? (
            <p className="text-sm text-destructive">
              {alloc.error instanceof Error ? alloc.error.message : "Not found"}
            </p>
          ) : (
            <AllocationForm
              initial={alloc.data.allocation}
              investments={inv.data?.investments ?? []}
              submitLabel="Save"
              submitting={update.isPending}
              onSubmit={onSubmit}
              onCancel={() => router.push("/allocations")}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
