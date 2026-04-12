"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  Upload,
  FileSpreadsheet,
  ArrowRight,
  X,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/common/PageHeader";
import { useCategories } from "@/hooks/use-categories";
import { usePaymentMethods } from "@/hooks/use-payment-methods";
import { apiFetch } from "@/lib/api-client";
import { parseXlsxFiles, type ParsedRow } from "@/lib/xlsx-parser";
import { formatMoney } from "@/lib/format";
import { FX_TO_EUR } from "@/lib/fx";
import type { CategorizedRow, MatchTier } from "@/lib/categorizer";

type ReviewRow = CategorizedRow & {
  _id: string;
  skip: boolean;
  saveRule: boolean;
};

type Filter = "all" | "uncategorized" | "rule";
type SortKey = "date" | "description" | "amount" | "category" | "method" | "tier";
type SortState = { key: SortKey; dir: "asc" | "desc" } | null;

const TIER_LABEL: Record<MatchTier, string> = {
  merchant: "M",
  spendee: "S",
  manual: "?",
  broken: "!",
};
const TIER_VARIANT: Record<
  MatchTier,
  "default" | "secondary" | "outline" | "destructive"
> = {
  merchant: "default",
  spendee: "secondary",
  manual: "outline",
  broken: "destructive",
};
const TIER_ORDER: Record<MatchTier, number> = {
  merchant: 0,
  spendee: 1,
  manual: 2,
  broken: 3,
};

const isCategorizedByRule = (r: ReviewRow) =>
  r.matchTier === "merchant" || r.matchTier === "spendee";
const isUncategorized = (r: ReviewRow) =>
  !r.categoryId || r.matchTier === "manual" || r.matchTier === "broken";

