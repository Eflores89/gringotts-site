"use client";

import dynamic from "next/dynamic";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PortfolioSummary } from "@/lib/investment-analytics";
import { InvestmentsList } from "./InvestmentsList";

const InvestmentDashboard = dynamic(
  () =>
    import("@/components/dashboard/InvestmentDashboard").then(
      (m) => m.InvestmentDashboard,
    ),
  { ssr: false, loading: () => <div className="h-96 w-full" /> },
);

export function InvestmentsTabs({
  portfolioData,
}: {
  portfolioData: PortfolioSummary;
}) {
  return (
    <Tabs defaultValue="resumen" className="space-y-6">
      <TabsList>
        <TabsTrigger value="resumen">Resumen</TabsTrigger>
        <TabsTrigger value="lista">Lista</TabsTrigger>
      </TabsList>
      <TabsContent value="resumen">
        <InvestmentDashboard data={portfolioData} />
      </TabsContent>
      <TabsContent value="lista">
        <InvestmentsList />
      </TabsContent>
    </Tabs>
  );
}
