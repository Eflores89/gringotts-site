import { z } from "zod";
import { handle } from "@/lib/api";
import { createIncome, listIncome } from "@/lib/db/repos/income";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const createSchema = z.object({
  description: z.string().max(500).nullable().optional(),
  amount: z.number().finite(),
  currency: z.string().min(1).max(8),
  chargeDate: isoDate,
  source: z.string().max(100).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  fxRate: z.number().positive().nullable().optional(),
});

export async function GET(request: Request) {
  return handle(async () => {
    const url = new URL(request.url);
    const year = url.searchParams.get("year");
    const month = url.searchParams.get("month");
    const rows = await listIncome({
      year: year ? Number(year) : undefined,
      month: month ? Number(month) : undefined,
    });
    return { income: rows, count: rows.length };
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const body = createSchema.parse(await request.json());
    const row = await createIncome(body);
    return { income: row };
  });
}
