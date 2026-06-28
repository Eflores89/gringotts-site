import { z } from "zod";
import { handle } from "@/lib/api";
import { createOwnership } from "@/lib/db/repos/controllership";

const optStr = z
  .string()
  .nullish()
  .transform((v) => (v ? v : null));
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const ownershipBase = z.object({
  ownerCompanyId: optStr, // null = principal (you)
  ownedCompanyId: z.string().min(1),
  percentage: z.number().min(0).max(100),
  effectiveFrom: isoDate,
  effectiveTo: isoDate.nullish().transform((v) => (v ? v : null)),
  notes: optStr,
});

export const ownershipSchema = ownershipBase.refine(
  (d) => d.ownerCompanyId !== d.ownedCompanyId,
  { message: "A company cannot own itself", path: ["ownedCompanyId"] },
);

export async function POST(request: Request) {
  return handle(async () => {
    const body = ownershipSchema.parse(await request.json());
    const row = await createOwnership(body);
    return { ownership: row };
  });
}
