import { z } from "zod";
import { handle } from "@/lib/api";
import {
  clearEdgeWaypoints,
  saveEdgeWaypoints,
} from "@/lib/db/repos/controllership";

const point = z.object({ x: z.number(), y: z.number() });
const schema = z.object({
  waypoints: z.record(z.string(), z.array(point)),
});

export async function POST(request: Request) {
  return handle(async () => {
    const body = schema.parse(await request.json());
    await saveEdgeWaypoints(body.waypoints);
    return { saved: Object.keys(body.waypoints).length };
  });
}

export async function DELETE() {
  return handle(async () => {
    await clearEdgeWaypoints();
    return { cleared: true };
  });
}
