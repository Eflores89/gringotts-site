"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { AllocationWithLinks } from "@/hooks/use-allocations";

export const allocationFormSchema = z.object({
  name: z.string().max(200).optional().or(z.literal("")),
  allocationType: z.enum(["industry", "geography"]),
  category: z.string().min(1).max(100),
  percentage: z.coerce.number().min(0).max(100),
  investmentIds: z.array(z.string().uuid()).min(1, "Select at least one investment"),
});
export type AllocationFormValues = z.infer<typeof allocationFormSchema>;

export function AllocationForm({
  initial,
  investments,
  submitLabel,
  submitting,
  onSubmit,
  onCancel,
}: {
  initial?: AllocationWithLinks;
  investments: Investment[];
  submitLabel: string;
  submitting?: boolean;
  onSubmit: (values: AllocationFormValues) => void;
  onCancel?: () => void;
}) {
  const form = useForm<AllocationFormValues>({
    resolver: zodResolver(allocationFormSchema),
    defaultValues: {
      name: initial?.allocation.name ?? "",
      allocationType:
        (initial?.allocation.allocationType as "industry" | "geography") ??
        "industry",
      category: initial?.allocation.category ?? "",
      percentage: (initial?.allocation.percentage as number | undefined) ?? 0,
      investmentIds: initial?.investmentIds ?? [],
    },
  });

  useEffect(() => {
    if (initial) {
      form.reset({
        name: initial.allocation.name ?? "",
        allocationType:
          (initial.allocation.allocationType as "industry" | "geography") ??
          "industry",
        category: initial.allocation.category ?? "",
        percentage: (initial.allocation.percentage as number | undefined) ?? 0,
        investmentIds: initial.investmentIds,
      });
    }
  }, [initial, form]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="allocationType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="industry">Industry</SelectItem>
                    <SelectItem value="geography">Geography</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="percentage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Percentage (0–100)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" min="0" max="100" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Tech, Europe, US, Finance, …" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name (optional)</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Auto-generated if blank" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="investmentIds"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Investments ({field.value.length} selected)</FormLabel>
              <div className="grid max-h-72 gap-1 overflow-y-auto rounded-md border border-border p-3">
                {investments.length === 0 ? (
                  <p className="p-2 text-sm text-muted-foreground">
                    No investments yet. Create one first.
                  </p>
                ) : (
                  investments.map((inv) => {
                    const checked = field.value.includes(inv.id);
                    return (
                      <label
                        key={inv.id}
                        className="flex cursor-pointer items-center gap-3 rounded px-2 py-1.5 text-sm hover:bg-accent"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(c) => {
                            if (c) field.onChange([...field.value, inv.id]);
                            else
                              field.onChange(
                                field.value.filter((x) => x !== inv.id),
                              );
                          }}
                        />
                        <span className="flex-1">{inv.name}</span>
                        {inv.ticker ? (
                          <span className="font-mono text-xs text-muted-foreground">
                            {inv.ticker}
                          </span>
                        ) : null}
                      </label>
                    );
                  })
                )}
              </div>
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
