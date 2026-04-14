"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { toast } from "sonner";
import { Check, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { apiFetch } from "@/lib/api-client";
import { CURRENCIES, FX_TO_EUR } from "@/lib/fx";
import { formatAmount } from "@/lib/format";
import { numericOnChange } from "@/lib/utils";
import type { Category } from "@/db/schema";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const schema = z.object({
  transaction: z.string().max(500).optional().or(z.literal("")),
  amount: z.number().positive("Enter an amount"),
  currency: z.string().min(1).max(8),
  categoryId: z.string().uuid("Select a category"),
  chargeDate: isoDate,
  method: z.string().max(50).optional().or(z.literal("")),
  fxRate: z.number().positive(),
});
type FormValues = z.infer<typeof schema>;

export default function QuickSpendPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiFetch<{ categories: Category[] }>("/api/categories")
      .then((d) => setCategories(d.categories))
      .catch(() => {});
  }, []);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      transaction: "",
      amount: 0,
      currency: "EUR",
      categoryId: "",
      chargeDate: new Date().toISOString().slice(0, 10),
      method: "",
      fxRate: 1,
    },
  });

  const watchAmount = useWatch({ control: form.control, name: "amount" });
  const watchFxRate = useWatch({ control: form.control, name: "fxRate" });
  const liveEur = useMemo(() => (Number(watchAmount) || 0) * (Number(watchFxRate) || 0), [watchAmount, watchFxRate]);

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      await apiFetch("/api/spending", {
        method: "POST",
        body: JSON.stringify({
          transaction: values.transaction || null,
          amount: values.amount,
          currency: values.currency,
          categoryId: values.categoryId,
          chargeDate: values.chargeDate,
          method: values.method || null,
          fxRate: values.fxRate,
        }),
      });
      setSubmitted(true);
      toast.success("Spending entry saved!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  }

  function addAnother() {
    setSubmitted(false);
    form.reset({
      transaction: "",
      amount: 0,
      currency: form.getValues("currency"),
      categoryId: "",
      chargeDate: new Date().toISOString().slice(0, 10),
      method: form.getValues("method"),
      fxRate: form.getValues("fxRate"),
    });
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="space-y-4 pt-8 pb-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/15">
              <Check className="size-7 text-primary" />
            </div>
            <p className="text-lg font-medium">Saved!</p>
            <div className="flex justify-center gap-3">
              <Button onClick={addAnother}>
                <Plus className="size-4" /> Add another
              </Button>
              <Button variant="outline" asChild>
                <Link href="/login">Go to dashboard</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Quick spend</CardTitle>
          <CardDescription>
            Add a spending entry — no login required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="transaction"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Coffee, lunch, …" autoFocus />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
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
                      <Select
                        value={field.value}
                        onValueChange={(v) => {
                          field.onChange(v);
                          form.setValue("fxRate", FX_TO_EUR[v] ?? 1);
                        }}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CURRENCIES.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="fxRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>FX → EUR</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="any"
                          {...field}
                          onChange={numericOnChange(field.onChange, 1)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="col-span-2 flex items-end pb-2">
                  <p className="text-sm text-muted-foreground">
                    EUR: <span className="font-mono font-medium text-foreground">€{formatAmount(liveEur)}</span>
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
                          <SelectValue placeholder="Select…" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="chargeDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="method"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Method</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="cash, card, …" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Saving…
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </form>
          </Form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            <Link href="/login" className="underline underline-offset-2 hover:text-foreground">
              Login to dashboard
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
