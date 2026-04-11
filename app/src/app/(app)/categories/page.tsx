"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Button,
  Card,
  Column,
  Dialog,
  Row,
  Skeleton,
  Table,
  Tag,
  Text,
  useToast,
} from "@once-ui-system/core";
import { PageHeader } from "@/components/common/PageHeader";
import { useCategories, useDeleteCategory } from "@/hooks/use-categories";

export default function CategoriesPage() {
  const { data, isLoading, isError, error } = useCategories();
  const del = useDeleteCategory();
  const { addToast } = useToast();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const tableData = useMemo(() => {
    const headers = [
      { content: "Spend ID", key: "spendId" },
      { content: "Name", key: "name" },
      { content: "Spend name", key: "spendName" },
      { content: "Group", key: "spendGrp" },
      { content: "Lifecycle", key: "spendLifegrp" },
      { content: "Status", key: "status" },
      { content: "", key: "actions" },
    ];
    const rows = (data?.categories ?? []).map((c) => [
      <Text key="sid" variant="body-default-s">
        {c.spendId ?? "—"}
      </Text>,
      <Text key="n" variant="body-strong-s">
        {c.name}
      </Text>,
      <Text key="sn" variant="body-default-s">
        {c.spendName ?? "—"}
      </Text>,
      <Text key="g" variant="body-default-s">
        {c.spendGrp ?? "—"}
      </Text>,
      <Text key="lg" variant="body-default-s">
        {c.spendLifegrp ?? "—"}
      </Text>,
      c.status ? (
        <Tag key="st" size="s">
          {c.status}
        </Tag>
      ) : (
        <Text key="st" variant="body-default-s">
          —
        </Text>
      ),
      <Row key="a" gap="4" horizontal="end">
        <Button
          href={`/categories/${c.id}`}
          variant="tertiary"
          size="s"
        >
          Edit
        </Button>
        <Button
          variant="tertiary"
          size="s"
          onClick={() => setConfirmId(c.id)}
        >
          Delete
        </Button>
      </Row>,
    ]);
    return { headers, rows };
  }, [data]);

  async function confirmDelete() {
    if (!confirmId) return;
    try {
      await del.mutateAsync(confirmId);
      addToast({ variant: "success", message: "Category deleted" });
    } catch (err) {
      addToast({
        variant: "danger",
        message: err instanceof Error ? err.message : "Delete failed",
      });
    } finally {
      setConfirmId(null);
    }
  }

  return (
    <Column gap="20" fillWidth>
      <PageHeader
        title="Categories"
        description="Full list of spend categories. Edit or delete as needed."
        actions={
          <Button href="/categories/new" variant="primary" size="s">
            New category
          </Button>
        }
      />
      <Card padding="0" radius="l" border="neutral-medium" background="surface">
        {isLoading ? (
          <Column gap="8" padding="l">
            <Skeleton shape="line" width="xl" height="s" />
            <Skeleton shape="line" width="xl" height="s" />
            <Skeleton shape="line" width="xl" height="s" />
          </Column>
        ) : isError ? (
          <Column padding="l" gap="8">
            <Text variant="body-strong-s" onBackground="danger-medium">
              Failed to load categories
            </Text>
            <Text variant="body-default-s" onBackground="neutral-weak">
              {error instanceof Error ? error.message : "Unknown error"}
            </Text>
          </Column>
        ) : (data?.categories.length ?? 0) === 0 ? (
          <Column padding="xl" horizontal="center" gap="4">
            <Text variant="body-strong-m">No categories yet</Text>
            <Text variant="body-default-s" onBackground="neutral-weak">
              Create one to get started.
            </Text>
          </Column>
        ) : (
          <Table data={tableData} />
        )}
      </Card>

      <Dialog
        isOpen={confirmId !== null}
        onClose={() => setConfirmId(null)}
        title="Delete category?"
        description="This cannot be undone. Categories referenced by spending, budget, or rules cannot be deleted."
        footer={
          <Row gap="8" horizontal="end" fillWidth>
            <Button
              variant="tertiary"
              onClick={() => setConfirmId(null)}
              disabled={del.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={confirmDelete}
              loading={del.isPending}
            >
              Delete
            </Button>
          </Row>
        }
      />
    </Column>
  );
}
