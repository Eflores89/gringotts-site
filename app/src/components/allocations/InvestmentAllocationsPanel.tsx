"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Copy, ExternalLink, PieChart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { useAllocations } from "@/hooks/use-allocations";
import {
  useCopyAllocations,
  useInvestments,
} from "@/hooks/use-investments";

export function InvestmentAllocationsPanel({
  investmentId,
  ticker,
}: {
  investmentId: string;
  ticker?: string | null;
}) {
  const { data, isLoading } = useAllocations({ investmentId });
  const inv = useInvestments();
  const copy = useCopyAllocations(investmentId);
  const [open, setOpen] = useState(false);
  const [sourceId, setSourceId] = useState<string>("");

  const rows = data?.allocations ?? [];

  // Prefer investments with the same ticker (minus the current one).
  const candidates = useMemo(() => {
    const all = (inv.data?.investments ?? []).filter(
      (i) => i.id !== investmentId,
    );
    if (!ticker) return all;
    const sameTicker = all.filter((i) => i.ticker && i.ticker === ticker);
    const rest = all.filter((i) => !i.ticker || i.ticker !== ticker);
    return [...sameTicker, ...rest];
  }, [inv.data, investmentId, ticker]);

  async function onCopy() {
    if (!sourceId) return;
    try {
      const res = await copy.mutateAsync(sourceId);
      if (res.copied === 0) {
        toast.info("No new allocations — all source links already applied.");
      } else {
        toast.success(`Copied ${res.copied} allocation link(s)`);
      }
      setOpen(false);
      setSourceId("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Copy failed");
    }
  }

  return (
    <Card className="max-w-3xl">
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="text-base">Allocations</CardTitle>
          <p className="text-sm text-muted-foreground">
            Industry, geography, and fund splits this holding belongs to.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            <Copy className="size-4" />
            Copy allocations
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/allocations">
              <ExternalLink className="size-4" />
              Manage all
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <PieChart className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No allocations link to this investment yet.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map(({ allocation }) => (
              <li
                key={allocation.id}
                className="flex items-center justify-between gap-4 py-3"
              >
                <div className="flex items-center gap-3">
                  {allocation.allocationType ? (
                    <Badge variant="outline">{allocation.allocationType}</Badge>
                  ) : null}
                  <span className="font-medium">{allocation.category ?? "—"}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm tabular-nums">
                    {allocation.percentage != null
                      ? `${allocation.percentage}%`
                      : "—"}
                  </span>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/allocations/${allocation.id}`}>Edit</Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy allocations from…</DialogTitle>
            <DialogDescription>
              Pick another holding. Every allocation linked to it will also be
              linked to this one (existing links are kept).
              {ticker ? ` Matches for ticker "${ticker}" appear first.` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Select value={sourceId} onValueChange={setSourceId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an investment…" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.ticker ? `[${i.ticker}] ` : ""}
                    {i.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={copy.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={onCopy}
              disabled={!sourceId || copy.isPending}
            >
              {copy.isPending ? "Copying…" : "Copy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
