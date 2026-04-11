import { z } from "zod";
import { handle } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { categorizeRows } from "@/lib/categorizer";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const rowSchema = z.object({
  transaction: z.string().max(500),
  amount: z.number().nonnegative(),
  currency: z.string().min(1).max(8),
  chargeDate: isoDate,
  spendeeCategory: z.string().max(200).default(""),
  method: z.string().max(100).default(""),
  sourceFile: z.string().max(255).default(""),
});

const bodySchema = z.object({
  rows: z.array(rowSchema).min(1).max(2000),
});

export async function POST(request: Request) {
  return handle(async () => {
    await requireAuth();
    const body = bodySchema.parse(await request.json());
    const previews = await categorizeRows(body.rows);
    return { rows: previews, count: previews.length };
  });
}
