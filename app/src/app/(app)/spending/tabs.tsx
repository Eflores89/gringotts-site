"use client";

import { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SpendingList } from "./SpendingList";

export function SpendingTabs({
  resumenContent,
  cashFlowContent,
}: {
  resumenContent: ReactNode;
  cashFlowContent: ReactNode;
}) {
  return (
    <Tabs defaultValue="resumen" className="space-y-6">
      <TabsList>
        <TabsTrigger value="resumen">Resumen</TabsTrigger>
        <TabsTrigger value="cashflow">Cash flow</TabsTrigger>
        <TabsTrigger value="entradas">Entradas</TabsTrigger>
      </TabsList>
      <TabsContent value="resumen" className="space-y-6">
        {resumenContent}
      </TabsContent>
      <TabsContent value="cashflow" className="space-y-6">
        {cashFlowContent}
      </TabsContent>
      <TabsContent value="entradas">
        <SpendingList />
      </TabsContent>
    </Tabs>
  );
}
