import { z } from "zod";
import { handle } from "@/lib/api";
import { createSpendingPublic, listSpending } from "@/lib/db/repos/spending";
import { requireAuth } from "@/lib/auth";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

const createSchema = z.object({
  transaction: z.string().max(500).nullable().optional(),
  amount: z.number().finite(),
  currency: z.string().min(1).max(8),
  categoryId: z.string().uuid(),
  chargeDate: isoDate,
  moneyDate: isoDate.nullable().optional(),
  method: z.string().max(50).nullable().optional(),
  spendName: z.string().max(200).nullable().optional(),
  status: z.string().max(32).nullable().optional(),
  fxRate: z.number().positive().nullable().optional(),
});

export async function GET(request: Request) {
  return handle(async () => {
    const url = new URL(request.url);
    const year = url.searchParams.get("year");
    const month = url.searchParams.get("month");
    const category = url.searchParams.get("category");
    const rows = await listSpending({
      year: year ? Number(year) : undefined,
      month: month ? Number(month) : undefined,
      categoryId: category ?? undefined,
    });
    return { spending: rows, count: rows.length };
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const body = createSchema.parse(await request.json());
    // Public — no auth required so /quick-spend works without login.
    const row = await createSpendingPublic(body);
    return { spending: row };
  });
}
