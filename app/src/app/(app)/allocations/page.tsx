"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, PieChart } from "lucide-react";
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
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SortableHead } from "@/components/common/SortableHead";
import { PageHeader } from "@/components/common/PageHeader";
import {
  useAllocations,
  useDeleteAllocation,
  type AllocationWithLinks,
} from "@/hooks/use-allocations";
import { useInvestments } from "@/hooks/use-investments";
import { useSort } from "@/hooks/use-sort";

export default function AllocationsPage() {
  const { data, isLoading, isError, error } = useAllocations();
  const inv = useInvestments();
  const del = useDeleteAllocation();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const invById = useMemo(() => {
    const m = new Map<string, string>();
    inv.data?.investments.forEach((i) => m.set(i.id, i.ticker || i.name));
    return m;
  }, [inv.data]);

  async function confirmDelete() {
    if (!confirmId) return;
    try {
      await del.mutateAsync(confirmId);
      toast.success("Allocation deleted");
      setConfirmId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  type K = "type" | "category" | "percentage";
  const rows = data?.allocations ?? [];
  const allocAccessor = useCallback(
    (r: AllocationWithLinks, key: K): string | number =>
      key === "type"
        ? r.allocation.allocationType ?? ""
        : key === "category"
          ? r.allocation.category ?? ""
          : r.allocation.percentage ?? 0,
    [],
  );
  const { sorted, sort, toggle } = useSort<AllocationWithLinks, K>(rows, allocAccessor);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Allocations"
        description="Industry and geography breakdowns linking back to investments. An allocation can apply to multiple holdings."
        actions={
          <Button asChild size="sm">
            <Link href="/allocations/new">
              <Plus className="size-4" />
              New allocation
            </Link>
          </Button>
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
              Failed to load allocations
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <PieChart className="size-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">No allocations yet</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label="Type" sortKey="type" sort={sort} onClick={toggle} />
                <SortableHead label="Category" sortKey="category" sort={sort} onClick={toggle} />
                <SortableHead label="%" sortKey="percentage" sort={sort} onClick={toggle} className="text-right" />
                <SortableHead label="Investments" sortKey={"type" as K} sort={null} onClick={() => {}} />
                <SortableHead label="" sortKey={"type" as K} sort={null} onClick={() => {}} className="w-[110px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map(({ allocation, investmentIds }) => (
                <TableRow key={allocation.id}>
                  <TableCell>
                    {allocation.allocationType ? (
                      <Badge variant="outline">{allocation.allocationType}</Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {allocation.category ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {allocation.percentage != null
                      ? `${allocation.percentage}%`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {investmentIds.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        investmentIds.map((iid) => (
                          <Badge key={iid} variant="secondary">
                            {invById.get(iid) ?? iid.slice(0, 8)}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button asChild variant="ghost" size="icon">
                        <Link href={`/allocations/${allocation.id}`} aria-label="Edit">
                          <Pencil className="size-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setConfirmId(allocation.id)}
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
            <DialogTitle>Delete allocation?</DialogTitle>
            <DialogDescription>
              This removes the allocation and unlinks it from any investments.
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
