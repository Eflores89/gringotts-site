"use client";

import { useRouter } from "next/navigation";
import { Card, Column, useToast } from "@once-ui-system/core";
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
  const { addToast } = useToast();

  async function onSubmit(values: CategoryFormValues) {
    try {
      await create.mutateAsync(toInput(values));
      addToast({ variant: "success", message: "Category created" });
      router.push("/categories");
      router.refresh();
    } catch (err) {
      addToast({
        variant: "danger",
        message: err instanceof Error ? err.message : "Create failed",
      });
    }
  }

  return (
    <Column gap="20" fillWidth>
      <PageHeader title="New category" />
      <Card padding="l" radius="l" border="neutral-medium" background="surface">
        <CategoryForm
          submitLabel="Create"
          submitting={create.isPending}
          onSubmit={onSubmit}
          onCancel={() => router.push("/categories")}
        />
      </Card>
    </Column>
  );
}
