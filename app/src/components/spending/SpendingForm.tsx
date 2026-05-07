"use client";

import { useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
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
import type { Category, PaymentMethod, Spending } from "@/db/schema";
import { CURRENCIES, FX_TO_EUR } from "@/lib/fx";
import { formatAmount } from "@/lib/format";
import { numericOnChange } from "@/lib/utils";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const spendingFormSchema = z.object({
  transaction: z.string().max(500).optional().or(z.literal("")),
  amount: z.number().finite(),
  currency: z.string().min(1).max(8),
  categoryId: z.string().uuid("Select a category"),
  chargeDate: isoDate,
  moneyDate: isoDate.optional().or(z.literal("")),
  method: z.string().max(50).optional().or(z.literal("")),
  spendName: z.string().max(200).optional().or(z.literal("")),
  status: z.string().max(32).optional().or(z.literal("")),
  fxRate: z.number().positive("Must be > 0"),
});
export type SpendingFormValues = z.infer<typeof spendingFormSchema>;

function deriveFxRate(initial?: Partial<Spending>): number {
  if (
    initial?.euroMoney != null &&
    initial?.amount != null &&
    initial.amount !== 0
  ) {
    return initial.euroMoney / initial.amount;
  }
  return FX_TO_EUR[(initial?.currency ?? "EUR").toUpperCase()] ?? 1;
}

export function SpendingForm({
  initial,
  categories,
  methods,
  submitLabel,
  submitting,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<Spending>;
  categories: Category[];
  methods: PaymentMethod[];
  submitLabel: string;
  submitting?: boolean;
  onSubmit: (values: SpendingFormValues) => void;
  onCancel?: () => void;
}) {
  const form = useForm<SpendingFormValues>({
    resolver: zodResolver(spendingFormSchema),
    defaultValues: {
      transaction: initial?.transaction ?? "",
      amount: (initial?.amount as number | undefined) ?? 0,
      currency: initial?.currency ?? "EUR",
      categoryId: initial?.categoryId ?? "",
      chargeDate:
        initial?.chargeDate ?? new Date().toISOString().slice(0, 10),
      moneyDate: initial?.moneyDate ?? "",
      method: initial?.method ?? "",
      spendName: initial?.spendName ?? "",
      status: initial?.status ?? "",
      fxRate: deriveFxRate(initial),
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
        moneyDate: initial.moneyDate ?? "",
        method: initial.method ?? "",
        spendName: initial.spendName ?? "",
        status: initial.status ?? "",
        fxRate: deriveFxRate(initial),
      });
    }
  }, [initial, form]);

  // Live EUR preview
  const watchAmount = useWatch({ control: form.control, name: "amount" });
  const watchFxRate = useWatch({ control: form.control, name: "fxRate" });
  const liveEur = useMemo(() => {
    const a = Number(watchAmount) || 0;
    const r = Number(watchFxRate) || 0;
    return a * r;
  }, [watchAmount, watchFxRate]);

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
                <Input {...field} placeholder="e.g. Mercadona weekly shop" />
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
                  <Input
                    type="number"
                    step="0.01"
                    {...field}
                    onChange={numericOnChange(field.onChange)}
                  />
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
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="fxRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>FX rate (→ EUR)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    {...field}
                    onChange={numericOnChange(field.onChange, 1)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex flex-col justify-end sm:col-span-2">
            <p className="mb-2 text-sm text-muted-foreground">
              EUR amount:{" "}
              <span className="font-mono font-medium text-foreground">
                €{formatAmount(liveEur)}
              </span>
            </p>
          </div>
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
                <FormLabel>Spend date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="moneyDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Due date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="method"
            render={({ field }) => {
              const names = methods.map((m) => m.name);
              const current = field.value || "";
              // If the row has a legacy method that's no longer configured,
              // keep it visible so saving doesn't silently drop it.
              const options =
                current && !names.includes(current)
                  ? [...names, current]
                  : names;
              return (
                <FormItem>
                  <FormLabel>Method</FormLabel>
                  <Select value={current} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            methods.length === 0
                              ? "Add methods in Auxiliary"
                              : "—"
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {options.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              );
            }}
          />
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="e.g. confirmed" />
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
