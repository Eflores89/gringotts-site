import { handle } from "@/lib/api";
import { getCategoryDrillDown } from "@/lib/db/repos/budget-vs-spending";

export async function GET(request: Request) {
  return handle(async () => {
    const url = new URL(request.url);
    const categoryId = url.searchParams.get("categoryId");
    if (!categoryId) return { items: [] };
    const year = Number(url.searchParams.get("year") ?? new Date().getFullYear());
    const monthStr = url.searchParams.get("month");
    const month = monthStr ? Number(monthStr) : undefined;
    const data = await getCategoryDrillDown(categoryId, year, month);
    return data;
  });
}
