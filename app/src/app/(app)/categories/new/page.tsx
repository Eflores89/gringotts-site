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
  CategoryForm,
  type CategoryFormValues,
} from "@/components/categories/CategoryForm";
import { PageHeader } from "@/components/common/PageHeader";
import { useCreateCategory } from "@/hooks/use-categories";

function toInput(values: CategoryFormValues) {
  const empty = (s: string | undefined) => (s && s.length > 0 ? s : null);
  return {
    name: values.name,
    spendName: empty(values.spendName),
    spendId: empty(values.spendId),
    spendGrp: empty(values.spendGrp),
    spendLifegrp: empty(values.spendLifegrp),
    status: empty(values.status),
  };
}

export default function NewCategoryPage() {
  const router = useRouter();
  const create = useCreateCategory();

  async function onSubmit(values: CategoryFormValues) {
    try {
      await create.mutateAsync(toInput(values));
      toast.success("Category created");
      router.push("/categories");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="New category" description="Create a new spend category." />
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent>
          <CategoryForm
            submitLabel="Create"
            submitting={create.isPending}
            onSubmit={onSubmit}
            onCancel={() => router.push("/categories")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
