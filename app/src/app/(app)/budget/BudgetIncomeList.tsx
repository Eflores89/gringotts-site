"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Pencil,
  Trash2,
  TrendingUp,
} from "lucide-react";
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCategories } from "@/hooks/use-categories";
import { useCreateIncome, useDeleteIncome, useIncome } from "@/hooks/use-income";
import { formatMoney } from "@/lib/format";
import type { Income } from "@/db/schema";

const ALL = "__all__";
const MONTHS = [
  "Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec",
];

type MonthNode = {
  id: string;
  label: string;
  totalEur: number;
  items: Income[];
};

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  const i = Number(m) - 1;
  return `${MONTHS[i] ?? m} ${y}`;
}

function buildTree(rows: Income[]): MonthNode[] {
  const months = new Map<string, Income[]>();
  for (const r of rows) {
    const key = r.chargeDate.slice(0, 7);
    if (!months.has(key)) months.set(key, []);
    months.get(key)!.push(r);
  }
  const tree: MonthNode[] = [];
  for (const [key, items] of months) {
    items.sort((a, b) => a.chargeDate.localeCompare(b.chargeDate));
    tree.push({
      id: key,
      label: monthLabel(key),
      items,
      totalEur: items.reduce((s, r) => s + (r.euroMoney ?? 0), 0),
    });
  }
  tree.sort((a, b) => a.id.localeCompare(b.id));
  return tree;
}

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
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

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

  const rows = data?.income ?? [];
  const tree = useMemo(() => buildTree(rows), [rows]);
  const grandTotal = useMemo(
    () => tree.reduce((s, m) => s + m.totalEur, 0),
    [tree],
  );

  const allExpanded =
    tree.length > 0 && tree.every((m) => expandedMonths.has(m.id));

  function toggleMonth(id: string) {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function expandAll() {
    setExpandedMonths(new Set(tree.map((m) => m.id)));
  }
  function collapseAll() {
    setExpandedMonths(new Set());
  }

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

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
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
          <Button
            variant="outline"
            size="sm"
            onClick={allExpanded ? collapseAll : expandAll}
            disabled={tree.length === 0}
          >
            {allExpanded ? "Collapse all" : "Expand all"}
          </Button>
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
        ) : tree.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <TrendingUp className="size-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">No planned income yet</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[32px]" />
                <TableHead>Description</TableHead>
                <TableHead className="w-[140px]">Category</TableHead>
                <TableHead className="w-[140px]">Source</TableHead>
                <TableHead className="w-[110px] text-right">Date</TableHead>
                <TableHead className="w-[120px] text-right">Amount</TableHead>
                <TableHead className="w-[120px] text-right">EUR</TableHead>
                <TableHead className="w-[140px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="border-b-2 border-border bg-muted/30 font-semibold">
                <TableCell />
                <TableCell>Total</TableCell>
                <TableCell />
                <TableCell />
                <TableCell />
                <TableCell />
                <TableCell className="text-right font-mono">
                  {formatMoney(grandTotal, "EUR")}
                </TableCell>
                <TableCell />
              </TableRow>
              {tree.map((m) => {
                const isOpen = expandedMonths.has(m.id);
                return (
                  <MonthRows
                    key={m.id}
                    month={m}
                    isOpen={isOpen}
                    catById={catById}
                    onToggle={toggleMonth}
                    onDelete={setConfirmId}
                    onDuplicate={duplicate}
                    duplicatingId={duplicatingId}
                  />
                );
              })}
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

function MonthRows({
  month,
  isOpen,
  catById,
  onToggle,
  onDelete,
  onDuplicate,
  duplicatingId,
}: {
  month: MonthNode;
  isOpen: boolean;
  catById: Map<string, string>;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (r: Income) => void;
  duplicatingId: string | null;
}) {
  return (
    <>
      <TableRow
        className="cursor-pointer bg-muted/40 font-semibold hover:bg-muted/60"
        onClick={() => onToggle(month.id)}
      >
        <TableCell className="w-[32px]">
          {isOpen ? (
            <ChevronDown className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell className="font-semibold uppercase tracking-wide">
          {month.label}
        </TableCell>
        <TableCell />
        <TableCell />
        <TableCell />
        <TableCell />
        <TableCell className="text-right font-mono">
          {formatMoney(month.totalEur, "EUR")}
        </TableCell>
        <TableCell />
      </TableRow>
      {isOpen &&
        month.items.map((r) => (
          <TableRow key={r.id} className="text-sm">
            <TableCell className="w-[32px]" />
            <TableCell className="pl-6">{r.description ?? "—"}</TableCell>
            <TableCell className="text-muted-foreground">
              {r.categoryId ? catById.get(r.categoryId) ?? "—" : "—"}
            </TableCell>
            <TableCell className="text-muted-foreground">{r.source ?? "—"}</TableCell>
            <TableCell className="text-right font-mono text-muted-foreground">
              {r.chargeDate}
            </TableCell>
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
                  onClick={() => onDuplicate(r)}
                  disabled={duplicatingId === r.id}
                  aria-label="Duplicate"
                >
                  <Copy className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(r.id)}
                  aria-label="Delete"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
    </>
  );
}
