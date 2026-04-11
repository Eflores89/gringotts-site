import { z } from "zod";
import { handle } from "@/lib/api";
import {
  createAllocation,
  listAllocations,
} from "@/lib/db/repos/allocations";

const createSchema = z.object({
  name: z.string().max(200).nullable().optional(),
  allocationType: z.string().max(32).nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  percentage: z.number().min(0).max(100).nullable().optional(),
  investmentIds: z.array(z.string().uuid()).default([]),
});

export async function GET(request: Request) {
  return handle(async () => {
    const url = new URL(request.url);
    const investmentId = url.searchParams.get("investment_id") ?? undefined;
    const allocationType = url.searchParams.get("allocation_type") ?? undefined;
    const rows = await listAllocations({ investmentId, allocationType });
    return { allocations: rows, count: rows.length };
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const body = createSchema.parse(await request.json());
    const row = await createAllocation(body);
    return { allocation: row };
  });
}
