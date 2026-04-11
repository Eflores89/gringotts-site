import { z } from "zod";
import { handle } from "@/lib/api";
import { createBudget, listBudget } from "@/lib/db/repos/budget";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const createSchema = z.object({
  transaction: z.string().max(500).nullable().optional(),
  amount: z.number().finite(),
  currency: z.string().min(1).max(8),
  categoryId: z.string().uuid(),
  chargeDate: isoDate,
  status: z.string().max(32).nullable().optional(),
});

export async function GET(request: Request) {
  return handle(async () => {
    const url = new URL(request.url);
    const year = url.searchParams.get("year");
    const month = url.searchParams.get("month");
    const category = url.searchParams.get("category");
    const rows = await listBudget({
      year: year ? Number(year) : undefined,
      month: month ? Number(month) : undefined,
      categoryId: category ?? undefined,
    });
    return { budget: rows, count: rows.length };
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const body = createSchema.parse(await request.json());
    const row = await createBudget(body);
    return { budget: row };
  });
}
