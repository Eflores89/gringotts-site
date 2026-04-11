"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, TrendingUp, RefreshCw } from "lucide-react";
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
import { PageHeader } from "@/components/common/PageHeader";
import {
  useDeleteInvestment,
  useInvestments,
  useRefreshPrices,
} from "@/hooks/use-investments";
import { formatAmount, formatMoney } from "@/lib/format";

export default function InvestmentsPage() {
  const { data, isLoading, isError, error } = useInvestments();
  const del = useDeleteInvestment();
  const refresh = useRefreshPrices();
  const [confirmId, setConfirmId] = useState<string | null>(null);

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

  async function onRefresh() {
    try {
      const res = await refresh.mutateAsync();
      toast.success(
        `Prices: ${res.updated} updated, ${res.skipped} skipped, ${res.failed} failed`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Refresh failed");
    }
  }

  const rows = data?.investments ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Investments"
        description="Holdings, current prices, and basic metadata."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={refresh.isPending}
            >
              <RefreshCw
                className={`size-4 ${refresh.isPending ? "animate-spin" : ""}`}
              />
              Refresh prices
            </Button>
            <Button asChild size="sm">
              <Link href="/investments/new">
                <Plus className="size-4" />
                New holding
              </Link>
            </Button>
          </>
        }
      />

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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Ticker</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Current</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="w-[110px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((inv) => {
                const value =
                  inv.quantity != null && inv.currentPrice != null
                    ? inv.quantity * inv.currentPrice
                    : null;
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
        )}
      </Card>

      <Dialog open={confirmId !== null} onOpenChange={(o) => !o && setConfirmId(null)}>
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
    </div>
  );
}
