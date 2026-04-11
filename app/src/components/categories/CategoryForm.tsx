"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="spendName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Spend name</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Canonical name used by rules" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="spendId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Spend ID</FormLabel>
              <FormControl>
                <Input {...field} placeholder="e.g. SE00012" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="spendGrp"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Group</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="spendLifegrp"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Lifecycle group</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Latest" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex items-center gap-2 pt-2">
          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving…
              </>
            ) : (
              submitLabel
            )}
          </Button>
          {onCancel ? (
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </Button>
          ) : null}
        </div>
      </form>
    </Form>
  );
}
