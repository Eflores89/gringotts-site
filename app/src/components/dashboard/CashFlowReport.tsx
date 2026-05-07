import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/lib/format";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

type Row = { mm: number | null; total: number };

export function CashFlowReport({
  year,
  rows,
}: {
  year: number;
  rows: Row[];
}) {
  const byMm = new Map<number, number>();
  for (const r of rows) {
    if (r.mm == null) continue;
    byMm.set(r.mm, Number(r.total ?? 0));
  }

  const months = Array.from({ length: 12 }, (_, i) => ({
    mm: i + 1,
    label: MONTH_LABELS[i],
    total: byMm.get(i + 1) ?? 0,
  }));
  const total = months.reduce((s, m) => s + m.total, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cash flow ({year})</CardTitle>
        <p className="text-sm text-muted-foreground">
          Totals grouped by month of the due date. Spend date is used when
          there&apos;s no due date set.
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Month</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {months.map((m) => (
              <TableRow key={m.mm}>
                <TableCell className="font-medium">{m.label}</TableCell>
                <TableCell className="text-right font-mono">
                  {m.total === 0 ? "—" : formatMoney(m.total, "EUR")}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="border-t-2 border-border font-semibold">
              <TableCell>Total</TableCell>
              <TableCell className="text-right font-mono">
                {formatMoney(total, "EUR")}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
