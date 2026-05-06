"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, TrendingUp } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SortableHead } from "@/components/common/SortableHead";
import { useSort } from "@/hooks/use-sort";
import {
  useDeleteInvestment,
  useInvestments,
  type InvestmentListRow,
} from "@/hooks/use-investments";
import { formatAmount, formatMoney } from "@/lib/format";

type SortKey =
  | "name"
  | "ticker"
  | "type"
  | "quantity"
  | "cost"
  | "current"
  | "value"
  | "date"
  | "allocations";

function rowValue(inv: InvestmentListRow): number | null {
  return inv.quantity != null && inv.currentPrice != null
    ? inv.quantity * inv.currentPrice
    : null;
}

export function InvestmentsList() {
  const { data, isLoading, isError, error } = useInvestments();
  const del = useDeleteInvestment();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const accessor = useCallback(
    (inv: InvestmentListRow, key: SortKey): string | number | null => {
      switch (key) {
        case "name":
          return inv.name.toLowerCase();
        case "ticker":
          return inv.ticker?.toLowerCase() ?? "";
        case "type":
          return inv.assetType?.toLowerCase() ?? "";
        case "quantity":
          return inv.quantity ?? 0;
        case "cost":
          return inv.purchasePrice ?? 0;
        case "current":
          return inv.currentPrice ?? 0;
        case "value":
          return rowValue(inv) ?? 0;
        case "date":
          return inv.purchaseDate ?? "";
        case "allocations":
          return inv.allocationCount;
      }
    },
    [],
  );

  async function confirmDelete() {
    if (!confirmId) return;
    try {
      await del.mutateAsync(confirmId);
      toast.success("Investment deleted");
      setConfirmId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  const rows = data?.investments ?? [];
  const { sorted, sort, toggle } = useSort<InvestmentListRow, SortKey>(
    rows,
    accessor,
  );

  return (
    <>
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
              Failed to load investments
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <TrendingUp className="size-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">No investments yet</p>
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead label="Name" sortKey="name" sort={sort} onClick={toggle} />
                    <SortableHead label="Ticker" sortKey="ticker" sort={sort} onClick={toggle} />
                    <SortableHead label="Type" sortKey="type" sort={sort} onClick={toggle} />
                    <SortableHead label="Date" sortKey="date" sort={sort} onClick={toggle} />
                    <SortableHead label="Allocations" sortKey="allocations" sort={sort} onClick={toggle} />
                    <SortableHead label="Quantity" sortKey="quantity" sort={sort} onClick={toggle} className="text-right" />
                    <SortableHead label="Cost" sortKey="cost" sort={sort} onClick={toggle} className="text-right" />
                    <SortableHead label="Current" sortKey="current" sort={sort} onClick={toggle} className="text-right" />
                    <SortableHead label="Value" sortKey="value" sort={sort} onClick={toggle} className="text-right" />
                    <TableHead className="w-[110px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((inv) => {
                    const value = rowValue(inv);
                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">{inv.name}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {inv.ticker ?? "—"}
                        </TableCell>
                        <TableCell>
                          {inv.assetType ? (
                            <Badge variant="outline">{inv.assetType}</Badge>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {inv.purchaseDate ?? "—"}
                        </TableCell>
                        <TableCell>
                          <AllocationPill count={inv.allocationCount} />
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatAmount(inv.quantity)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatMoney(inv.purchasePrice, inv.currency)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatMoney(inv.currentPrice, inv.currency)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatMoney(value, inv.currency)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button asChild variant="ghost" size="icon">
                              <Link
                                href={`/investments/${inv.id}`}
                                aria-label="Edit"
                              >
                                <Pencil className="size-4" />
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setConfirmId(inv.id)}
                              aria-label="Delete"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <ul className="divide-y divide-border md:hidden">
              {sorted.map((inv) => {
                const value = rowValue(inv);
                return (
                  <li key={inv.id}>
                    <Link
                      href={`/investments/${inv.id}`}
                      className="block px-4 py-3 active:bg-accent/50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {inv.name}
                          </p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {inv.ticker ?? "—"}
                            {inv.purchaseDate && <> · {inv.purchaseDate}</>}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <p className="font-mono text-sm font-semibold">
                            {formatMoney(value, inv.currency)}
                          </p>
                          <div className="flex items-center gap-1">
                            {inv.assetType && (
                              <Badge variant="outline" className="text-[10px]">
                                {inv.assetType}
                              </Badge>
                            )}
                            <AllocationPill count={inv.allocationCount} />
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 flex items-end justify-between gap-3">
                        <p className="font-mono text-xs text-muted-foreground">
                          {formatAmount(inv.quantity)}
                          {" × "}
                          {formatMoney(inv.currentPrice, inv.currency)}
                          {inv.purchasePrice != null && (
                            <>
                              {" · cost "}
                              {formatMoney(inv.purchasePrice, inv.currency)}
                            </>
                          )}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="-mr-2 -my-1 size-8"
                          aria-label="Delete"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setConfirmId(inv.id);
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>

      <Dialog
        open={confirmId !== null}
        onOpenChange={(o) => !o && setConfirmId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete investment?</DialogTitle>
            <DialogDescription>
              Allocations linked exclusively to this holding will be cascaded.
              Allocations that also apply to other holdings stay.
            </DialogDescription>
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
    </>
  );
}

function AllocationPill({ count }: { count: number }) {
  if (count === 0) {
    return (
      <Badge variant="destructive" className="text-[10px]">
        None
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-[10px]">
      {count}
    </Badge>
  );
}
