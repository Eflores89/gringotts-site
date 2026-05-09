"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BudgetSpendList } from "./BudgetSpendList";
import { BudgetIncomeList } from "./BudgetIncomeList";

export function BudgetTabs() {
  const [tab, setTab] = useState<"spend" | "income">("spend");
  const newHref = tab === "spend" ? "/budget/new" : "/budget/income/new";
  const newLabel = tab === "spend" ? "New entry" : "New income";

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v as "spend" | "income")}
      className="space-y-6"
    >
      <div className="flex items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="spend">Spend</TabsTrigger>
          <TabsTrigger value="income">Income</TabsTrigger>
        </TabsList>
        <Button asChild size="sm">
          <Link href={newHref}>
            <Plus className="size-4" />
            {newLabel}
          </Link>
        </Button>
      </div>
      <TabsContent value="spend">
        <BudgetSpendList />
      </TabsContent>
      <TabsContent value="income">
        <BudgetIncomeList />
      </TabsContent>
    </Tabs>
  );
}
