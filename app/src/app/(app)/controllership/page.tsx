import { getControllershipGraph } from "@/lib/db/repos/controllership";
import { ControllershipGraph } from "./ControllershipGraph";

export const dynamic = "force-dynamic";

export default async function ControllershipPage() {
  const graph = await getControllershipGraph();
  return <ControllershipGraph graph={graph} />;
}
