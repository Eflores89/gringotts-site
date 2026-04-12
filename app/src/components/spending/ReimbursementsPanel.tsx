"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, ReceiptText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useReimbursements,
  useCreateReimbursement,
  useDeleteReimbursement,
} from "@/hooks/use-reimbursements";
import { formatMoney } from "@/lib/format";
import { CURRENCIES, FX_TO_EUR } from "@/lib/fx";
import type { Spending } from "@/db/schema";

export function ReimbursementsPanel({
  spending,
}: {
  spending: Spending;
}) {
  const { data, isLoading } = useReimbursements(spending.id);
  const create = useCreateReimbursement(spending.id);
  const del = useDeleteReimbursement(spending.id);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    amount: "",
    currency: spending.currency,
    description: "",
    reimbursedDate: new Date().toISOString().slice(0, 10),
    fxRate: String(FX_TO_EUR[spending.currency.toUpperCase()] ?? 1),
  });

  const rows = data?.reimbursements ?? [];
  const totalReimbursed = rows.reduce((s, r) => s + (r.euroMoney ?? 0), 0);
  const netSpending = (spending.euroMoney ?? 0) - totalReimbursed;

  async function onAdd() {
    try {
      await create.mutateAsync({
        amount: Number(form.amount),
        currency: form.currency,
        description: form.description || null,
        reimbursedDate: form.reimbursedDate || null,
        fxRate: Number(form.fxRate) || null,
      });
      toast.success("Reimbursement added");
      setShowAdd(false);
      setForm({
        amount: "",
        currency: spending.currency,
        description: "",
        reimbursedDate: new Date().toISOString().slice(0, 10),
        fxRate: String(FX_TO_EUR[spending.currency.toUpperCase()] ?? 1),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <Card className="max-w-3xl">
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="text-base">Reimbursements</CardTitle>
          <p className="text-sm text-muted-foreground">
            Discount parts paid by others. Original: {formatMoney(spending.euroMoney, "EUR")}
            {rows.length > 0 && (
              <> · Reimbursed: {formatMoney(totalReimbursed, "EUR")} ·{" "}
                <span className="font-medium text-foreground">
                  Net: {formatMoney(netSpending, "EUR")}
                </span>
              </>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAdd(!showAdd)}
        >
          <Plus className="size-4" /> Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {showAdd && (
          <div className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-muted/30 p-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Amount</label>
              <Input
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) =>
                  setForm((f) => ({ ...f, amount: e.target.value }))
                }
                className="w-24"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Currency</label>
              <Select
                value={form.currency}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    currency: v,
                    fxRate: String(FX_TO_EUR[v] ?? 1),
                  }))
                }
              >
                <SelectTrigger className="w-[80px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">FX → EUR</label>
              <Input
                type="number"
                step="any"
                value={form.fxRate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, fxRate: e.target.value }))
                }
                className="w-20"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">
                Description
              </label>
              <Input
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Alba's share"
                className="w-40"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">
                Reimbursed date
              </label>
              <Input
                type="date"
                value={form.reimbursedDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, reimbursedDate: e.target.value }))
                }
                className="w-36"
              />
            </div>
            <Button
              size="sm"
              onClick={onAdd}
              disabled={!form.amount || create.isPending}
            >
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowAdd(false)}
            >
              Cancel
            </Button>
          </div>
        )}
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <ReceiptText className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No reimbursements yet. Click &quot;Add&quot; to discount a portion
              (e.g. someone else&apos;s share).
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <Badge variant="outline">
                    {formatMoney(r.amount, r.currency)}
                  </Badge>
                  <span className="text-sm">
                    {r.description ?? "Reimbursement"}
                  </span>
                  {r.reimbursedDate && (
                    <span className="text-xs text-muted-foreground">
                      {r.reimbursedDate}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm">
                    {formatMoney(r.euroMoney, "EUR")}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      try {
                        await del.mutateAsync(r.id);
                        toast.success("Removed");
                      } catch (err) {
                        toast.error(
                          err instanceof Error ? err.message : "Failed",
                        );
                      }
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
