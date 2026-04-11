import { z } from "zod";
import { fail, handle } from "@/lib/api";
import {
  CategoryInUseError,
  deleteCategory,
  getCategoryById,
  updateCategory,
} from "@/lib/db/repos/categories";

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  spendName: z.string().max(200).nullable().optional(),
  spendId: z.string().max(64).nullable().optional(),
  spendGrp: z.string().max(100).nullable().optional(),
  spendLifegrp: z.string().max(100).nullable().optional(),
  status: z.string().max(32).nullable().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const row = await getCategoryById(id);
    if (!row) return fail("Category not found", 404);
    return { category: row };
  });
}

export async function PATCH(request: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const body = patchSchema.parse(await request.json());
    const row = await updateCategory(id, body);
    if (!row) return fail("Category not found", 404);
    return { category: row };
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    try {
      const ok = await deleteCategory(id);
      if (!ok) return fail("Category not found", 404);
      return { deleted: true };
    } catch (err) {
      if (err instanceof CategoryInUseError) {
        return fail(
          `Cannot delete: category has ${err.count} dependent row(s)`,
          409,
        );
      }
      throw err;
    }
  });
}
