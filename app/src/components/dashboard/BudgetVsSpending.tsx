"use client";

import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SortableHead } from "@/components/common/SortableHead";
import { useSort } from "@/hooks/use-sort";
import { apiFetch } from "@/lib/api-client";
import { formatMoney } from "@/lib/format";
import type { BudgetVsSpendRow, CategoryDrillDown } from "@/lib/db/repos/budget-vs-spending";
import { ChevronDown, ChevronRight, Pencil } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const ALL = "__all__";
const MONTHS = [
  "Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec",
];
const eur = (v: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v);

const TOOLTIP_STYLE = {
  background: "#2a2a2a",
  border: "1px solid #3a3a3a",
  borderRadius: 8,
  fontSize: 12,
  color: "#e5e5e5",
};

type K = "category" | "budget" | "spending" | "diff" | "pct";

export function BudgetVsSpending({ year: initialYear }: { year: number }) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState<number | undefined>(undefined);
  const [expanded, setExpanded] = useState<string | null>(null);

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
  const acc = useCallback(
    (r: BudgetVsSpendRow, key: K): string | number =>
      key === "category"
        ? r.categoryName
        : key === "budget"
          ? r.budgetEur
          : key === "spending"
            ? r.spendingEur
            : key === "diff"
              ? r.diff
              : r.pctUsed ?? 0,
    [],
  );
  const { sorted, sort, toggle } = useSort<BudgetVsSpendRow, K>(rows, acc);

  const chartData = rows
    .filter((r) => r.budgetEur > 0 || r.spendingEur > 0)
    .sort((a, b) => b.budgetEur - a.budgetEur)
    .slice(0, 15)
    .map((r) => ({
      name: r.categoryName.length > 18
        ? r.categoryName.slice(0, 16) + "…"
        : r.categoryName,
      Budget: Math.round(r.budgetEur),
      Spending: Math.round(r.spendingEur),
    }));

  const years = [];
  for (let y = initialYear - 3; y <= initialYear + 1; y++) years.push(y);

  const totalBudget = rows.reduce((s, r) => s + r.budgetEur, 0);
  const totalSpending = rows.reduce((s, r) => s + r.spendingEur, 0);

  return (
    <div className="space-y-4">
      {/* Filters */}
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

      {/* Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Budget vs spending by category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer>
                <BarChart data={chartData} margin={{ left: 10, right: 10 }}>
                  <CartesianGrid stroke="#3a3a3a" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="#999"
                    fontSize={10}
                    tickLine={false}
                    angle={-30}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    stroke="#999"
                    fontSize={11}
                    tickFormatter={(v) => `€${eur(v)}`}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(v: number) => `€${eur(v)}`}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Budget" fill="#facc15" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Spending" fill="#34d399" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Comparison table */}
      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No data for this period.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label="" sortKey={"category" as K} sort={null} onClick={() => {}} className="w-[32px]" />
                <SortableHead label="Category" sortKey="category" sort={sort} onClick={toggle} />
                <SortableHead label="Budget" sortKey="budget" sort={sort} onClick={toggle} className="text-right" />
                <SortableHead label="Spending" sortKey="spending" sort={sort} onClick={toggle} className="text-right" />
                <SortableHead label="Difference" sortKey="diff" sort={sort} onClick={toggle} className="text-right" />
                <SortableHead label="% Used" sortKey="pct" sort={sort} onClick={toggle} className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((r) => (
                <ComparisonRow
                  key={r.categoryId}
                  row={r}
                  year={year}
                  month={month}
                  expanded={expanded === r.categoryId}
                  onToggle={() =>
                    setExpanded((prev) =>
                      prev === r.categoryId ? null : r.categoryId,
                    )
                  }
                />
              ))}
              {/* Totals */}
              <TableRow className="border-t-2 border-border font-semibold">
                <TableCell />
                <TableCell>Total</TableCell>
                <TableCell className="text-right font-mono">
                  {formatMoney(totalBudget, "EUR")}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatMoney(totalSpending, "EUR")}
                </TableCell>
                <TableCell
                  className={`text-right font-mono ${totalBudget - totalSpending >= 0 ? "text-emerald-500" : "text-destructive"}`}
                >
                  {formatMoney(totalBudget - totalSpending, "EUR")}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {totalBudget > 0
                    ? `${((totalSpending / totalBudget) * 100).toFixed(0)}%`
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

function ComparisonRow({
  row,
  year,
  month,
  expanded,
  onToggle,
}: {
  row: BudgetVsSpendRow;
  year: number;
  month?: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["drilldown", row.categoryId, year, month],
    queryFn: () => {
      const p = new URLSearchParams({
        categoryId: row.categoryId,
        year: String(year),
      });
      if (month) p.set("month", String(month));
      return apiFetch<CategoryDrillDown>(`/api/dashboard/drilldown?${p}`);
    },
    enabled: expanded,
  });

  const pctColor =
    row.pctUsed == null
      ? ""
      : row.pctUsed <= 80
        ? "text-emerald-500"
        : row.pctUsed <= 100
          ? "text-yellow-500"
          : "text-destructive";

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-accent/50"
        onClick={onToggle}
      >
        <TableCell className="w-[32px]">
          {expanded ? (
            <ChevronDown className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell className="font-medium">{row.categoryName}</TableCell>
        <TableCell className="text-right font-mono">
          {formatMoney(row.budgetEur, "EUR")}
        </TableCell>
        <TableCell className="text-right font-mono">
          {formatMoney(row.spendingEur, "EUR")}
        </TableCell>
        <TableCell
          className={`text-right font-mono ${row.diff >= 0 ? "text-emerald-500" : "text-destructive"}`}
        >
          {formatMoney(row.diff, "EUR")}
        </TableCell>
        <TableCell className={`text-right font-mono ${pctColor}`}>
          {row.pctUsed != null ? `${row.pctUsed.toFixed(0)}%` : "—"}
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
                        <TableCell>
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
