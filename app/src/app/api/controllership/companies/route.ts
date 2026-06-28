import { z } from "zod";
import { handle } from "@/lib/api";
import { createCompany } from "@/lib/db/repos/controllership";

// Empty string from a <Select>/<Input> → null.
const optStr = z
  .string()
  .nullish()
  .transform((v) => (v ? v : null));

export const companySchema = z.object({
  name: z.string().min(1).max(120),
  code: z.string().min(1).max(40),
  jurisdictionId: optStr,
  entityType: optStr,
  functionalCurrency: optStr,
  investmentIds: z.array(z.string()).optional(),
  notes: optStr,
});

export async function POST(request: Request) {
  return handle(async () => {
    const body = companySchema.parse(await request.json());
    const row = await createCompany(body);
    return { company: row };
  });
}
