import { z } from "zod";
import { handle } from "@/lib/api";
import { createPaymentMethod, listPaymentMethods } from "@/lib/db/repos/payment-methods";

export async function GET() {
  return handle(async () => {
    const rows = await listPaymentMethods();
    return { methods: rows, count: rows.length };
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const body = z.object({ name: z.string().min(1).max(100) }).parse(await request.json());
    const row = await createPaymentMethod(body.name);
    return { method: row };
  });
}
