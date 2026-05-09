"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Pencil, Trash2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SortableHead } from "@/components/common/SortableHead";
import { useCategories } from "@/hooks/use-categories";
import { useCreateIncome, useDeleteIncome, useIncome } from "@/hooks/use-income";
import { useSort } from "@/hooks/use-sort";
import { formatMoney } from "@/lib/format";
import type { Income } from "@/db/schema";

const ALL = "__all__";
const MONTHS = [
  "Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec",
];

export function BudgetIncomeList() {
  const [year, setYear] = useState<number | undefined>(undefined);
  const [month, setMonth] = useState<number | undefined>(undefined);
  const { data, isLoading, isError, error } = useIncome({
    year,
    month,
    kind: "planned",
  });
  const cats = useCategories({ kind: "income" });
  const del = useDeleteIncome();
  const create = useCreateIncome();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const catById = useMemo(() => {
    const m = new Map<string, string>();
    cats.data?.categories.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [cats.data]);

  const years = useMemo(() => {
    const set = new Set<number>();
    const now = new Date().getFullYear();
    for (let y = now - 3; y <= now + 1; y++) set.add(y);
    return Array.from(set).sort((a, b) => b - a);
  }, []);

  async function confirmDelete() {
    if (!confirmId) return;
    try {
      await del.mutateAsync(confirmId);
      toast.success("Income entry deleted");
      setConfirmId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function duplicate(r: Income) {
    setDuplicatingId(r.id);
    try {
      await create.mutateAsync({
        description: r.description,
        amount: r.amount,
        currency: r.currency,
        chargeDate: r.chargeDate,
        source: r.source,
        notes: r.notes,
        categoryId: r.categoryId,
        kind: "planned",
      });
      toast.success("Income entry duplicated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Duplicate failed");
    } finally {
      setDuplicatingId(null);
    }
  }

  type K = "date" | "description" | "category" | "source" | "amount" | "eur";
  const rows = data?.income ?? [];
  const accessor = useCallback(
    (r: Income, key: K): string | number =>
      key === "date"
        ? r.chargeDate
        : key === "description"
          ? r.description ?? ""
          : key === "category"
            ? (r.categoryId ? catById.get(r.categoryId) ?? "" : "")
            : key === "source"
              ? r.source ?? ""
              : key === "amount"
                ? r.amount
                : (r.euroMoney ?? 0),
    [catById],
  );
  const { sorted, sort, toggle } = useSort<Income, K>(rows, accessor);

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">Year</label>
            <Select
              value={year ? String(year) : ALL}
              onValueChange={(v) =>
                setYear(v === ALL ? undefined : Number(v))
              }
            >
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All</SelectItem>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">Month</label>
            <Select
              value={month ? String(month) : ALL}
              onValueChange={(v) =>
                setMonth(v === ALL ? undefined : Number(v))
              }
            >
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All</SelectItem>
                {MONTHS.map((m, i) => (
                  <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(year || month) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setYear(undefined);
                setMonth(undefined);
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : isError ? (
          <div className="p-6">
            <p className="text-sm font-medium text-destructive">
              Failed to load planned income
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <TrendingUp className="size-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">No planned income yet</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label="Date" sortKey="date" sort={sort} onClick={toggle} className="w-[110px]" />
                <SortableHead label="Description" sortKey="description" sort={sort} onClick={toggle} />
                <SortableHead label="Category" sortKey="category" sort={sort} onClick={toggle} />
                <SortableHead label="Source" sortKey="source" sort={sort} onClick={toggle} />
                <SortableHead label="Amount" sortKey="amount" sort={sort} onClick={toggle} className="text-right" />
                <SortableHead label="EUR" sortKey="eur" sort={sort} onClick={toggle} className="text-right" />
                <SortableHead label="" sortKey={"date" as K} sort={null} onClick={() => {}} className="w-[140px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-muted-foreground">{r.chargeDate}</TableCell>
                  <TableCell className="font-medium">{r.description ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.categoryId ? catById.get(r.categoryId) ?? "—" : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.source ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatMoney(r.amount, r.currency)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatMoney(r.euroMoney, "EUR")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button asChild variant="ghost" size="icon">
                        <Link href={`/budget/income/${r.id}`} aria-label="Edit">
                          <Pencil className="size-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => duplicate(r)}
                        disabled={duplicatingId === r.id}
                        aria-label="Duplicate"
                      >
                        <Copy className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setConfirmId(r.id)}
                        aria-label="Delete"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={confirmId !== null} onOpenChange={(o) => !o && setConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete income entry?</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmId(null)} disabled={del.isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={del.isPending}>
              {del.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
