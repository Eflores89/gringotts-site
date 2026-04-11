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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Budget, Category } from "@/db/schema";
import { CURRENCIES } from "@/lib/fx";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const budgetFormSchema = z.object({
  transaction: z.string().max(500).optional().or(z.literal("")),
  amount: z.coerce.number().finite(),
  currency: z.string().min(1).max(8),
  categoryId: z.string().uuid("Select a category"),
  chargeDate: isoDate,
  status: z.string().max(32).optional().or(z.literal("")),
});
export type BudgetFormValues = z.infer<typeof budgetFormSchema>;

export function BudgetForm({
  initial,
  categories,
  submitLabel,
  submitting,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<Budget>;
  categories: Category[];
  submitLabel: string;
  submitting?: boolean;
  onSubmit: (values: BudgetFormValues) => void;
  onCancel?: () => void;
}) {
  const form = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: {
      transaction: initial?.transaction ?? "",
      amount: (initial?.amount as number | undefined) ?? 0,
      currency: initial?.currency ?? "EUR",
      categoryId: initial?.categoryId ?? "",
      chargeDate:
        initial?.chargeDate ?? new Date().toISOString().slice(0, 10),
      status: initial?.status ?? "",
    },
  });

  useEffect(() => {
    if (initial) {
      form.reset({
        transaction: initial.transaction ?? "",
        amount: (initial.amount as number | undefined) ?? 0,
        currency: initial.currency ?? "EUR",
        categoryId: initial.categoryId ?? "",
        chargeDate:
          initial.chargeDate ?? new Date().toISOString().slice(0, 10),
        status: initial.status ?? "",
      });
    }
  }, [initial, form]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="transaction"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Input {...field} placeholder="e.g. March groceries budget" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Amount</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="categoryId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category…" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.spendId ? `[${c.spendId}] ` : ""}
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="chargeDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Target date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
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
