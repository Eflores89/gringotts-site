"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, Copy, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  useAddInvestmentAllocation,
  useCopyAllocations,
  useInvestments,
  useRemoveInvestmentAllocation,
  useUpdateInvestmentAllocation,
} from "@/hooks/use-investments";
import type { Allocation } from "@/db/schema";
import { cn } from "@/lib/utils";

type AllocType = "industry" | "geography" | "fund";

const SECTIONS: { type: AllocType; title: string; helper: string }[] = [
  {
    type: "fund",
    title: "Fund",
    helper: "Buckets like long-term, rainy day, etc.",
  },
  {
    type: "industry",
    title: "Industry",
    helper: "Sector breakdown for this holding.",
  },
  {
    type: "geography",
    title: "Geography",
    helper: "Regional breakdown for this holding.",
  },
];

export function GroupedAllocationsPanel({
  investmentId,
  ticker,
}: {
  investmentId: string;
  ticker?: string | null;
}) {
  const linked = useAllocations({ investmentId });
  const all = useAllocations();
  const inv = useInvestments();
  const copy = useCopyAllocations(investmentId);

  const [copyOpen, setCopyOpen] = useState(false);
  const [sourceId, setSourceId] = useState<string>("");

  const linkedRows = linked.data?.allocations ?? [];
  const allRows = all.data?.allocations ?? [];

  const linkedByType = useMemo(() => {
    const map = new Map<AllocType, typeof linkedRows>();
    for (const t of ["fund", "industry", "geography"] as AllocType[]) {
      map.set(t, []);
    }
    for (const row of linkedRows) {
      const t = (row.allocation.allocationType ?? "") as AllocType;
      if (t === "fund" || t === "industry" || t === "geography") {
        map.get(t)!.push(row);
      }
    }
    // Sort biggest first inside each section.
    for (const [, list] of map) {
      list.sort(
        (a, b) =>
          (b.allocation.percentage ?? 0) - (a.allocation.percentage ?? 0),
      );
    }
    return map;
  }, [linkedRows]);

  // Existing allocations not yet linked to this investment, by type.
  const availableByType = useMemo(() => {
    const linkedIds = new Set(linkedRows.map((r) => r.allocation.id));
    const map = new Map<AllocType, Allocation[]>();
    for (const t of ["fund", "industry", "geography"] as AllocType[]) {
      map.set(t, []);
    }
    for (const row of allRows) {
      if (linkedIds.has(row.allocation.id)) continue;
      const t = (row.allocation.allocationType ?? "") as AllocType;
      if (t === "fund" || t === "industry" || t === "geography") {
        map.get(t)!.push(row.allocation);
      }
    }
    return map;
  }, [allRows, linkedRows]);

  const totalLinks = useMemo(
    () =>
      new Map(allRows.map((r) => [r.allocation.id, r.investmentIds.length])),
    [allRows],
  );

  const candidates = useMemo(() => {
    const list = (inv.data?.investments ?? []).filter(
      (i) => i.id !== investmentId,
    );
    if (!ticker) return list;
    const same = list.filter((i) => i.ticker && i.ticker === ticker);
    const rest = list.filter((i) => !i.ticker || i.ticker !== ticker);
    return [...same, ...rest];
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
      setCopyOpen(false);
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
            Fund, industry, and geography splits for this holding.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setCopyOpen(true)}>
            <Copy className="size-4" />
            Copy from holding
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/allocations">Manage all</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {linked.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          SECTIONS.map(({ type, title, helper }) => (
            <Section
              key={type}
              type={type}
              title={title}
              helper={helper}
              investmentId={investmentId}
              rows={linkedByType.get(type) ?? []}
              available={availableByType.get(type) ?? []}
              totalLinks={totalLinks}
            />
          ))
        )}
      </CardContent>

      <Dialog open={copyOpen} onOpenChange={setCopyOpen}>
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
              onClick={() => setCopyOpen(false)}
              disabled={copy.isPending}
            >
              Cancel
            </Button>
            <Button onClick={onCopy} disabled={!sourceId || copy.isPending}>
              {copy.isPending ? "Copying…" : "Copy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Section({
  type,
  title,
  helper,
  investmentId,
  rows,
  available,
  totalLinks,
}: {
  type: AllocType;
  title: string;
  helper: string;
  investmentId: string;
  rows: { allocation: Allocation; investmentIds: string[] }[];
  available: Allocation[];
  totalLinks: Map<string, number>;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Allocation | null>(null);

  const total = rows.reduce(
    (sum, r) => sum + (r.allocation.percentage ?? 0),
    0,
  );
  const empty = rows.length === 0;
  const at100 = Math.abs(total - 100) < 0.01;

  return (
    <section className="rounded-lg border border-border bg-card/50">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{helper}</p>
        </div>
        <TotalBadge empty={empty} total={total} at100={at100} />
      </header>
      <ul className="divide-y divide-border">
        {rows.length === 0 ? (
          <li className="px-4 py-3 text-sm text-muted-foreground">
            No {title.toLowerCase()} splits assigned.
          </li>
        ) : (
          rows.map(({ allocation }) => (
            <li
              key={allocation.id}
              className="flex items-center justify-between gap-3 px-4 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {allocation.name ?? allocation.category ?? "Untitled"}
                </p>
                {allocation.name && allocation.category && (
                  <p className="truncate text-xs text-muted-foreground">
                    {allocation.category}
                  </p>
                )}
              </div>
              <span className="font-mono text-sm tabular-nums">
                {allocation.percentage != null
                  ? `${allocation.percentage}%`
                  : "—"}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => setEditing(allocation)}
                aria-label="Edit"
              >
                <Pencil className="size-3.5" />
              </Button>
              <UnlinkButton
                investmentId={investmentId}
                allocationId={allocation.id}
                allocationLabel={allocation.name ?? allocation.category ?? ""}
              />
            </li>
          ))
        )}
      </ul>
      <div className="border-t border-border px-4 py-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setAddOpen(true)}
          className="-mx-2"
        >
          <Plus className="size-4" />
          Add {title.toLowerCase()} split
        </Button>
      </div>

      <AddDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        type={type}
        investmentId={investmentId}
        available={available}
      />
      {editing && (
        <EditDialog
          open
          onOpenChange={(o) => !o && setEditing(null)}
          investmentId={investmentId}
          allocation={editing}
          sharedWithCount={
            (totalLinks.get(editing.id) ?? 1) - 1 // exclude self
          }
        />
      )}
    </section>
  );
}

