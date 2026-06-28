import { z } from "zod";
import { handle } from "@/lib/api";
import { createLoan } from "@/lib/db/repos/controllership";

const optStr = z
  .string()
  .nullish()
  .transform((v) => (v ? v : null));
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
  .nullish()
  .transform((v) => (v ? v : null));

export const loanBase = z.object({
  lenderCompanyId: optStr, // null = principal
  borrowerCompanyId: optStr, // null = principal
  principal: z.number().positive(),
  currency: z.string().min(1).max(10),
  interestRate: z.number().min(0).nullish().transform((v) => v ?? null),
  interestType: z.enum(["fixed", "variable"]).optional(),
  compounding: z.enum(["simple", "monthly", "annual"]).optional(),
  repaymentType: z
    .enum(["bullet", "amortizing", "interest_only", "on_demand"])
    .optional(),
  paymentFrequency: z
    .enum(["monthly", "quarterly", "annual", "at_end", "none"])
    .optional(),
  originationDate: isoDate,
  maturityDate: isoDate,
  status: z.enum(["draft", "active", "repaid", "defaulted"]).optional(),
  notes: optStr,
});

// A loan needs two distinct parties; at least one must be a company.
export const loanSchema = loanBase
  .refine((d) => d.lenderCompanyId !== d.borrowerCompanyId, {
    message: "Lender and borrower must differ",
    path: ["borrowerCompanyId"],
  })
  .refine((d) => d.lenderCompanyId != null || d.borrowerCompanyId != null, {
    message: "At least one party must be a company",
    path: ["borrowerCompanyId"],
  });

export async function POST(request: Request) {
  return handle(async () => {
    const body = loanSchema.parse(await request.json());
    const row = await createLoan(body);
    return { loan: row };
  });
}
