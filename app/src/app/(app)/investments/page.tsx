import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { getPortfolioSummary } from "@/lib/investment-analytics";
import { InvestmentsTabs } from "./tabs";
import { RefreshPricesButton } from "./RefreshPricesButton";

export const dynamic = "force-dynamic";

export default async function InvestmentsPage() {
  const portfolio = await getPortfolioSummary();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Investments"
        description="Portfolio resumen plus the holdings list."
        actions={
          <>
            <RefreshPricesButton />
            <Button asChild size="sm">
              <Link href="/investments/new">
                <Plus className="size-4" />
                New holding
              </Link>
            </Button>
          </>
        }
      />
      <InvestmentsTabs portfolioData={portfolio} />
    </div>
  );
}
