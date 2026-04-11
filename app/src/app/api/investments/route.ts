import { z } from "zod";
import { handle } from "@/lib/api";
import {
  createInvestment,
  listInvestments,
} from "@/lib/db/repos/investments";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const createSchema = z.object({
  name: z.string().min(1).max(200),
  ticker: z.string().max(32).nullable().optional(),
  quantity: z.number().nullable().optional(),
  purchasePrice: z.number().nullable().optional(),
  purchaseDate: isoDate.nullable().optional(),
  currentPrice: z.number().nullable().optional(),
  currency: z.string().max(8).nullable().optional(),
  assetType: z.string().max(32).nullable().optional(),
  vestDate: isoDate.nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  annualGrowthRate: z.number().nullable().optional(),
});

export async function GET(request: Request) {
  return handle(async () => {
    const url = new URL(request.url);
    const rows = await listInvestments({
      assetType: url.searchParams.get("asset_type") ?? undefined,
      currency: url.searchParams.get("currency") ?? undefined,
      vestedOnly: url.searchParams.get("vested_only") === "true",
    });
    return { investments: rows, count: rows.length };
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const body = createSchema.parse(await request.json());
    const row = await createInvestment(body);
    return { investment: row };
  });
}
