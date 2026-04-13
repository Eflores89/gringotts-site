"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type MonthPoint = {
  mm: number;
  spending: number;
  budget: number;
};

const MONTHS = [
  "Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec",
];

const eur = (v: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v);

export function TrendChart({ data }: { data: MonthPoint[] }) {
  const points = data.map((d) => ({
    name: MONTHS[(d.mm ?? 1) - 1] ?? "—",
    Spending: Math.round(d.spending),
    Budget: Math.round(d.budget),
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <BarChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#3a3a3a" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="name"
            stroke="#999"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#999"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `€${eur(v)}`}
          />
          <Tooltip
            cursor={{ fill: "#404040" }}
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
          <Bar dataKey="Budget" fill="#facc15" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Spending" fill="#34d399" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
