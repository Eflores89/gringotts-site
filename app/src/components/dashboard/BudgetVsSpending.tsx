"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api-client";
import { formatMoney } from "@/lib/format";
import type {
  BudgetVsSpendRow,
  CategoryDrillDown,
} from "@/lib/db/repos/budget-vs-spending";
import { ChevronDown, ChevronRight, Pencil } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ALL = "__all__";
const UNGROUPED = "(ungrouped)";
const MONTHS = [
  "Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec",
];

type Aggregate = {
  budgetEur: number;
  spendingEur: number;
  diff: number;
  pctUsed: number | null;
};

type CategoryNode = Aggregate & {
  kind: "category";
  id: string;
  name: string;
};

type GroupNode = Aggregate & {
  kind: "group";
  id: string;
  name: string;
  categories: CategoryNode[];
};

type LifegroupNode = Aggregate & {
  kind: "lifegroup";
  id: string;
  name: string;
  groups: GroupNode[];
};

function aggregate(rows: { budgetEur: number; spendingEur: number }[]): Aggregate {
  const budgetEur = rows.reduce((s, r) => s + r.budgetEur, 0);
  const spendingEur = rows.reduce((s, r) => s + r.spendingEur, 0);
  return {
    budgetEur,
    spendingEur,
    diff: budgetEur - spendingEur,
    pctUsed: budgetEur > 0 ? (spendingEur / budgetEur) * 100 : null,
  };
}

function buildTree(rows: BudgetVsSpendRow[]): LifegroupNode[] {
  const byLifegroup = new Map<string, Map<string, CategoryNode[]>>();
  for (const r of rows) {
    if (r.budgetEur === 0 && r.spendingEur === 0) continue;
    const lg = r.spendLifegrp?.trim() || UNGROUPED;
    const g = r.spendGrp?.trim() || UNGROUPED;
    if (!byLifegroup.has(lg)) byLifegroup.set(lg, new Map());
    const groupsMap = byLifegroup.get(lg)!;
    if (!groupsMap.has(g)) groupsMap.set(g, []);
    groupsMap.get(g)!.push({
      kind: "category",
      id: r.categoryId,
      name: r.categoryName,
      budgetEur: r.budgetEur,
      spendingEur: r.spendingEur,
      diff: r.diff,
      pctUsed: r.pctUsed,
    });
  }

  const lifegroups: LifegroupNode[] = [];
  for (const [lgName, groupsMap] of byLifegroup) {
    const groups: GroupNode[] = [];
    for (const [gName, cats] of groupsMap) {
      cats.sort((a, b) => a.name.localeCompare(b.name));
      groups.push({
        kind: "group",
        id: `${lgName}::${gName}`,
        name: gName,
        categories: cats,
        ...aggregate(cats),
      });
    }
    groups.sort((a, b) => b.budgetEur - a.budgetEur);
    lifegroups.push({
      kind: "lifegroup",
      id: lgName,
      name: lgName,
      groups,
      ...aggregate(groups),
    });
  }
  lifegroups.sort((a, b) => b.budgetEur - a.budgetEur);
  return lifegroups;
}

