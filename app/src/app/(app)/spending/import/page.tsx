"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Upload, FileSpreadsheet, ArrowRight, X } from "lucide-react";
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
import { PageHeader } from "@/components/common/PageHeader";
import { useCategories } from "@/hooks/use-categories";
import { apiFetch } from "@/lib/api-client";
import { parseXlsxFiles, type ParsedRow } from "@/lib/xlsx-parser";
import { formatMoney } from "@/lib/format";
import type { CategorizedRow, MatchTier } from "@/lib/categorizer";

type ReviewRow = CategorizedRow & {
  skip: boolean;
  saveRule: boolean;
};

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

export default function ImportPage() {
  const router = useRouter();
  const cats = useCategories();
  const [files, setFiles] = useState<File[]>([]);
  const [parsing, setParsing] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null);
  const [reviewRows, setReviewRows] = useState<ReviewRow[] | null>(null);

  const stats = useMemo(() => {
    if (!reviewRows) return null;
    const total = reviewRows.length;
    const skipped = reviewRows.filter((r) => r.skip).length;
    const ready = reviewRows.filter(
      (r) => !r.skip && r.categoryId,
    ).length;
    const needsCategory = reviewRows.filter(
      (r) => !r.skip && !r.categoryId,
    ).length;
    const totalEur = reviewRows
      .filter((r) => !r.skip && r.categoryId)
      .reduce((sum, r) => sum + r.euroMoney, 0);
    return { total, skipped, ready, needsCategory, totalEur };
  }, [reviewRows]);

  function reset() {
    setFiles([]);
    setParsed(null);
    setReviewRows(null);
  }

  async function onParse() {
    if (files.length === 0) return;
    setParsing(true);
    try {
      const rows = await parseXlsxFiles(files);
      setParsed(rows);
      toast.success(`Parsed ${rows.length} expense rows from ${files.length} file(s)`);
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
          body: JSON.stringify({ rows: parsed }),
        },
      );
      setReviewRows(
        res.rows.map((r) => ({ ...r, skip: false, saveRule: false })),
      );
      toast.success(`Categorized ${res.count} rows`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setPreviewing(false);
    }
  }

  function updateRow(idx: number, patch: Partial<ReviewRow>) {
    setReviewRows((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
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
        body: JSON.stringify({ rows: payloadRows, saveRules }),
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
                  <span className="text-xs">({(f.size / 1024).toFixed(0)} KB)</span>
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

      {/* Step 2: preview */}
      {parsed && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              2. Categorize ({parsed.length} rows)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Send the parsed rows to the server-side categorizer. It runs the
              two-tier matcher (merchant patterns first, Spendee categories
              second) against the rules in the database.
            </p>
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
          <CardHeader className="space-y-3">
            <CardTitle className="text-base">3. Review &amp; submit</CardTitle>
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="rounded bg-muted px-2 py-1">
                Total: <strong className="tabular-nums">{stats.total}</strong>
              </span>
              <span className="rounded bg-muted px-2 py-1">
                Ready: <strong className="tabular-nums">{stats.ready}</strong>
              </span>
              <span className="rounded bg-muted px-2 py-1">
                Needs category:{" "}
                <strong className="tabular-nums">{stats.needsCategory}</strong>
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
          <CardContent className="space-y-4 p-0 sm:p-6 sm:pt-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead className="w-[40px]">Tier</TableHead>
                    <TableHead className="w-[100px]">Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="w-[110px]">Save rule</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviewRows.map((r, idx) => (
                    <TableRow
                      key={idx}
                      className={r.skip ? "opacity-50" : undefined}
                    >
                      <TableCell>
                        <Checkbox
                          checked={r.skip}
                          onCheckedChange={(c) =>
                            updateRow(idx, { skip: !!c })
                          }
                          aria-label="Skip"
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
                          onValueChange={(v) => {
                            const cat = cats.data?.categories.find(
                              (c) => c.id === v,
                            );
                            updateRow(idx, {
                              categoryId: v,
                              categoryName: cat?.name ?? null,
                              spendId: cat?.spendId ?? null,
                              matchTier:
                                r.matchTier === "merchant" ||
                                r.matchTier === "spendee"
                                  ? r.matchTier
                                  : "manual",
                            });
                          }}
                        >
                          <SelectTrigger className="w-[260px]">
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            {(cats.data?.categories ?? []).map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.spendId ? `[${c.spendId}] ` : ""}
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Checkbox
                          checked={r.saveRule}
                          disabled={!r.spendId || r.skip}
                          onCheckedChange={(c) =>
                            updateRow(idx, { saveRule: !!c })
                          }
                          aria-label="Save as rule"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
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
