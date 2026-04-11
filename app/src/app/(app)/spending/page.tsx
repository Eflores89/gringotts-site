"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { PageHeader } from "@/components/common/PageHeader";
import { useCategories } from "@/hooks/use-categories";
import {
  useDeleteSpending,
  useSpending,
  type SpendingFilter,
} from "@/hooks/use-spending";
import { formatMoney } from "@/lib/format";

const ALL = "__all__";
const MONTHS = [
  { n: 1, label: "Jan" },
  { n: 2, label: "Feb" },
  { n: 3, label: "Mar" },
  { n: 4, label: "Apr" },
  { n: 5, label: "May" },
  { n: 6, label: "Jun" },
  { n: 7, label: "Jul" },
  { n: 8, label: "Aug" },
  { n: 9, label: "Sep" },
  { n: 10, label: "Oct" },
  { n: 11, label: "Nov" },
  { n: 12, label: "Dec" },
];

export default function SpendingPage() {
  const [filter, setFilter] = useState<SpendingFilter>({});
  const { data, isLoading, isError, error } = useSpending(filter);
  const cats = useCategories();
  const del = useDeleteSpending();
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
      toast.success("Entry deleted");
      setConfirmId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  const rows = data?.spending ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Spending"
        description="Confirmed expenses, filterable by month, year, and category."
        actions={
          <Button asChild size="sm">
            <Link href="/spending/new">
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
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All</SelectItem>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
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
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All</SelectItem>
                {MONTHS.map((m) => (
                  <SelectItem key={m.n} value={String(m.n)}>
                    {m.label}
                  </SelectItem>
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
              <SelectTrigger className="w-[240px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All categories</SelectItem>
                {(cats.data?.categories ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(filter.year || filter.month || filter.categoryId) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilter({})}
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
              Failed to load spending
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Receipt className="size-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">No spending entries</p>
            <p className="text-sm text-muted-foreground">
              Create one or run an import to get started.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[110px]">Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">EUR</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="w-[110px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="text-muted-foreground">
                    {s.chargeDate}
                  </TableCell>
                  <TableCell className="font-medium">
                    {s.transaction ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {catById.get(s.categoryId) ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatMoney(s.amount, s.currency)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatMoney(s.euroMoney, "EUR")}
                  </TableCell>
                  <TableCell>
                    {s.method ? <Badge variant="outline">{s.method}</Badge> : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button asChild variant="ghost" size="icon">
                        <Link href={`/spending/${s.id}`} aria-label="Edit">
                          <Pencil className="size-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setConfirmId(s.id)}
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
            <DialogTitle>Delete entry?</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirmId(null)}
              disabled={del.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={del.isPending}
            >
              {del.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
