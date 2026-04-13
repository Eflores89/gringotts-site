"use client";

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

export type CategorySlice = {
  name: string;
  value: number;
};

const COLORS = [
  "#34d399", // emerald
  "#f59e0b", // amber
  "#3b82f6", // blue
  "#ef4444", // red
  "#a855f7", // purple
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
];

const eur = (v: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v);

export function CategoryPieChart({ data }: { data: CategorySlice[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
        No data
      </div>
    );
  }
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={90}
            innerRadius={50}
            paddingAngle={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "#2a2a2a",
              border: "1px solid #3a3a3a",
              borderRadius: 8,
              fontSize: 12,
              color: "#e5e5e5",
            }}
            formatter={(v) => `€${eur(Number(v))}`}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, color: "#999" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
