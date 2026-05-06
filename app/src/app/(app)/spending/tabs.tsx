"use client";

import { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SpendingList } from "./SpendingList";

export function SpendingTabs({
  resumenContent,
}: {
  resumenContent: ReactNode;
}) {
  return (
    <Tabs defaultValue="resumen" className="space-y-6">
      <TabsList>
        <TabsTrigger value="resumen">Resumen</TabsTrigger>
        <TabsTrigger value="entradas">Entradas</TabsTrigger>
      </TabsList>
      <TabsContent value="resumen" className="space-y-6">
        {resumenContent}
      </TabsContent>
      <TabsContent value="entradas">
        <SpendingList />
      </TabsContent>
    </Tabs>
  );
}
