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
import type { Investment } from "@/db/schema";
import { CURRENCIES } from "@/lib/fx";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal(""));
const optNum = z.number().optional().or(z.literal(""));

export const investmentFormSchema = z.object({
  name: z.string().min(1).max(200),
  ticker: z.string().max(32).optional().or(z.literal("")),
  quantity: optNum,
  purchasePrice: optNum,
  purchaseDate: isoDate,
  currentPrice: optNum,
  currency: z.string().max(8).optional().or(z.literal("")),
  assetType: z.string().max(32).optional().or(z.literal("")),
  vestDate: isoDate,
  notes: z.string().max(2000).optional().or(z.literal("")),
  annualGrowthRate: optNum,
});
export type InvestmentFormValues = z.infer<typeof investmentFormSchema>;

const ASSET_TYPES = [
  "stock",
  "etf",
  "fund",
  "bond",
  "crypto",
  "real-estate",
  "cash",
  "other",
] as const;

export function InvestmentForm({
  initial,
  submitLabel,
  submitting,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<Investment>;
  submitLabel: string;
  submitting?: boolean;
  onSubmit: (values: InvestmentFormValues) => void;
  onCancel?: () => void;
}) {
  const form = useForm<InvestmentFormValues>({
    resolver: zodResolver(investmentFormSchema),
    defaultValues: {
      name: initial?.name ?? "",
      ticker: initial?.ticker ?? "",
      quantity: (initial?.quantity as number | undefined) ?? "",
      purchasePrice: (initial?.purchasePrice as number | undefined) ?? "",
      purchaseDate: initial?.purchaseDate ?? "",
      currentPrice: (initial?.currentPrice as number | undefined) ?? "",
      currency: initial?.currency ?? "EUR",
      assetType: initial?.assetType ?? "",
      vestDate: initial?.vestDate ?? "",
      notes: initial?.notes ?? "",
      annualGrowthRate: (initial?.annualGrowthRate as number | undefined) ?? "",
    },
  });

  useEffect(() => {
    if (initial) {
      form.reset({
        name: initial.name ?? "",
        ticker: initial.ticker ?? "",
        quantity: (initial.quantity as number | undefined) ?? "",
        purchasePrice: (initial.purchasePrice as number | undefined) ?? "",
        purchaseDate: initial.purchaseDate ?? "",
        currentPrice: (initial.currentPrice as number | undefined) ?? "",
        currency: initial.currency ?? "EUR",
        assetType: initial.assetType ?? "",
        vestDate: initial.vestDate ?? "",
        notes: initial.notes ?? "",
        annualGrowthRate: (initial.annualGrowthRate as number | undefined) ?? "",
      });
    }
  }, [initial, form]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
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
            name="ticker"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ticker</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="VOO, AAPL, BTC-USD…" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quantity</FormLabel>
                <FormControl>
                  <Input type="number" step="any" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="purchasePrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Purchase price</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="currentPrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Current price</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency</FormLabel>
                <Select value={field.value || "EUR"} onValueChange={field.onChange}>
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
          <FormField
            control={form.control}
            name="assetType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Asset type</FormLabel>
                <Select value={field.value || ""} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {ASSET_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="annualGrowthRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Growth rate (%/yr)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="purchaseDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Purchase date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="vestDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vest date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Input {...field} />
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
