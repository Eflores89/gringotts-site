import { handle } from "@/lib/api";
import { getBudgetVsSpending } from "@/lib/db/repos/budget-vs-spending";

export async function GET(request: Request) {
  return handle(async () => {
    const url = new URL(request.url);
    const year = Number(url.searchParams.get("year") ?? new Date().getFullYear());
    const monthStr = url.searchParams.get("month");
    const month = monthStr ? Number(monthStr) : undefined;
    const rows = await getBudgetVsSpending(year, month);
    return { rows, count: rows.length };
  });
}
