import { z } from "zod";
import { handle } from "@/lib/api";
import {
  clearGraphPositions,
  saveGraphPositions,
} from "@/lib/db/repos/controllership";

const positionsSchema = z.object({
  positions: z.array(
    z.object({
      nodeId: z.string().min(1),
      x: z.number(),
      y: z.number(),
    }),
  ),
});

export async function POST(request: Request) {
  return handle(async () => {
    const body = positionsSchema.parse(await request.json());
    await saveGraphPositions(body.positions);
    return { saved: body.positions.length };
  });
}

export async function DELETE() {
  return handle(async () => {
    await clearGraphPositions();
    return { cleared: true };
  });
}
