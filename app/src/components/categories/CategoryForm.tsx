"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, Column, Input, Row } from "@once-ui-system/core";
import type { Category } from "@/db/schema";

export const categoryFormSchema = z.object({
  name: z.string().min(1, "Required").max(200),
  spendName: z.string().max(200).optional().or(z.literal("")),
  spendId: z.string().max(64).optional().or(z.literal("")),
  spendGrp: z.string().max(100).optional().or(z.literal("")),
  spendLifegrp: z.string().max(100).optional().or(z.literal("")),
  status: z.string().max(32).optional().or(z.literal("")),
});
export type CategoryFormValues = z.infer<typeof categoryFormSchema>;

export function CategoryForm({
  initial,
  submitLabel,
  submitting,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<Category>;
  submitLabel: string;
  submitting?: boolean;
  onSubmit: (values: CategoryFormValues) => void;
  onCancel?: () => void;
}) {
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: initial?.name ?? "",
      spendName: initial?.spendName ?? "",
      spendId: initial?.spendId ?? "",
      spendGrp: initial?.spendGrp ?? "",
      spendLifegrp: initial?.spendLifegrp ?? "",
      status: initial?.status ?? "Latest",
    },
  });

  useEffect(() => {
    if (initial) {
      form.reset({
        name: initial.name ?? "",
        spendName: initial.spendName ?? "",
        spendId: initial.spendId ?? "",
        spendGrp: initial.spendGrp ?? "",
        spendLifegrp: initial.spendLifegrp ?? "",
        status: initial.status ?? "Latest",
      });
    }
  }, [initial, form]);

  const errors = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Column gap="16" fillWidth maxWidth={40}>
        <Input
          id="name"
          label="Name"
          error={!!errors.name}
          errorMessage={errors.name?.message}
          {...form.register("name")}
        />
        <Input
          id="spendName"
          label="Spend name (canonical, used by rules)"
          {...form.register("spendName")}
        />
        <Input
          id="spendId"
          label="Spend ID (business code, e.g. SE00012)"
          {...form.register("spendId")}
        />
        <Row gap="16" fillWidth wrap>
          <Input
            id="spendGrp"
            label="Group"
            style={{ flex: 1 }}
            {...form.register("spendGrp")}
          />
          <Input
            id="spendLifegrp"
            label="Lifecycle group"
            style={{ flex: 1 }}
            {...form.register("spendLifegrp")}
          />
        </Row>
        <Input
          id="status"
          label="Status (e.g. Latest, Archived)"
          {...form.register("status")}
        />
        <Row gap="8">
          <Button type="submit" variant="primary" loading={submitting}>
            {submitLabel}
          </Button>
          {onCancel ? (
            <Button
              type="button"
              variant="tertiary"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </Button>
          ) : null}
        </Row>
      </Column>
    </form>
  );
}