export function BudgetVsSpending({ year: initialYear }: { year: number }) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState<number | undefined>(undefined);
  const [expandedLifegroups, setExpandedLifegroups] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["budget-vs-spending", year, month],
    queryFn: () => {
      const p = new URLSearchParams({ year: String(year) });
      if (month) p.set("month", String(month));
      return apiFetch<{ rows: BudgetVsSpendRow[] }>(
        `/api/dashboard/budget-vs-spending?${p}`,
      );
    },
  });

  const rows = data?.rows ?? [];
  const tree = useMemo(() => buildTree(rows), [rows]);

  const totals = useMemo(() => aggregate(tree), [tree]);

  const allExpanded =
    tree.length > 0 &&
    tree.every((lg) => expandedLifegroups.has(lg.id)) &&
    tree.every((lg) => lg.groups.every((g) => expandedGroups.has(g.id)));

  function toggleLifegroup(id: string) {
    setExpandedLifegroups((prev) => {
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
    setExpandedLifegroups(new Set(tree.map((lg) => lg.id)));
    setExpandedGroups(new Set(tree.flatMap((lg) => lg.groups.map((g) => g.id))));
  }
  function collapseAll() {
    setExpandedLifegroups(new Set());
    setExpandedGroups(new Set());
    setExpandedCategoryId(null);
  }

  const years = [];
  for (let y = initialYear - 3; y <= initialYear + 1; y++) years.push(y);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">Year</label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
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
              value={month ? String(month) : ALL}
              onValueChange={(v) => setMonth(v === ALL ? undefined : Number(v))}
            >
              <SelectTrigger className="w-[110px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All</SelectItem>
                {MONTHS.map((m, i) => (
                  <SelectItem key={i} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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

      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : tree.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No data for this period.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[32px]" />
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Budget</TableHead>
                <TableHead className="text-right">Spending</TableHead>
                <TableHead className="text-right">Diff</TableHead>
                <TableHead className="text-right">%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tree.map((lg) => (
                <LifegroupRows
                  key={lg.id}
                  lifegroup={lg}
                  expandedLifegroups={expandedLifegroups}
                  expandedGroups={expandedGroups}
                  expandedCategoryId={expandedCategoryId}
                  onToggleLifegroup={toggleLifegroup}
                  onToggleGroup={toggleGroup}
                  onToggleCategory={(id) =>
                    setExpandedCategoryId((prev) => (prev === id ? null : id))
                  }
                  year={year}
                  month={month}
                />
              ))}
              <TableRow className="border-t-2 border-border font-semibold">
                <TableCell />
                <TableCell>Total</TableCell>
                <TableCell className="text-right font-mono">
                  {formatMoney(totals.budgetEur, "EUR")}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatMoney(totals.spendingEur, "EUR")}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-mono",
                    totals.diff >= 0 ? "text-emerald-500" : "text-destructive",
                  )}
                >
                  {formatMoney(totals.diff, "EUR")}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {totals.pctUsed != null
                    ? `${totals.pctUsed.toFixed(0)}%`
                    : "—"}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function pctColor(pct: number | null) {
  if (pct == null) return "";
  if (pct <= 80) return "text-emerald-500";
  if (pct <= 100) return "text-yellow-500";
  return "text-destructive";
}

function LifegroupRows({
  lifegroup,
  expandedLifegroups,
  expandedGroups,
  expandedCategoryId,
  onToggleLifegroup,
  onToggleGroup,
  onToggleCategory,
  year,
  month,
}: {
  lifegroup: LifegroupNode;
  expandedLifegroups: Set<string>;
  expandedGroups: Set<string>;
  expandedCategoryId: string | null;
  onToggleLifegroup: (id: string) => void;
  onToggleGroup: (id: string) => void;
  onToggleCategory: (id: string) => void;
  year: number;
  month?: number;
}) {
  const isOpen = expandedLifegroups.has(lifegroup.id);
  return (
    <>
      <TableRow
        className="cursor-pointer bg-muted/40 font-semibold hover:bg-muted/60"
        onClick={() => onToggleLifegroup(lifegroup.id)}
      >
        <TableCell className="w-[32px]">
          {isOpen ? (
            <ChevronDown className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell className="font-semibold uppercase tracking-wide">
          {lifegroup.name}
        </TableCell>
        <TableCell className="text-right font-mono">
          {formatMoney(lifegroup.budgetEur, "EUR")}
        </TableCell>
        <TableCell className="text-right font-mono">
          {formatMoney(lifegroup.spendingEur, "EUR")}
        </TableCell>
        <TableCell
          className={cn(
            "text-right font-mono",
            lifegroup.diff >= 0 ? "text-emerald-500" : "text-destructive",
          )}
        >
          {formatMoney(lifegroup.diff, "EUR")}
        </TableCell>
        <TableCell className={cn("text-right font-mono", pctColor(lifegroup.pctUsed))}>
          {lifegroup.pctUsed != null ? `${lifegroup.pctUsed.toFixed(0)}%` : "—"}
        </TableCell>
      </TableRow>
      {isOpen &&
        lifegroup.groups.map((g) => (
          <GroupRows
            key={g.id}
            group={g}
            expanded={expandedGroups.has(g.id)}
            expandedCategoryId={expandedCategoryId}
            onToggleGroup={onToggleGroup}
            onToggleCategory={onToggleCategory}
            year={year}
            month={month}
          />
        ))}
    </>
  );
}

function GroupRows({
  group,
  expanded,
  expandedCategoryId,
  onToggleGroup,
  onToggleCategory,
  year,
  month,
}: {
  group: GroupNode;
  expanded: boolean;
  expandedCategoryId: string | null;
  onToggleGroup: (id: string) => void;
  onToggleCategory: (id: string) => void;
  year: number;
  month?: number;
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
        <TableCell className="text-right font-mono">
          {formatMoney(group.budgetEur, "EUR")}
        </TableCell>
        <TableCell className="text-right font-mono">
          {formatMoney(group.spendingEur, "EUR")}
        </TableCell>
        <TableCell
          className={cn(
            "text-right font-mono",
            group.diff >= 0 ? "text-emerald-500" : "text-destructive",
          )}
        >
          {formatMoney(group.diff, "EUR")}
        </TableCell>
        <TableCell className={cn("text-right font-mono", pctColor(group.pctUsed))}>
          {group.pctUsed != null ? `${group.pctUsed.toFixed(0)}%` : "—"}
        </TableCell>
      </TableRow>
      {expanded &&
        group.categories.map((c) => (
          <CategoryRows
            key={c.id}
            category={c}
            expanded={expandedCategoryId === c.id}
            onToggle={() => onToggleCategory(c.id)}
            year={year}
            month={month}
          />
        ))}
    </>
  );
}

function CategoryRows({
  category,
  expanded,
  onToggle,
  year,
  month,
}: {
  category: CategoryNode;
  expanded: boolean;
  onToggle: () => void;
  year: number;
  month?: number;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["drilldown", category.id, year, month],
    queryFn: () => {
      const p = new URLSearchParams({
        categoryId: category.id,
        year: String(year),
      });
      if (month) p.set("month", String(month));
      return apiFetch<CategoryDrillDown>(`/api/dashboard/drilldown?${p}`);
    },
    enabled: expanded,
  });

  return (
    <>
      <TableRow className="cursor-pointer hover:bg-accent/30" onClick={onToggle}>
        <TableCell className="w-[32px]" />
        <TableCell className="pl-12 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            {expanded ? (
              <ChevronDown className="size-3 text-muted-foreground/70" />
            ) : (
              <ChevronRight className="size-3 text-muted-foreground/70" />
            )}
            {category.name}
          </span>
        </TableCell>
        <TableCell className="text-right font-mono text-sm">
          {formatMoney(category.budgetEur, "EUR")}
        </TableCell>
        <TableCell className="text-right font-mono text-sm">
          {formatMoney(category.spendingEur, "EUR")}
        </TableCell>
        <TableCell
          className={cn(
            "text-right font-mono text-sm",
            category.diff >= 0 ? "text-emerald-500" : "text-destructive",
          )}
        >
          {formatMoney(category.diff, "EUR")}
        </TableCell>
        <TableCell
          className={cn("text-right font-mono text-sm", pctColor(category.pctUsed))}
        >
          {category.pctUsed != null ? `${category.pctUsed.toFixed(0)}%` : "—"}
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={6} className="bg-muted/30 p-0">
            {isLoading ? (
              <div className="space-y-2 p-4">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
            ) : (data?.items.length ?? 0) === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">
                No line items.
              </div>
            ) : (
              <Table>
                <TableBody>
                  {data!.items.map((item) => {
                    const editHref =
                      item.kind === "spending"
                        ? `/spending/${item.id}`
                        : `/budget/${item.id}`;
                    return (
                      <TableRow key={item.id} className="text-sm">
                        <TableCell className="w-[32px]" />
                        <TableCell className="pl-12">
                          <Badge
                            variant={
                              item.kind === "budget" ? "outline" : "secondary"
                            }
                            className="mr-2"
                          >
                            {item.kind}
                          </Badge>
                          {item.transaction ?? "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {item.chargeDate}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatMoney(item.amount, item.currency)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatMoney(item.euroMoney, "EUR")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="ghost" size="icon">
                            <Link href={editHref} aria-label="Edit">
                              <Pencil className="size-3.5" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
