import { z } from "zod";
import { fail, handle } from "@/lib/api";
import {
  deleteSpendeeRule,
  getSpendeeRuleById,
  updateSpendeeRule,
} from "@/lib/db/repos/rules";

const patchSchema = z.object({
  spendeeCategory: z.string().min(1).max(200).optional(),
  spendId: z.string().min(1).max(64).optional(),
  source: z.enum(["seed", "user"]).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const row = await getSpendeeRuleById(id);
    if (!row) return fail("Rule not found", 404);
    return { rule: row };
  });
}

export async function PATCH(request: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const body = patchSchema.parse(await request.json());
    const row = await updateSpendeeRule(id, body);
    if (!row) return fail("Rule not found", 404);
    return { rule: row };
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const ok = await deleteSpendeeRule(id);
    if (!ok) return fail("Rule not found", 404);
    return { deleted: true };
  });
}
