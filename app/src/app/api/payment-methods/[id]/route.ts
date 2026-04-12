import { z } from "zod";
import { fail, handle } from "@/lib/api";
import { deletePaymentMethod, getPaymentMethodById, updatePaymentMethod } from "@/lib/db/repos/payment-methods";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const row = await getPaymentMethodById(id);
    if (!row) return fail("Not found", 404);
    return { method: row };
  });
}

export async function PATCH(request: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const body = z.object({ name: z.string().min(1).max(100) }).parse(await request.json());
    const row = await updatePaymentMethod(id, body.name);
    if (!row) return fail("Not found", 404);
    return { method: row };
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const ok = await deletePaymentMethod(id);
    if (!ok) return fail("Not found", 404);
    return { deleted: true };
  });
}
