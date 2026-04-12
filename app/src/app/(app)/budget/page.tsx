"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Target } from "lucide-react";
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
import { PageHeader } from "@/components/common/PageHeader";
import { useCategories } from "@/hooks/use-categories";
import {
  useBudget,
  useDeleteBudget,
  type BudgetFilter,
} from "@/hooks/use-budget";
import { useSort } from "@/hooks/use-sort";
import { formatMoney } from "@/lib/format";
import type { Budget } from "@/db/schema";

const ALL = "__all__";
const MONTHS = [
  "Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec",
];

export default function BudgetPage() {
  const [filter, setFilter] = useState<BudgetFilter>({});
  const { data, isLoading, isError, error } = useBudget(filter);
  const cats = useCategories();
  const del = useDeleteBudget();
  const [confirmId, setConfirmId] = useState<string | null>(null);

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
      toast.success("Budget entry deleted");
      setConfirmId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  type K = "date" | "description" | "category" | "amount" | "eur";
  const rows = data?.budget ?? [];
  const budgetAccessor = useCallback(
    (b: Budget, key: K): string | number =>
      key === "date"
        ? b.chargeDate
        : key === "description"
          ? b.transaction ?? ""
          : key === "category"
            ? catById.get(b.categoryId) ?? ""
            : key === "amount"
              ? b.amount
              : (b.euroMoney ?? 0),
    [catById],
  );
  const { sorted, sort, toggle } = useSort<Budget, K>(rows, budgetAccessor);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Budget"
        description="Planned amounts by category and month."
        actions={
          <Button asChild size="sm">
            <Link href="/budget/new">
              <Plus className="size-4" />
              New entry
            </Link>
          </Button>
        }
      />

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">Year</label>
            <Select
              value={filter.year ? String(filter.year) : ALL}
              onValueChange={(v) =>
                setFilter((f) => ({ ...f, year: v === ALL ? undefined : Number(v) }))
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
              value={filter.month ? String(filter.month) : ALL}
              onValueChange={(v) =>
                setFilter((f) => ({ ...f, month: v === ALL ? undefined : Number(v) }))
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
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">Category</label>
            <Select
              value={filter.categoryId ?? ALL}
              onValueChange={(v) =>
                setFilter((f) => ({ ...f, categoryId: v === ALL ? undefined : v }))
              }
            >
              <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All categories</SelectItem>
                {(cats.data?.categories ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(filter.year || filter.month || filter.categoryId) && (
            <Button variant="ghost" size="sm" onClick={() => setFilter({})}>
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
            <p className="text-sm font-medium text-destructive">Failed to load budget</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Target className="size-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">No budget entries</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label="Date" sortKey="date" sort={sort} onClick={toggle} className="w-[110px]" />
                <SortableHead label="Description" sortKey="description" sort={sort} onClick={toggle} />
                <SortableHead label="Category" sortKey="category" sort={sort} onClick={toggle} />
                <SortableHead label="Amount" sortKey="amount" sort={sort} onClick={toggle} className="text-right" />
                <SortableHead label="EUR" sortKey="eur" sort={sort} onClick={toggle} className="text-right" />
                <SortableHead label="" sortKey={"date" as K} sort={null} onClick={() => {}} className="w-[110px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="text-muted-foreground">{b.chargeDate}</TableCell>
                  <TableCell className="font-medium">{b.transaction ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {catById.get(b.categoryId) ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatMoney(b.amount, b.currency)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatMoney(b.euroMoney, "EUR")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button asChild variant="ghost" size="icon">
                        <Link href={`/budget/${b.id}`} aria-label="Edit">
                          <Pencil className="size-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setConfirmId(b.id)}
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
            <DialogTitle>Delete budget entry?</DialogTitle>
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
