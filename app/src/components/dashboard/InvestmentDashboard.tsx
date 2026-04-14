"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type {
  AllocationSlice,
  PortfolioHolding,
  PortfolioSummary,
} from "@/lib/investment-analytics";
import { formatAmount, formatMoney } from "@/lib/format";

const COLORS = [
  "#34d399", // emerald
  "#f59e0b", // amber
  "#3b82f6", // blue
  "#ef4444", // red
  "#a855f7", // purple
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
  "#6366f1", // indigo
  "#eab308", // yellow
];

const eur = (v: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v);

type Props = { data: PortfolioSummary };

function groupByTickerFn(holdings: PortfolioHolding[]): PortfolioHolding[] {
  const map = new Map<string, PortfolioHolding>();
  for (const h of holdings) {
    const key = h.ticker?.trim() || h.id; // ungrouped if no ticker
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...h });
    } else {
      existing.quantity += h.quantity;
      existing.costBasis += h.costBasis;
      existing.currentValue += h.currentValue;
      existing.gainLoss += h.gainLoss;
      existing.returnPct =
        existing.costBasis > 0
          ? (existing.gainLoss / existing.costBasis) * 100
          : 0;
      // Keep the earliest purchase date
      if (
        h.purchaseDate &&
        (!existing.purchaseDate || h.purchaseDate < existing.purchaseDate)
      ) {
        existing.purchaseDate = h.purchaseDate;
      }
      // If any lot is unvested, the group is unvested
      if (!h.isVested) existing.isVested = false;
      // Weighted average growth rate by value
      existing.annualGrowthRate =
        ((existing.annualGrowthRate ?? 7) *
          (existing.currentValue - h.currentValue) +
          (h.annualGrowthRate ?? 7) * h.currentValue) /
        existing.currentValue;
    }
  }
  return Array.from(map.values());
}

