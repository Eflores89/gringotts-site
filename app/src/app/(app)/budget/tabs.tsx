"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BudgetSpendList } from "./BudgetSpendList";
import { BudgetIncomeList } from "./BudgetIncomeList";
import { BudgetVsSpending } from "@/components/dashboard/BudgetVsSpending";

type Tab = "rollup" | "spend" | "income";

export function BudgetTabs() {
  const [tab, setTab] = useState<Tab>("rollup");
  const newHref = tab === "income" ? "/budget/income/new" : "/budget/new";
  const newLabel = tab === "income" ? "New income" : "New entry";

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v as Tab)}
      className="space-y-6"
    >
      <div className="flex items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="rollup">Rollup</TabsTrigger>
          <TabsTrigger value="spend">Spend</TabsTrigger>
          <TabsTrigger value="income">Income</TabsTrigger>
        </TabsList>
        {tab !== "rollup" && (
          <Button asChild size="sm">
            <Link href={newHref}>
              <Plus className="size-4" />
              {newLabel}
            </Link>
          </Button>
        )}
      </div>
      <TabsContent value="rollup">
        <BudgetVsSpending year={new Date().getFullYear()} />
      </TabsContent>
      <TabsContent value="spend">
        <BudgetSpendList />
      </TabsContent>
      <TabsContent value="income">
        <BudgetIncomeList />
      </TabsContent>
    </Tabs>
  );
}
