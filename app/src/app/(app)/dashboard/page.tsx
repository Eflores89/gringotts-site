import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/common/PageHeader";
import type { MonthPoint } from "@/components/dashboard/TrendChart";
import type { CategorySlice } from "@/components/dashboard/CategoryPieChart";
import {
  DashboardCategoryPie,
  DashboardTrendChart,
} from "@/components/dashboard/DashboardCharts";
import { listCategories } from "@/lib/db/repos/categories";
import {
  sumSpendingByCategory,
  sumSpendingByMonth,
} from "@/lib/db/repos/spending";
import { sumBudgetByMonth } from "@/lib/db/repos/budget";
import { getPortfolioSummary } from "@/lib/investment-analytics";
import { formatMoney } from "@/lib/format";
import { BudgetVsSpending } from "@/components/dashboard/BudgetVsSpending";
import { DashboardTabs } from "./tabs";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const year = new Date().getFullYear();
  const [spendByMonth, budgetByMonth, spendByCat, cats, portfolio] =
    await Promise.all([
      sumSpendingByMonth(year),
      sumBudgetByMonth(year),
      sumSpendingByCategory(year),
      listCategories(),
      getPortfolioSummary(),
    ]);

  // Merge spending + budget into one MonthPoint[] keyed on mm.
  const monthMap = new Map<number, MonthPoint>();
  for (let i = 1; i <= 12; i++) {
    monthMap.set(i, { mm: i, spending: 0, budget: 0 });
  }
  for (const r of spendByMonth) {
    if (r.mm == null) continue;
    monthMap.get(r.mm)!.spending = Number(r.total ?? 0);
  }
  for (const r of budgetByMonth) {
    if (r.mm == null) continue;
    monthMap.get(r.mm)!.budget = Number(r.total ?? 0);
  }
  const trend: MonthPoint[] = Array.from(monthMap.values());

  const ytdSpending = trend.reduce((s, p) => s + p.spending, 0);
  const ytdBudget = trend.reduce((s, p) => s + p.budget, 0);
  const currentMonth = new Date().getMonth() + 1;
  const thisMonth = trend.find((p) => p.mm === currentMonth);

  const catName = new Map<string, string>();
  cats.forEach((c) => catName.set(c.id, c.name));
  const catSlices = spendByCat
    .map((r) => ({
      name: catName.get(r.categoryId) ?? "Unknown",
      value: Number(r.total ?? 0),
    }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value);
  const TOP = 8;
  const top: CategorySlice[] = catSlices.slice(0, TOP);
  if (catSlices.length > TOP) {
    const rest = catSlices.slice(TOP).reduce((s, x) => s + x.value, 0);
    top.push({ name: `Other (${catSlices.length - TOP})`, value: rest });
  }

  const spendingTab = (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="YTD spending"
          value={formatMoney(ytdSpending, "EUR")}
        />
        <StatCard label="YTD budget" value={formatMoney(ytdBudget, "EUR")} />
        <StatCard
          label="This month spending"
          value={formatMoney(thisMonth?.spending ?? 0, "EUR")}
        />
        <StatCard
          label="Difference"
          value={formatMoney(ytdBudget - ytdSpending, "EUR")}
          tone={ytdBudget - ytdSpending >= 0 ? "good" : "bad"}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              Spending vs budget by month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DashboardTrendChart data={trend} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Spending by category (YTD)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DashboardCategoryPie data={top} />
          </CardContent>
        </Card>
      </div>
      <BudgetVsSpending year={year} />
    </>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Year-to-date overview for ${year}.`}
      />
      <DashboardTabs
        spendingContent={spendingTab}
        portfolioData={portfolio}
      />
    </div>
  );
}

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