export function InvestmentDashboard({ data }: Props) {
  const [growthRates, setGrowthRates] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    data.holdings.forEach((h) => {
      m[h.id] = h.annualGrowthRate ?? 7;
    });
    return m;
  });
  const [includeUnvested, setIncludeUnvested] = useState(true);
  const [groupTicker, setGroupTicker] = useState(false);

  const displayHoldings = useMemo(
    () => (groupTicker ? groupByTickerFn(data.holdings) : data.holdings),
    [data.holdings, groupTicker],
  );

  const projection = useMemo(
    () => computeProjection(displayHoldings, growthRates, includeUnvested),
    [displayHoldings, growthRates, includeUnvested],
  );

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Portfolio value" value={formatMoney(data.totalValue, "EUR")} />
        <StatCard
          label="Gain / Loss"
          value={`${formatMoney(data.totalGainLoss, "EUR")} (${data.totalReturnPct.toFixed(1)}%)`}
          tone={data.totalGainLoss >= 0 ? "good" : "bad"}
        />
        <StatCard label="Liquid value" value={formatMoney(data.liquidValue, "EUR")} />
        <StatCard label="Unvested" value={formatMoney(data.unvestedValue, "EUR")} />
      </div>

      {/* Row 1: Asset type + Allocation breakdowns */}
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <DonutCard title="By asset type" slices={data.byAssetType.map((s) => ({ name: s.name, value: s.value }))} />
        <DonutCard
          title="Industry allocation"
          slices={data.industryAllocations.map((a) => ({
            name: a.category,
            value: a.percentage,
          }))}
          suffix="%"
        />
        <DonutCard
          title="Geography allocation"
          slices={data.geographyAllocations.map((a) => ({
            name: a.category,
            value: a.percentage,
          }))}
          suffix="%"
        />
        <DonutCard
          title="Fund allocation"
          slices={data.fundAllocations.map((a) => ({
            name: a.category,
            value: a.percentage,
          }))}
          suffix="%"
        />
      </div>

      {/* Row 2: Gain/loss bar */}
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <CardTitle className="text-base">Gain / loss by asset</CardTitle>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={groupTicker}
              onCheckedChange={(c) => setGroupTicker(!!c)}
            />
            Group by ticker
          </label>
        </CardHeader>
        <CardContent>
          <GainLossBar holdings={displayHoldings} />
        </CardContent>
      </Card>

      {/* Row 3: History + Projection */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Portfolio value over time</CardTitle>
          </CardHeader>
          <CardContent>
            <HistoryChart history={data.monthlyHistory} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <CardTitle className="text-base">5-year projection</CardTitle>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox
                checked={includeUnvested}
                onCheckedChange={(c) => setIncludeUnvested(!!c)}
              />
              Include unvested
            </label>
          </CardHeader>
          <CardContent>
            <ProjectionChart data={projection.points} includeUnvested={includeUnvested} />
          </CardContent>
        </Card>
      </div>

      {/* Projection table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Projection summary (quarterly)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <ProjectionTable data={projection.table} />
        </CardContent>
      </Card>

      {/* Holdings table with growth rate sliders */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Holdings</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <HoldingsTable
            holdings={displayHoldings}
            totalValue={data.totalValue}
            growthRates={growthRates}
            onGrowthRateChange={(id, rate) =>
              setGrowthRates((prev) => ({ ...prev, [id]: rate }))
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}

// ---- Sub-components -------------------------------------------------------

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  return (
    <Card>
      <CardContent className="space-y-1 p-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p
          className={`text-2xl font-semibold tabular-nums ${
            tone === "good"
              ? "text-emerald-500"
              : tone === "bad"
                ? "text-destructive"
                : ""
          }`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function DonutCard({
  title,
  slices,
  suffix = "",
}: {
  title: string;
  slices: { name: string; value: number }[];
  suffix?: string;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (slices.length === 0)
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex h-56 items-center justify-center text-sm text-muted-foreground">
          No data
        </CardContent>
      </Card>
    );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-56 w-full">
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={45}
                paddingAngle={2}
              >
                {slices.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(v) => {
                  const n = Number(v);
                  const pct = total > 0 ? ((n / total) * 100).toFixed(1) : "0.0";
                  if (suffix === "%") return `${n.toFixed(1)}% (of portfolio)`;
                  return `€${eur(n)} · ${pct}%`;
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: "#999" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function GainLossBar({ holdings }: { holdings: PortfolioHolding[] }) {
  const data = [...holdings]
    .sort((a, b) => b.gainLoss - a.gainLoss)
    .map((h) => ({
      name: h.ticker || h.name,
      gainLoss: Math.round(h.gainLoss),
    }));

  return (
    <div style={{ height: Math.max(200, data.length * 32) }} className="w-full">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 60, right: 20 }}>
          <CartesianGrid stroke="#3a3a3a" strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            stroke="#999"
            fontSize={11}
            tickFormatter={(v) => `€${eur(v)}`}
          />
          <YAxis
            type="category"
            dataKey="name"
            stroke="#999"
            fontSize={11}
            width={55}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(v) => `€${eur(Number(v))}`}
          />
          <Bar dataKey="gainLoss" radius={[0, 4, 4, 0]}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={d.gainLoss >= 0 ? "#34d399" : "#f87171"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function HistoryChart({ history }: { history: { label: string; value: number }[] }) {
  if (history.length === 0)
    return (
      <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
        No history
      </div>
    );
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <LineChart data={history}>
          <CartesianGrid stroke="#3a3a3a" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" stroke="#999" fontSize={10} />
          <YAxis
            stroke="#999"
            fontSize={10}
            tickFormatter={(v) => `€${eur(v)}`}
          />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => `€${eur(Number(v))}`} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#34d399"
            fill="#34d399"
            fillOpacity={0.1}
            strokeWidth={2}
            dot={history.length <= 24}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ProjectionChart({
  data,
  includeUnvested,
}: {
  data: ProjectionPoint[];
  includeUnvested: boolean;
}) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid stroke="#3a3a3a" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" stroke="#999" fontSize={10} />
          <YAxis
            stroke="#999"
            fontSize={10}
            tickFormatter={(v) => `€${eur(v)}`}
          />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => `€${eur(Number(v))}`} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line
            type="monotone"
            dataKey="liquid"
            name="Liquid"
            stroke="#34d399"
            strokeWidth={2}
            dot={false}
          />
          {includeUnvested && (
            <Line
              type="monotone"
              dataKey="withUnvested"
              name="With unvested"
              stroke="#facc15"
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ProjectionTable({ data }: { data: ProjectionTableRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Year</TableHead>
          <TableHead className="text-right">Q1</TableHead>
          <TableHead className="text-right">Q2</TableHead>
          <TableHead className="text-right">Q3</TableHead>
          <TableHead className="text-right">Q4</TableHead>
          <TableHead className="text-right">Year-end</TableHead>
          <TableHead className="text-right">YoY</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => (
          <TableRow key={row.year}>
            <TableCell className="font-medium">{row.year}</TableCell>
            {row.quarters.map((q, i) => (
              <TableCell key={i} className="text-right font-mono text-sm">
                {q != null ? `€${eur(q)}` : "—"}
              </TableCell>
            ))}
            <TableCell className="text-right font-mono text-sm font-medium">
              {row.yearEnd != null ? `€${eur(row.yearEnd)}` : "—"}
            </TableCell>
            <TableCell className="text-right font-mono text-sm">
              {row.yoy != null ? (
                <span className={row.yoy >= 0 ? "text-emerald-500" : "text-destructive"}>
                  {row.yoy >= 0 ? "+" : ""}
                  {row.yoy.toFixed(1)}%
                </span>
              ) : (
                "baseline"
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function HoldingsTable({
  holdings,
  totalValue,
  growthRates,
  onGrowthRateChange,
}: {
  holdings: PortfolioHolding[];
  totalValue: number;
  growthRates: Record<string, number>;
  onGrowthRateChange: (id: string, rate: number) => void;
}) {
  const sorted = [...holdings].sort((a, b) => b.currentValue - a.currentValue);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Asset</TableHead>
          <TableHead>Type</TableHead>
          <TableHead className="text-right">Qty</TableHead>
          <TableHead className="text-right">Value (EUR)</TableHead>
          <TableHead className="text-right">Gain/Loss</TableHead>
          <TableHead className="text-right">Return</TableHead>
          <TableHead className="text-right">% Port.</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-[160px]">Growth %</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((h) => {
          const pct = totalValue > 0 ? (h.currentValue / totalValue) * 100 : 0;
          return (
            <TableRow key={h.id}>
              <TableCell>
                <div>
                  <span className="font-medium">{h.name}</span>
                  {h.ticker && (
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      {h.ticker}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {h.assetType ? <Badge variant="outline">{h.assetType}</Badge> : "—"}
              </TableCell>
              <TableCell className="text-right font-mono">{formatAmount(h.quantity)}</TableCell>
              <TableCell className="text-right font-mono">
                {formatMoney(h.currentValue, "EUR")}
              </TableCell>
              <TableCell
                className={`text-right font-mono ${h.gainLoss >= 0 ? "text-emerald-500" : "text-destructive"}`}
              >
                {formatMoney(h.gainLoss, "EUR")}
              </TableCell>
              <TableCell
                className={`text-right font-mono ${h.returnPct >= 0 ? "text-emerald-500" : "text-destructive"}`}
              >
                {h.returnPct.toFixed(1)}%
              </TableCell>
              <TableCell className="text-right font-mono">{pct.toFixed(1)}%</TableCell>
              <TableCell>
                <Badge variant={h.isVested ? "secondary" : "outline"}>
                  {h.isVested ? "Liquid" : "Unvested"}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={20}
                    step={0.5}
                    value={growthRates[h.id] ?? 7}
                    onChange={(e) =>
                      onGrowthRateChange(h.id, parseFloat(e.target.value))
                    }
                    className="h-1.5 w-20 accent-primary"
                  />
                  <span className="w-12 text-right font-mono text-xs tabular-nums">
                    {(growthRates[h.id] ?? 7).toFixed(1)}%
                  </span>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

// ---- Projection calculation ------------------------------------------------

type ProjectionPoint = {
  label: string;
  liquid: number;
  withUnvested: number;
};

type ProjectionTableRow = {
  year: number;
  quarters: [number | null, number | null, number | null, number | null];
  yearEnd: number | null;
  yoy: number | null;
};

function computeProjection(
  holdings: PortfolioHolding[],
  growthRates: Record<string, number>,
  includeUnvested: boolean,
) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentQuarter = Math.floor(now.getMonth() / 3);
  const QUARTERS = 20; // 5 years

  const holdingData = holdings.map((h) => {
    const annualRate = (growthRates[h.id] ?? 7) / 100;
    const quarterlyRate = Math.pow(1 + annualRate, 0.25) - 1;
    let vestQuarterOffset = -1;
    if (h.vestDate) {
      const vd = new Date(h.vestDate);
      const yDiff = vd.getFullYear() - currentYear;
      const qDiff = Math.floor(vd.getMonth() / 3) - currentQuarter;
      vestQuarterOffset = yDiff * 4 + qDiff;
    }
    return {
      value: h.currentValue,
      quarterlyRate,
      vested: h.isVested,
      vestQuarterOffset,
    };
  });

  const points: ProjectionPoint[] = [];
  const quarterValues: { year: number; quarter: number; value: number }[] = [];

  for (let q = 0; q <= QUARTERS; q++) {
    let liquidTotal = 0;
    let unvestedTotal = 0;
    for (const hd of holdingData) {
      const grownValue = hd.value * Math.pow(1 + hd.quarterlyRate, q);
      const vestedByQ =
        hd.vested || (hd.vestQuarterOffset >= 0 && q >= hd.vestQuarterOffset);
      if (vestedByQ) liquidTotal += grownValue;
      else unvestedTotal += grownValue;
    }
    const totalQ = (currentQuarter + q) % 4;
    const totalY = currentYear + Math.floor((currentQuarter + q) / 4);
    const label = `${totalY} Q${totalQ + 1}`;
    points.push({
      label,
      liquid: Math.round(liquidTotal),
      withUnvested: Math.round(liquidTotal + unvestedTotal),
    });
    quarterValues.push({
      year: totalY,
      quarter: totalQ,
      value: Math.round(
        includeUnvested
          ? liquidTotal + unvestedTotal
          : liquidTotal,
      ),
    });
  }

  // Build yearly table
  const years = Array.from(
    new Set(quarterValues.map((qv) => qv.year)),
  ).sort();
  const tableRows: ProjectionTableRow[] = [];
  let prevYearEnd: number | null = null;
  for (const year of years) {
    const qs = quarterValues.filter((qv) => qv.year === year);
    const quarters: [number | null, number | null, number | null, number | null] = [
      null,
      null,
      null,
      null,
    ];
    for (const qv of qs) quarters[qv.quarter] = qv.value;
    const yearEnd = quarters[3] ?? quarters[2] ?? quarters[1] ?? quarters[0];
    const yoy =
      prevYearEnd != null && yearEnd != null && prevYearEnd > 0
        ? ((yearEnd - prevYearEnd) / prevYearEnd) * 100
        : null;
    tableRows.push({ year, quarters, yearEnd, yoy });
    if (yearEnd != null) prevYearEnd = yearEnd;
  }

  return { points, table: tableRows };
}

const TOOLTIP_STYLE: React.CSSProperties = {
  background: "#2a2a2a",
  border: "1px solid #3a3a3a",
  borderRadius: 8,
  fontSize: 12,
  color: "#e5e5e5",
};
