import { z } from "zod";
import { handle } from "@/lib/api";
import { createCategory, listCategoriesPublic } from "@/lib/db/repos/categories";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  spendName: z.string().max(200).optional().nullable(),
  spendId: z.string().max(64).optional().nullable(),
  spendGrp: z.string().max(100).optional().nullable(),
  spendLifegrp: z.string().max(100).optional().nullable(),
  status: z.string().max(32).optional().nullable(),
});

export async function GET(request: Request) {
  return handle(async () => {
    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? undefined;
    const rows = await listCategoriesPublic({ status });
    return { categories: rows, count: rows.length };
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const body = createSchema.parse(await request.json());
    const row = await createCategory(body);
    return { category: row };
  });
}
