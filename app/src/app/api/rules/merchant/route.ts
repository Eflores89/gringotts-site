import { z } from "zod";
import { handle } from "@/lib/api";
import {
  createMerchantRule,
  listMerchantRules,
} from "@/lib/db/repos/rules";

const createSchema = z.object({
  pattern: z.string().min(1).max(200),
  spendId: z.string().min(1).max(64),
  source: z.enum(["seed", "user"]).optional(),
});

export async function GET() {
  return handle(async () => {
    const rows = await listMerchantRules();
    return { rules: rows, count: rows.length };
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const body = createSchema.parse(await request.json());
    const row = await createMerchantRule(body);
    return { rule: row };
  });
}
