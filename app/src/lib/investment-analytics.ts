import "server-only";
import { db } from "@/db/client";
import {
  allocations,
  allocationInvestments,
  investments,
} from "@/db/schema";
import { requireAuth } from "./auth";
import { FX_TO_EUR } from "./fx";

export type InvestmentRow = typeof investments.$inferSelect;

export type PortfolioHolding = {
  id: string;
  name: string;
  ticker: string | null;
  assetType: string | null;
  currency: string | null;
  quantity: number;
  purchasePrice: number;
  currentPrice: number;
  purchaseDate: string | null;
  vestDate: string | null;
  annualGrowthRate: number | null;
  costBasis: number;
  currentValue: number;
  gainLoss: number;
  returnPct: number;
  isVested: boolean;
};

export type AllocationSlice = {
  category: string;
  percentage: number;
};

export type PortfolioSummary = {
  holdings: PortfolioHolding[];
  totalValue: number;
  totalCost: number;
  totalGainLoss: number;
  totalReturnPct: number;
  liquidValue: number;
  unvestedValue: number;
  byAssetType: { name: string; value: number }[];
  industryAllocations: AllocationSlice[];
  geographyAllocations: AllocationSlice[];
  monthlyHistory: { label: string; value: number }[];
};

function fxRate(currency: string | null): number {
  return FX_TO_EUR[(currency ?? "EUR").toUpperCase()] ?? 1;
}

function isVested(vestDate: string | null): boolean {
  if (!vestDate) return true;
  return new Date(vestDate) <= new Date();
}

export async function getPortfolioSummary(): Promise<PortfolioSummary> {
  await requireAuth();

  const invRows = await db.select().from(investments);
  const allocRows = await db.select().from(allocations);
  const linkRows = await db.select().from(allocationInvestments);

  const today = new Date();

  const holdings: PortfolioHolding[] = invRows.map((inv) => {
    const rate = fxRate(inv.currency);
    const qty = inv.quantity ?? 0;
    const pp = inv.purchasePrice ?? 0;
    const cp = inv.currentPrice ?? pp;
    const costBasis = qty * pp * rate;
    const currentValue = qty * cp * rate;
    const gainLoss = currentValue - costBasis;
    const returnPct = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;
    return {
      id: inv.id,
      name: inv.name,
      ticker: inv.ticker,
      assetType: inv.assetType,
      currency: inv.currency,
      quantity: qty,
      purchasePrice: pp,
      currentPrice: cp,
      purchaseDate: inv.purchaseDate,
      vestDate: inv.vestDate,
      annualGrowthRate: inv.annualGrowthRate,
      costBasis,
      currentValue,
      gainLoss,
      returnPct,
      isVested: isVested(inv.vestDate),
    };
  });

  const totalValue = holdings.reduce((s, h) => s + h.currentValue, 0);
  const totalCost = holdings.reduce((s, h) => s + h.costBasis, 0);
  const totalGainLoss = totalValue - totalCost;
  const totalReturnPct = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;
  const liquidValue = holdings
    .filter((h) => h.isVested)
    .reduce((s, h) => s + h.currentValue, 0);
  const unvestedValue = totalValue - liquidValue;

  // By asset type
  const assetMap = new Map<string, number>();
  for (const h of holdings) {
    const key = h.assetType ?? "Other";
    assetMap.set(key, (assetMap.get(key) ?? 0) + h.currentValue);
  }
  const byAssetType = Array.from(assetMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Build allocation link map: allocationId → investmentId[]
  const allocInvMap = new Map<string, string[]>();
  for (const l of linkRows) {
    const arr = allocInvMap.get(l.allocationId) ?? [];
    arr.push(l.investmentId);
    allocInvMap.set(l.allocationId, arr);
  }

  // Weighted allocation calculation
  function calcWeighted(type: string): AllocationSlice[] {
    if (totalValue === 0) return [];
    const weighted = new Map<string, number>();
    for (const h of holdings) {
      const weight = h.currentValue / totalValue;
      const invAllocs = allocRows.filter((a) => {
        if ((a.allocationType ?? "").toLowerCase() !== type) return false;
        const linked = allocInvMap.get(a.id) ?? [];
        return linked.includes(h.id);
      });
      if (invAllocs.length === 0) {
        weighted.set(
          "Unclassified",
          (weighted.get("Unclassified") ?? 0) + weight * 100,
        );
      } else {
        for (const a of invAllocs) {
          const cat = a.category ?? "Other";
          weighted.set(
            cat,
            (weighted.get(cat) ?? 0) + weight * (a.percentage ?? 0),
          );
        }
      }
    }
    return Array.from(weighted.entries())
      .filter(([, v]) => v > 0.1)
      .map(([category, percentage]) => ({ category, percentage }))
      .sort((a, b) => b.percentage - a.percentage);
  }

  const industryAllocations = calcWeighted("industry");
  const geographyAllocations = calcWeighted("geography");

  // Monthly history: approximate from purchase dates to now using cost basis
  const monthlyHistory: { label: string; value: number }[] = [];
  const earliest = holdings
    .map((h) => h.purchaseDate)
    .filter(Boolean)
    .sort()[0];
  if (earliest) {
    const start = new Date(earliest);
    start.setDate(1);
    const cursor = new Date(start);
    while (cursor <= today) {
      const label = cursor.toISOString().slice(0, 7);
      let value = 0;
      for (const h of holdings) {
        if (!h.purchaseDate || new Date(h.purchaseDate) > cursor) continue;
        const isCurrent =
          cursor.getFullYear() === today.getFullYear() &&
          cursor.getMonth() === today.getMonth();
        value += isCurrent ? h.currentValue : h.costBasis;
      }
      monthlyHistory.push({ label, value });
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  return {
    holdings,
    totalValue,
    totalCost,
    totalGainLoss,
    totalReturnPct,
    liquidValue,
    unvestedValue,
    byAssetType,
    industryAllocations,
    geographyAllocations,
    monthlyHistory,
  };
}