export default function ImportPage() {
  const router = useRouter();
  const cats = useCategories();
  const pm = usePaymentMethods();
  const [files, setFiles] = useState<File[]>([]);
  const [parsing, setParsing] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null);
  const [reviewRows, setReviewRows] = useState<ReviewRow[] | null>(null);
  const [fxRates, setFxRates] = useState<Record<string, number>>({
    ...FX_TO_EUR,
  });
  // Optional month override — blank means derive from each row's chargeDate.
  const [monthOverride, setMonthOverride] = useState<string>("");

  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortState>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCategoryId, setBulkCategoryId] = useState<string>("");
  const [bulkMethod, setBulkMethod] = useState<string>("");

  // Detect unique currencies present in the parsed data.
  const parsedCurrencies = useMemo(() => {
    if (!parsed) return [];
    const set = new Set(parsed.map((r) => r.currency.toUpperCase()));
    return Array.from(set).sort();
  }, [parsed]);

  // ---- derived ----------------------------------------------------------

  const stats = useMemo(() => {
    if (!reviewRows) return null;
    const total = reviewRows.length;
    const skipped = reviewRows.filter((r) => r.skip).length;
    const ready = reviewRows.filter((r) => !r.skip && r.categoryId).length;
    const needsCategory = reviewRows.filter(
      (r) => !r.skip && !r.categoryId,
    ).length;
    const byRule = reviewRows.filter(isCategorizedByRule).length;
    const totalEur = reviewRows
      .filter((r) => !r.skip && r.categoryId)
      .reduce((sum, r) => sum + r.euroMoney, 0);
    return { total, skipped, ready, needsCategory, byRule, totalEur };
  }, [reviewRows]);

  const filteredRows = useMemo(() => {
    if (!reviewRows) return null;
    if (filter === "all") return reviewRows;
    if (filter === "uncategorized") return reviewRows.filter(isUncategorized);
    return reviewRows.filter(isCategorizedByRule);
  }, [reviewRows, filter]);

  const displayedRows = useMemo(() => {
    if (!filteredRows) return null;
    if (!sort) return filteredRows;
    const cmp = (a: ReviewRow, b: ReviewRow): number => {
      let av: number | string = 0;
      let bv: number | string = 0;
      switch (sort.key) {
        case "date":
          av = a.chargeDate;
          bv = b.chargeDate;
          break;
        case "description":
          av = a.transaction.toLowerCase();
          bv = b.transaction.toLowerCase();
          break;
        case "amount":
          av = a.euroMoney;
          bv = b.euroMoney;
          break;
        case "category":
          av = a.categoryName?.toLowerCase() ?? "";
          bv = b.categoryName?.toLowerCase() ?? "";
          break;
        case "method":
          av = (a.method ?? "").toLowerCase();
          bv = (b.method ?? "").toLowerCase();
          break;
        case "tier":
          av = TIER_ORDER[a.matchTier];
          bv = TIER_ORDER[b.matchTier];
          break;
      }
      if (av < bv) return sort.dir === "asc" ? -1 : 1;
      if (av > bv) return sort.dir === "asc" ? 1 : -1;
      return 0;
    };
    return [...filteredRows].sort(cmp);
  }, [filteredRows, sort]);

  const visibleIds = useMemo(
    () => new Set((displayedRows ?? []).map((r) => r._id)),
    [displayedRows],
  );
  const visibleSelected = useMemo(
    () => [...selected].filter((id) => visibleIds.has(id)),
    [selected, visibleIds],
  );
  const allVisibleSelected =
    (displayedRows?.length ?? 0) > 0 &&
    visibleSelected.length === (displayedRows?.length ?? 0);
  const someVisibleSelected =
    visibleSelected.length > 0 && !allVisibleSelected;

  // ---- mutators ---------------------------------------------------------

  function reset() {
    setFiles([]);
    setParsed(null);
    setReviewRows(null);
    setSelected(new Set());
    setSort(null);
    setFilter("all");
    setBulkCategoryId("");
    setBulkMethod("");
    setFxRates({ ...FX_TO_EUR });
    setMonthOverride("");
  }

  function updateRow(id: string, patch: Partial<ReviewRow>) {
    setReviewRows((prev) => {
      if (!prev) return prev;
      return prev.map((r) => (r._id === id ? { ...r, ...patch } : r));
    });
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAllVisible(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) (displayedRows ?? []).forEach((r) => next.add(r._id));
      else (displayedRows ?? []).forEach((r) => next.delete(r._id));
      return next;
    });
  }

  function setRowCategory(id: string, categoryId: string) {
    const cat = cats.data?.categories.find((c) => c.id === categoryId);
    if (!cat) return;
    setReviewRows((prev) => {
      if (!prev) return prev;
      return prev.map((r) => {
        if (r._id !== id) return r;
        const keepTier = isCategorizedByRule(r) ? r.matchTier : "manual";
        return {
          ...r,
          categoryId: cat.id,
          categoryName: cat.name,
          spendId: cat.spendId,
          matchTier: keepTier,
        };
      });
    });
  }

  function applyBulkCategory() {
    if (!bulkCategoryId || visibleSelected.length === 0) return;
    const cat = cats.data?.categories.find((c) => c.id === bulkCategoryId);
    if (!cat) return;
    const ids = new Set(visibleSelected);
    setReviewRows((prev) => {
      if (!prev) return prev;
      return prev.map((r) =>
        ids.has(r._id)
          ? {
              ...r,
              categoryId: cat.id,
              categoryName: cat.name,
              spendId: cat.spendId,
              matchTier: isCategorizedByRule(r) ? r.matchTier : "manual",
            }
          : r,
      );
    });
    toast.success(`Updated ${ids.size} row${ids.size === 1 ? "" : "s"}`);
    setBulkCategoryId("");
  }

  function applyBulkMethod() {
    if (!bulkMethod || visibleSelected.length === 0) return;
    const ids = new Set(visibleSelected);
    setReviewRows((prev) => {
      if (!prev) return prev;
      return prev.map((r) =>
        ids.has(r._id) ? { ...r, method: bulkMethod } : r,
      );
    });
    toast.success(`Updated ${ids.size} row${ids.size === 1 ? "" : "s"}`);
    setBulkMethod("");
  }

  function applyBulkSkip(skip: boolean) {
    if (visibleSelected.length === 0) return;
    const ids = new Set(visibleSelected);
    setReviewRows((prev) => {
      if (!prev) return prev;
      return prev.map((r) => (ids.has(r._id) ? { ...r, skip } : r));
    });
    toast.success(
      `${skip ? "Skipped" : "Re-included"} ${ids.size} row${ids.size === 1 ? "" : "s"}`,
    );
  }

  function clearSelection() {
    setSelected(new Set());
  }

  // ---- pipeline actions -------------------------------------------------

  async function onParse() {
    if (files.length === 0) return;
    setParsing(true);
    try {
      const rows = await parseXlsxFiles(files);
      setParsed(rows);
      toast.success(
        `Parsed ${rows.length} expense rows from ${files.length} file(s)`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Parse failed");
    } finally {
      setParsing(false);
    }
  }

  async function onPreview() {
    if (!parsed) return;
    setPreviewing(true);
    try {
      const res = await apiFetch<{ rows: CategorizedRow[]; count: number }>(
        "/api/spending/import/preview",
        {
          method: "POST",
          body: JSON.stringify({
            rows: parsed,
            fxRates,
            monthOverride: monthOverride ? Number(monthOverride) : null,
          }),
        },
      );
      let n = 0;
      setReviewRows(
        res.rows.map((r) => ({
          ...r,
          _id: `r${n++}`,
          skip: false,
          saveRule: false,
        })),
      );
      setSelected(new Set());
      setSort(null);
      setFilter("all");
      toast.success(`Categorized ${res.count} rows`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setPreviewing(false);
    }
  }

  async function onSubmit() {
    if (!reviewRows) return;
    const payloadRows = reviewRows
      .filter((r) => !r.skip && r.categoryId)
      .map((r) => ({
        transaction: r.transaction,
        amount: r.amount,
        currency: r.currency,
        categoryId: r.categoryId!,
        chargeDate: r.chargeDate,
        moneyDate: r.chargeDate,
        method: r.method ?? null,
        spendName: r.transaction,
      }));
    if (payloadRows.length === 0) {
      toast.error("Nothing to import — every row is skipped or uncategorized");
      return;
    }
    const saveRules = reviewRows
      .filter((r) => r.saveRule && !r.skip && r.categoryId && r.spendId)
      .map((r) => {
        if (r.matchTier === "spendee") {
          return {
            kind: "spendee" as const,
            spendeeCategory: r.spendeeCategory,
            spendId: r.spendId!,
          };
        }
        return {
          kind: "merchant" as const,
          pattern: r.transaction,
          spendId: r.spendId!,
        };
      });

    setSubmitting(true);
    const start = Date.now();
    try {
      const res = await apiFetch<{
        inserted: number;
        newMerchantRules: number;
        newSpendeeRules: number;
      }>("/api/spending/batch", {
        method: "POST",
        body: JSON.stringify({
          rows: payloadRows,
          saveRules,
          fxRates,
          monthOverride: monthOverride ? Number(monthOverride) : null,
        }),
      });
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      toast.success(
        `Imported ${res.inserted} rows in ${elapsed}s · +${res.newMerchantRules} merchant, +${res.newSpendeeRules} spendee rules`,
      );
      router.push("/spending");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setSubmitting(false);
    }
  }

  function clickHeader(key: SortKey) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  }

  const headerCheckboxState: boolean | "indeterminate" = allVisibleSelected
    ? true
    : someVisibleSelected
      ? "indeterminate"
      : false;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import spending"
        description="Drop Spendee XLSX exports, review the auto-categorized preview, then commit in one batch."
      />

      {/* Step 1: pick files */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Files</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm transition-colors hover:bg-muted/50">
            <Upload className="size-6 text-muted-foreground" />
            <span className="font-medium">Click to choose .xlsx file(s)</span>
            <span className="text-xs text-muted-foreground">
              Multiple files allowed; only Expense rows are kept
            </span>
            <input
              type="file"
              multiple
              accept=".xlsx"
              className="hidden"
              onChange={(e) => {
                const list = e.target.files ? Array.from(e.target.files) : [];
                setFiles(list);
                setParsed(null);
                setReviewRows(null);
              }}
            />
          </label>
          {files.length > 0 && (
            <ul className="space-y-1 text-sm">
              {files.map((f) => (
                <li
                  key={f.name}
                  className="flex items-center gap-2 text-muted-foreground"
                >
                  <FileSpreadsheet className="size-4" />
                  {f.name}
                  <span className="text-xs">
                    ({(f.size / 1024).toFixed(0)} KB)
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center gap-2">
            <Button onClick={onParse} disabled={files.length === 0 || parsing}>
              {parsing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Parsing…
                </>
              ) : (
                <>
                  Parse files
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
            {(files.length > 0 || parsed || reviewRows) && (
              <Button variant="ghost" onClick={reset}>
                <X className="size-4" />
                Reset
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Step 2: FX rates + categorize */}
      {parsed && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              2. FX rates &amp; categorize ({parsed.length} rows)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Adjust FX rates (to EUR) and optionally override the month for
              all rows, then run the categorizer.
            </p>
            <div className="flex flex-wrap items-end gap-4">
              {parsedCurrencies.map((cur) => (
                <div key={cur} className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    1 {cur} → EUR
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="h-9 w-28 rounded-md border border-input bg-transparent px-3 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={fxRates[cur] ?? ""}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setFxRates((prev) => ({
                        ...prev,
                        [cur]: Number.isFinite(v) ? v : 0,
                      }));
                    }}
                  />
                </div>
              ))}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Month override
                </label>
                <select
                  className="h-9 w-32 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={monthOverride}
                  onChange={(e) => setMonthOverride(e.target.value)}
                >
                  <option value="">Auto (from date)</option>
                  {[
                    "Jan","Feb","Mar","Apr","May","Jun",
                    "Jul","Aug","Sep","Oct","Nov","Dec",
                  ].map((m, i) => (
                    <option key={i} value={String(i + 1)}>
                      {i + 1} — {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <Button onClick={onPreview} disabled={previewing}>
              {previewing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Categorizing…
                </>
              ) : (
                <>
                  Categorize
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 3: review + submit */}
      {reviewRows && stats && (
        <Card>
          <CardHeader className="space-y-4">
            <CardTitle className="text-base">3. Review &amp; submit</CardTitle>
            <Tabs
              value={filter}
              onValueChange={(v) => setFilter(v as Filter)}
            >
              <TabsList>
                <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
                <TabsTrigger value="uncategorized">
                  Needs category ({stats.needsCategory})
                </TabsTrigger>
                <TabsTrigger value="rule">
                  By rule ({stats.byRule})
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="rounded bg-muted px-2 py-1">
                Ready:{" "}
                <strong className="tabular-nums">{stats.ready}</strong>
              </span>
              <span className="rounded bg-muted px-2 py-1">
                Skipped:{" "}
                <strong className="tabular-nums">{stats.skipped}</strong>
              </span>
              <span className="rounded bg-muted px-2 py-1">
                Total EUR:{" "}
                <strong className="tabular-nums">
                  {formatMoney(stats.totalEur, "EUR")}
                </strong>
              </span>
            </div>
          </CardHeader>

          {/* Bulk action bar */}
          {visibleSelected.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-y border-border bg-accent/30 px-6 py-3">
              <span className="text-sm font-medium">
                {visibleSelected.length} selected
              </span>
              <div className="ml-2 flex flex-wrap items-center gap-2">
                <Select
                  value={bulkCategoryId}
                  onValueChange={setBulkCategoryId}
                >
                  <SelectTrigger className="w-[260px]">
                    <SelectValue placeholder="Set category to…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(cats.data?.categories ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={applyBulkCategory}
                  disabled={!bulkCategoryId}
                >
                  Apply category
                </Button>
                <Select
                  value={bulkMethod}
                  onValueChange={setBulkMethod}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Set method to…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(pm.data?.methods ?? []).map((m) => (
                      <SelectItem key={m.id} value={m.name}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={applyBulkMethod}
                  disabled={!bulkMethod}
                >
                  Apply method
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => applyBulkSkip(true)}
                >
                  Mark as skip
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => applyBulkSkip(false)}
                >
                  Re-include
                </Button>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto"
                onClick={clearSelection}
              >
                Clear selection
              </Button>
            </div>
          )}

          <CardContent className="space-y-4 p-0 sm:p-6 sm:pt-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={headerCheckboxState}
                        onCheckedChange={(c) => toggleAllVisible(!!c)}
                        aria-label="Select all visible rows"
                      />
                    </TableHead>
                    <TableHead className="w-[60px]">
                      <SortableHead
                        label="Tier"
                        sortKey="tier"
                        sort={sort}
                        onClick={clickHeader}
                      />
                    </TableHead>
                    <TableHead className="w-[110px]">
                      <SortableHead
                        label="Date"
                        sortKey="date"
                        sort={sort}
                        onClick={clickHeader}
                      />
                    </TableHead>
                    <TableHead>
                      <SortableHead
                        label="Description"
                        sortKey="description"
                        sort={sort}
                        onClick={clickHeader}
                      />
                    </TableHead>
                    <TableHead className="text-right">
                      <SortableHead
                        label="Amount"
                        sortKey="amount"
                        sort={sort}
                        onClick={clickHeader}
                        align="right"
                      />
                    </TableHead>
                    <TableHead>
                      <SortableHead
                        label="Category"
                        sortKey="category"
                        sort={sort}
                        onClick={clickHeader}
                      />
                    </TableHead>
                    <TableHead>
                      <SortableHead
                        label="Method"
                        sortKey="method"
                        sort={sort}
                        onClick={clickHeader}
                      />
                    </TableHead>
                    <TableHead className="w-[80px]">Skip</TableHead>
                    <TableHead className="w-[100px]">Save rule</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(displayedRows ?? []).map((r) => (
                    <TableRow
                      key={r._id}
                      className={r.skip ? "opacity-50" : undefined}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selected.has(r._id)}
                          onCheckedChange={(c) => toggleOne(r._id, !!c)}
                          aria-label="Select row"
                        />
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={TIER_VARIANT[r.matchTier]}
                          className="font-mono"
                        >
                          {TIER_LABEL[r.matchTier]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.chargeDate}
                      </TableCell>
                      <TableCell className="font-medium">
                        {r.transaction}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatMoney(r.amount, r.currency)}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={r.categoryId ?? ""}
                          onValueChange={(v) => setRowCategory(r._id, v)}
                        >
                          <SelectTrigger className="w-[260px]">
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            {(cats.data?.categories ?? []).map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={r.method || ""}
                          onValueChange={(v) =>
                            updateRow(r._id, { method: v })
                          }
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            {(pm.data?.methods ?? []).map((m) => (
                              <SelectItem key={m.id} value={m.name}>
                                {m.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Checkbox
                          checked={r.skip}
                          onCheckedChange={(c) =>
                            updateRow(r._id, { skip: !!c })
                          }
                          aria-label="Skip this row"
                        />
                      </TableCell>
                      <TableCell>
                        <Checkbox
                          checked={r.saveRule}
                          disabled={!r.spendId || r.skip}
                          onCheckedChange={(c) =>
                            updateRow(r._id, { saveRule: !!c })
                          }
                          aria-label="Save as rule"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {(displayedRows?.length ?? 0) === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="py-10 text-center text-sm text-muted-foreground"
                      >
                        No rows match this filter.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="px-6 pb-2">
              <Button
                onClick={onSubmit}
                disabled={submitting || stats.ready === 0}
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Importing…
                  </>
                ) : (
                  `Import ${stats.ready} row(s)`
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SortableHead({
  label,
  sortKey,
  sort,
  onClick,
  align,
}: {
  label: string;
  sortKey: SortKey;
  sort: SortState;
  onClick: (key: SortKey) => void;
  align?: "right";
}) {
  const active = sort?.key === sortKey;
  const Icon = !active
    ? ChevronsUpDown
    : sort.dir === "asc"
      ? ChevronUp
      : ChevronDown;
  return (
    <button
      type="button"
      onClick={() => onClick(sortKey)}
      className={`flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground ${
        align === "right" ? "ml-auto" : ""
      } ${active ? "text-foreground" : ""}`}
    >
      <span>{label}</span>
      <Icon className="size-3" />
    </button>
  );
}
