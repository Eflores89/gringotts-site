"use client";

import dynamic from "next/dynamic";
import type { MonthPoint } from "./TrendChart";
import type { CategorySlice } from "./CategoryPieChart";

const TrendChart = dynamic(() => import("./TrendChart").then((m) => m.TrendChart), {
  ssr: false,
  loading: () => <div className="h-72 w-full" />,
});

const CategoryPieChart = dynamic(
  () => import("./CategoryPieChart").then((m) => m.CategoryPieChart),
  { ssr: false, loading: () => <div className="h-72 w-full" /> },
);

export function DashboardTrendChart({ data }: { data: MonthPoint[] }) {
  return <TrendChart data={data} />;
}

export function DashboardCategoryPie({ data }: { data: CategorySlice[] }) {
  return <CategoryPieChart data={data} />;
}
