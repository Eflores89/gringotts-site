"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  Column,
  Skeleton,
  Text,
  useToast,
} from "@once-ui-system/core";
import {
  CategoryForm,
  type CategoryFormValues,
} from "@/components/categories/CategoryForm";
import { PageHeader } from "@/components/common/PageHeader";
import {
  useCategory,
  useUpdateCategory,
} from "@/hooks/use-categories";

function toPatch(values: CategoryFormValues) {
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

export default function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data, isLoading, isError, error } = useCategory(id);
  const update = useUpdateCategory();
  const { addToast } = useToast();

  async function onSubmit(values: CategoryFormValues) {
    try {
      await update.mutateAsync({ id, patch: toPatch(values) });
      addToast({ variant: "success", message: "Saved" });
      router.push("/categories");
      router.refresh();
    } catch (err) {
      addToast({
        variant: "danger",
        message: err instanceof Error ? err.message : "Update failed",
      });
    }
  }

  return (
    <Column gap="20" fillWidth>
      <PageHeader title="Edit category" />
      <Card padding="l" radius="l" border="neutral-medium" background="surface">
        {isLoading ? (
          <Column gap="12">
            <Skeleton shape="line" width="l" height="s" />
            <Skeleton shape="line" width="xl" height="s" />
            <Skeleton shape="line" width="xl" height="s" />
          </Column>
        ) : isError || !data ? (
          <Text variant="body-default-s" onBackground="danger-medium">
            {error instanceof Error ? error.message : "Not found"}
          </Text>
        ) : (
          <CategoryForm
            initial={data.category}
            submitLabel="Save"
            submitting={update.isPending}
            onSubmit={onSubmit}
            onCancel={() => router.push("/categories")}
          />
        )}
      </Card>
    </Column>
  );
}
