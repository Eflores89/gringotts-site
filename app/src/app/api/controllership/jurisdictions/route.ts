import { z } from "zod";
import { handle } from "@/lib/api";
import { createJurisdiction } from "@/lib/db/repos/controllership";

const rate = z.number().nullable().optional();

export const jurisdictionSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(10),
  corporateTaxRate: rate,
  participationExemptionThreshold: rate,
  personalDividendRate: rate,
  personalCapitalGainsRate: rate,
});

export async function POST(request: Request) {
  return handle(async () => {
    const body = jurisdictionSchema.parse(await request.json());
    const row = await createJurisdiction(body);
    return { jurisdiction: row };
  });
}