function TotalBadge({
  empty,
  total,
  at100,
}: {
  empty: boolean;
  total: number;
  at100: boolean;
}) {
  if (empty) {
    return (
      <span className="text-xs text-muted-foreground">No splits</span>
    );
  }
  return (
    <span
      className={cn(
        "flex items-center gap-1 rounded px-2 py-0.5 font-mono text-xs tabular-nums",
        at100
          ? "bg-emerald-500/15 text-emerald-500"
          : "bg-yellow-500/15 text-yellow-500",
      )}
    >
      {at100 ? (
        <Check className="size-3" />
      ) : (
        <TriangleAlert className="size-3" />
      )}
      {total.toFixed(total % 1 === 0 ? 0 : 2)}%
    </span>
  );
}

function UnlinkButton({
  investmentId,
  allocationId,
  allocationLabel,
}: {
  investmentId: string;
  allocationId: string;
  allocationLabel: string;
}) {
  const remove = useRemoveInvestmentAllocation(investmentId);
  const [confirm, setConfirm] = useState(false);

  async function onConfirm() {
    try {
      await remove.mutateAsync(allocationId);
      toast.success("Unlinked");
      setConfirm(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unlink failed");
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground hover:text-destructive"
        onClick={() => setConfirm(true)}
        aria-label="Unlink"
      >
        <Trash2 className="size-3.5" />
      </Button>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unlink allocation?</DialogTitle>
            <DialogDescription>
              Remove the link between this holding and{" "}
              <span className="font-medium">
                {allocationLabel || "this allocation"}
              </span>
              . The allocation row stays alive in case other holdings still use
              it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirm(false)}
              disabled={remove.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={onConfirm}
              disabled={remove.isPending}
            >
              {remove.isPending ? "Unlinking…" : "Unlink"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AddDialog({
  open,
  onOpenChange,
  type,
  investmentId,
  available,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  type: AllocType;
  investmentId: string;
  available: Allocation[];
}) {
  const [mode, setMode] = useState<"existing" | "new">("new");
  const [existingId, setExistingId] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [percentage, setPercentage] = useState<number | "">("");

  const add = useAddInvestmentAllocation(investmentId);

  function reset() {
    setMode(available.length > 0 ? "existing" : "new");
    setExistingId("");
    setName("");
    setCategory("");
    setPercentage("");
  }

  async function onSubmit() {
    try {
      if (mode === "existing") {
        if (!existingId) return;
        await add.mutateAsync({ existingAllocationId: existingId });
      } else {
        if (!category || percentage === "") return;
        await add.mutateAsync({
          allocationType: type,
          name: name || null,
          category,
          percentage: Number(percentage),
        });
      }
      toast.success(`Added ${type} split`);
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Add failed");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add {type} split</DialogTitle>
          <DialogDescription>
            Pick an existing allocation row to inherit its percentage, or
            create a fresh one for this holding.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Button
            variant={mode === "existing" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("existing")}
            disabled={available.length === 0}
          >
            Pick existing
          </Button>
          <Button
            variant={mode === "new" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("new")}
          >
            Create new
          </Button>
        </div>

        {mode === "existing" ? (
          <div className="space-y-2">
            <Label>Allocation</Label>
            <Select value={existingId} onValueChange={setExistingId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an allocation…" />
              </SelectTrigger>
              <SelectContent>
                {available.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {(a.name ?? a.category ?? "Untitled")}
                    {" · "}
                    {a.category ?? "—"}
                    {" · "}
                    {a.percentage ?? 0}%
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="alloc-name">Name (optional)</Label>
              <Input
                id="alloc-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. S&P 500 Allocation"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="alloc-category">Category</Label>
                <Input
                  id="alloc-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder={
                    type === "fund"
                      ? "Long-term, Rainy day…"
                      : type === "industry"
                        ? "Tech, Finance…"
                        : "US, Europe, Asia…"
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="alloc-pct">Percentage (0–100)</Label>
                <Input
                  id="alloc-pct"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={percentage}
                  onChange={(e) => {
                    const v = e.target.valueAsNumber;
                    setPercentage(Number.isNaN(v) ? "" : v);
                  }}
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={add.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={
              add.isPending ||
              (mode === "existing" ? !existingId : !category || percentage === "")
            }
          >
            {add.isPending ? "Saving…" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({
  open,
  onOpenChange,
  investmentId,
  allocation,
  sharedWithCount,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  investmentId: string;
  allocation: Allocation;
  sharedWithCount: number;
}) {
  const update = useUpdateInvestmentAllocation(investmentId);
  const [name, setName] = useState(allocation.name ?? "");
  const [category, setCategory] = useState(allocation.category ?? "");
  const [percentage, setPercentage] = useState<number | "">(
    allocation.percentage ?? "",
  );

  async function onSubmit() {
    try {
      await update.mutateAsync({
        allocId: allocation.id,
        patch: {
          name: name === "" ? null : name,
          category: category || undefined,
          percentage: percentage === "" ? undefined : Number(percentage),
        },
      });
      toast.success(
        sharedWithCount > 0 ? "Saved as a new split for this holding" : "Saved",
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit split</DialogTitle>
          <DialogDescription>
            {sharedWithCount > 0 ? (
              <>
                Linked to{" "}
                <Badge variant="secondary" className="mx-1">
                  {sharedWithCount} other holding
                  {sharedWithCount === 1 ? "" : "s"}
                </Badge>
                . Saving creates a new allocation row just for this one — the
                others keep their original values.
              </>
            ) : (
              "Only this holding uses this allocation. Saving updates it in place."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Name (optional)</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-category">Category</Label>
              <Input
                id="edit-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-pct">Percentage</Label>
              <Input
                id="edit-pct"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={percentage}
                onChange={(e) => {
                  const v = e.target.valueAsNumber;
                  setPercentage(Number.isNaN(v) ? "" : v);
                }}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={update.isPending}
          >
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
