"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Pencil, Trash2, Target } from "lucide-react";
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
import {
  useBudget,
  useDeleteBudget,
  type BudgetFilter,
} from "@/hooks/use-budget";
import { formatMoney } from "@/lib/format";
import type { Budget, Category } from "@/db/schema";
import { cn } from "@/lib/utils";

const ALL = "__all__";
const UNGROUPED = "(ungrouped)";
const MONTHS = [
  "Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec",
];

type ItemNode = { kind: "item"; entry: Budget; totalEur: number };
type GroupNode = {
  kind: "group";
  id: string;
  name: string;
  totalEur: number;
  items: ItemNode[];
};
type MonthNode = {
  kind: "month";
  id: string;
  label: string;
  totalEur: number;
  groups: GroupNode[];
};

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  const i = Number(m) - 1;
  return `${MONTHS[i] ?? m} ${y}`;
}

function buildTree(rows: Budget[], catById: Map<string, Category>): MonthNode[] {
  const months = new Map<string, Map<string, ItemNode[]>>();
  for (const b of rows) {
    const monthKey = b.chargeDate.slice(0, 7);
    const grp = catById.get(b.categoryId)?.spendGrp?.trim() || UNGROUPED;
    if (!months.has(monthKey)) months.set(monthKey, new Map());
    const groups = months.get(monthKey)!;
    if (!groups.has(grp)) groups.set(grp, []);
    groups.get(grp)!.push({
      kind: "item",
      entry: b,
      totalEur: b.euroMoney ?? 0,
    });
  }

  const tree: MonthNode[] = [];
  for (const [monthKey, groupsMap] of months) {
    const groups: GroupNode[] = [];
    for (const [gName, items] of groupsMap) {
      items.sort((a, b) => a.entry.chargeDate.localeCompare(b.entry.chargeDate));
      groups.push({
        kind: "group",
        id: `${monthKey}::${gName}`,
        name: gName,
        items,
        totalEur: items.reduce((s, x) => s + x.totalEur, 0),
      });
    }
    groups.sort((a, b) => b.totalEur - a.totalEur);
    tree.push({
      kind: "month",
      id: monthKey,
      label: monthLabel(monthKey),
      groups,
      totalEur: groups.reduce((s, g) => s + g.totalEur, 0),
    });
  }
  tree.sort((a, b) => a.id.localeCompare(b.id));
  return tree;
}

export function BudgetSpendList() {
  const [filter, setFilter] = useState<BudgetFilter>({});
  const { data, isLoading, isError, error } = useBudget(filter);
  const cats = useCategories({ kind: "spend" });
  const del = useDeleteBudget();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const catById = useMemo(() => {
    const m = new Map<string, Category>();
    cats.data?.categories.forEach((c) => m.set(c.id, c));
    return m;
  }, [cats.data]);

  const years = useMemo(() => {
    const set = new Set<number>();
    const now = new Date().getFullYear();
    for (let y = now - 3; y <= now + 1; y++) set.add(y);
    return Array.from(set).sort((a, b) => b - a);
  }, []);

  const rows = data?.budget ?? [];
  const tree = useMemo(() => buildTree(rows, catById), [rows, catById]);
  const grandTotal = useMemo(
    () => tree.reduce((s, m) => s + m.totalEur, 0),
    [tree],
  );

  const allExpanded =
    tree.length > 0 &&
    tree.every((m) => expandedMonths.has(m.id)) &&
    tree.every((m) => m.groups.every((g) => expandedGroups.has(g.id)));

  function toggleMonth(id: string) {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleGroup(id: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function expandAll() {
    setExpandedMonths(new Set(tree.map((m) => m.id)));
    setExpandedGroups(new Set(tree.flatMap((m) => m.groups.map((g) => g.id))));
  }
  function collapseAll() {
    setExpandedMonths(new Set());
    setExpandedGroups(new Set());
  }

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

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
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
            <p className="text-sm font-medium text-destructive">Failed to load budget</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </div>
        ) : tree.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Target className="size-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">No budget entries</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[32px]" />
                <TableHead>Description</TableHead>
                <TableHead className="w-[120px]">Category</TableHead>
                <TableHead className="w-[110px] text-right">Date</TableHead>
                <TableHead className="w-[120px] text-right">Amount</TableHead>
                <TableHead className="w-[120px] text-right">EUR</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="border-b-2 border-border bg-muted/30 font-semibold">
                <TableCell />
                <TableCell>Total</TableCell>
                <TableCell />
                <TableCell />
                <TableCell />
                <TableCell className="text-right font-mono">
                  {formatMoney(grandTotal, "EUR")}
                </TableCell>
                <TableCell />
              </TableRow>
              {tree.map((m) => (
                <MonthRows
                  key={m.id}
                  month={m}
                  catById={catById}
                  expandedMonths={expandedMonths}
                  expandedGroups={expandedGroups}
                  onToggleMonth={toggleMonth}
                  onToggleGroup={toggleGroup}
                  onDelete={setConfirmId}
                />
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

function MonthRows({
  month,
  catById,
  expandedMonths,
  expandedGroups,
  onToggleMonth,
  onToggleGroup,
  onDelete,
}: {
  month: MonthNode;
  catById: Map<string, Category>;
  expandedMonths: Set<string>;
  expandedGroups: Set<string>;
  onToggleMonth: (id: string) => void;
  onToggleGroup: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const isOpen = expandedMonths.has(month.id);
  return (
    <>
      <TableRow
        className="cursor-pointer bg-muted/40 font-semibold hover:bg-muted/60"
        onClick={() => onToggleMonth(month.id)}
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
        <TableCell className="text-right font-mono">
          {formatMoney(month.totalEur, "EUR")}
        </TableCell>
        <TableCell />
      </TableRow>
      {isOpen &&
        month.groups.map((g) => (
          <GroupRows
            key={g.id}
            group={g}
            catById={catById}
            expanded={expandedGroups.has(g.id)}
            onToggleGroup={onToggleGroup}
            onDelete={onDelete}
          />
        ))}
    </>
  );
}

function GroupRows({
  group,
  catById,
  expanded,
  onToggleGroup,
  onDelete,
}: {
  group: GroupNode;
  catById: Map<string, Category>;
  expanded: boolean;
  onToggleGroup: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-accent/40"
        onClick={() => onToggleGroup(group.id)}
      >
        <TableCell className="w-[32px]" />
        <TableCell className="pl-6 font-medium">
          <span className="inline-flex items-center gap-1.5">
            {expanded ? (
              <ChevronDown className="size-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="size-3.5 text-muted-foreground" />
            )}
            {group.name}
          </span>
        </TableCell>
        <TableCell />
        <TableCell />
        <TableCell />
        <TableCell className="text-right font-mono">
          {formatMoney(group.totalEur, "EUR")}
        </TableCell>
        <TableCell />
      </TableRow>
      {expanded &&
        group.items.map((it) => {
          const b = it.entry;
          const catName = catById.get(b.categoryId)?.name ?? "—";
          return (
            <TableRow key={b.id} className="text-sm">
              <TableCell className="w-[32px]" />
              <TableCell className="pl-12">{b.transaction ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">{catName}</TableCell>
              <TableCell className="text-right font-mono text-muted-foreground">
                {b.chargeDate}
              </TableCell>
              <TableCell className="text-right font-mono">
                {formatMoney(b.amount, b.currency)}
              </TableCell>
              <TableCell className={cn("text-right font-mono")}>
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
                    onClick={() => onDelete(b.id)}
                    aria-label="Delete"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
    </>
  );
}
