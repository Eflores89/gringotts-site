"use client";

import { ReactNode } from "react";
import dynamic from "next/dynamic";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PortfolioSummary } from "@/lib/investment-analytics";

const InvestmentDashboard = dynamic(
  () =>
    import("@/components/dashboard/InvestmentDashboard").then(
      (m) => m.InvestmentDashboard,
    ),
  { ssr: false, loading: () => <div className="h-96 w-full" /> },
);

export function DashboardTabs({
  spendingContent,
  portfolioData,
}: {
  spendingContent: ReactNode;
  portfolioData: PortfolioSummary;
}) {
  return (
    <Tabs defaultValue="spending" className="space-y-6">
      <TabsList>
        <TabsTrigger value="spending">Spending</TabsTrigger>
        <TabsTrigger value="investments">Investments</TabsTrigger>
      </TabsList>
      <TabsContent value="spending" className="space-y-6">
        {spendingContent}
      </TabsContent>
      <TabsContent value="investments">
        <InvestmentDashboard data={portfolioData} />
      </TabsContent>
    </Tabs>
  );
}
