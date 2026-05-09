"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/lib/format";
import { numericOnChange } from "@/lib/utils";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

type Row = { mm: number | null; total: number };
type OutMode = "spend" | "budget";

function storageKey(year: number) {
  return `gringotts:cashflow-start:${year}`;
}

function modeKey(year: number) {
  return `gringotts:cashflow-mode:${year}`;
}

export function CashFlowReport({
  year,
  spendOutRows,
  budgetOutRows,
  inRows,
}: {
  year: number;
  spendOutRows: Row[];
  budgetOutRows: Row[];
  inRows: Row[];
}) {
  const [starting, setStarting] = useState<number | "">(0);
  const [outMode, setOutMode] = useState<OutMode>("spend");

  useEffect(() => {
    const raw = window.localStorage.getItem(storageKey(year));
    const v = raw == null ? 0 : Number(raw);
    setStarting(Number.isFinite(v) ? v : 0);
    const m = window.localStorage.getItem(modeKey(year));
    if (m === "budget" || m === "spend") setOutMode(m);
  }, [year]);

  function handleStartingChange(v: number | "") {
    setStarting(v);
    const num = v === "" ? 0 : v;
    window.localStorage.setItem(storageKey(year), String(num));
  }

  function handleModeChange(v: string) {
    if (v !== "spend" && v !== "budget") return;
    setOutMode(v);
    window.localStorage.setItem(modeKey(year), v);
  }

  const months = useMemo(() => {
    const out = new Map<number, number>();
    const inn = new Map<number, number>();
    const outSource = outMode === "budget" ? budgetOutRows : spendOutRows;
    for (const r of outSource) if (r.mm != null) out.set(r.mm, Number(r.total ?? 0));
    for (const r of inRows) if (r.mm != null) inn.set(r.mm, Number(r.total ?? 0));

    const start = starting === "" ? 0 : starting;
    let running = start;
    return Array.from({ length: 12 }, (_, i) => {
      const mm = i + 1;
      const moneyIn = inn.get(mm) ?? 0;
      const moneyOut = out.get(mm) ?? 0;
      const net = moneyIn - moneyOut;
      running += net;
      return {
        mm,
        label: MONTH_LABELS[i],
        moneyIn,
        moneyOut,
        net,
        running,
      };
    });
  }, [spendOutRows, budgetOutRows, outMode, inRows, starting]);

  const totals = useMemo(() => {
    const moneyIn = months.reduce((s, m) => s + m.moneyIn, 0);
    const moneyOut = months.reduce((s, m) => s + m.moneyOut, 0);
    return { moneyIn, moneyOut, net: moneyIn - moneyOut };
  }, [months]);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="starting" className="text-xs text-muted-foreground">
              Starting balance ({year})
            </Label>
            <Input
              id="starting"
              type="number"
              step="0.01"
              className="w-[180px]"
              value={starting}
              onChange={numericOnChange(handleStartingChange, "")}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Money out</Label>
            <Tabs value={outMode} onValueChange={handleModeChange}>
              <TabsList>
                <TabsTrigger value="spend">Real spending</TabsTrigger>
                <TabsTrigger value="budget">Budget</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <p className="text-xs text-muted-foreground">
            Money in is planned income. Money out is{" "}
            {outMode === "budget"
              ? "the budget plan grouped by charge month"
              : "spending grouped by due date (or spend date when no due date is set)"}
            . Saved per year in this browser.
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cash flow ({year})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Money in</TableHead>
                <TableHead className="text-right">Money out</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead className="text-right">Running</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {months.map((m) => (
                <TableRow key={m.mm}>
                  <TableCell className="font-medium">{m.label}</TableCell>
                  <TableCell className="text-right font-mono">
                    {m.moneyIn === 0 ? "—" : formatMoney(m.moneyIn, "EUR")}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {m.moneyOut === 0 ? "—" : formatMoney(m.moneyOut, "EUR")}
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono ${
                      m.net === 0
                        ? ""
                        : m.net > 0
                          ? "text-emerald-500"
                          : "text-destructive"
                    }`}
                  >
                    {m.net === 0 ? "—" : formatMoney(m.net, "EUR")}
                  </TableCell>
                  <TableCell
                    className={`text-right font-mono ${
                      m.running < 0 ? "text-destructive" : ""
                    }`}
                  >
                    {formatMoney(m.running, "EUR")}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t-2 border-border font-semibold">
                <TableCell>Total</TableCell>
                <TableCell className="text-right font-mono">
                  {formatMoney(totals.moneyIn, "EUR")}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatMoney(totals.moneyOut, "EUR")}
                </TableCell>
                <TableCell
                  className={`text-right font-mono ${
                    totals.net >= 0 ? "text-emerald-500" : "text-destructive"
                  }`}
                >
                  {formatMoney(totals.net, "EUR")}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
