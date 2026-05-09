import { PageHeader } from "@/components/common/PageHeader";
import { CashFlowReport } from "@/components/dashboard/CashFlowReport";
import { sumSpendingByDueMonth } from "@/lib/db/repos/spending";
import { sumBudgetByMonth } from "@/lib/db/repos/budget";
import { sumIncomeByMonth } from "@/lib/db/repos/income";

export const dynamic = "force-dynamic";

export default async function CashFlowPage() {
  const year = new Date().getFullYear();
  const [spendByDue, budgetByMonth, plannedIncome] = await Promise.all([
    sumSpendingByDueMonth(year),
    sumBudgetByMonth(year),
    sumIncomeByMonth(year, "planned"),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cash flow"
        description={`Monthly money in vs money out for ${year}, with a running balance.`}
      />
      <CashFlowReport
        year={year}
        spendOutRows={spendByDue.map((r) => ({
          mm: r.mm,
          total: Number(r.total ?? 0),
        }))}
        budgetOutRows={budgetByMonth.map((r) => ({
          mm: r.mm,
          total: Number(r.total ?? 0),
        }))}
        inRows={plannedIncome.map((r) => ({
          mm: r.mm,
          total: Number(r.total ?? 0),
        }))}
      />
    </div>
  );
}
