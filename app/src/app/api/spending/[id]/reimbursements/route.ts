import { z } from "zod";
import { handle } from "@/lib/api";
import {
  createReimbursement,
  listReimbursements,
} from "@/lib/db/repos/reimbursements";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const createSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().min(1).max(8),
  description: z.string().max(500).nullable().optional(),
  reimbursedDate: isoDate.nullable().optional(),
  fxRate: z.number().positive().nullable().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const rows = await listReimbursements(id);
    return { reimbursements: rows, count: rows.length };
  });
}

export async function POST(request: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const body = createSchema.parse(await request.json());
    const row = await createReimbursement({ ...body, spendingId: id });
    return { reimbursement: row };
  });
}
