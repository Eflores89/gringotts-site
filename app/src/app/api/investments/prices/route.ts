import { handle } from "@/lib/api";
import {
  listPriceableInvestments,
  setCurrentPrice,
} from "@/lib/db/repos/investments";

const YAHOO = "https://query1.finance.yahoo.com/v8/finance/chart/";
const DELAY_MS = 400;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchPrice(ticker: string): Promise<number | null> {
  try {
    const url = `${YAHOO}${encodeURIComponent(ticker)}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Gringotts/1.0" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> };
    };
    const price = data.chart?.result?.[0]?.meta?.regularMarketPrice;
    return typeof price === "number" && price > 0 ? price : null;
  } catch {
    return null;
  }
}

type Detail = {
  ticker: string;
  status: "updated" | "skipped" | "failed";
  oldPrice?: number | null;
  newPrice?: number;
  reason?: string;
};

export async function POST() {
  return handle(async () => {
    const rows = await listPriceableInvestments();
    const today = new Date().toISOString().slice(0, 10);

    let updated = 0;
    let failed = 0;
    let skipped = 0;
    const details: Detail[] = [];

    for (const inv of rows) {
      const ticker = inv.ticker?.trim();
      if (!ticker) {
        skipped++;
        continue;
      }
      if (inv.lastPriceUpdate === today) {
        skipped++;
        details.push({
          ticker,
          status: "skipped",
          reason: "Already updated today",
        });
        continue;
      }
      const price = await fetchPrice(ticker);
      if (price == null) {
        failed++;
        details.push({
          ticker,
          status: "failed",
          reason: "No price from Yahoo Finance",
        });
      } else {
        try {
          await setCurrentPrice(inv.id, price, today);
          updated++;
          details.push({
            ticker,
            status: "updated",
            oldPrice: inv.currentPrice,
            newPrice: price,
          });
        } catch (err) {
          failed++;
          details.push({
            ticker,
            status: "failed",
            reason: err instanceof Error ? err.message : "DB update failed",
          });
        }
      }
      await sleep(DELAY_MS);
    }

    return {
      updated,
      failed,
      skipped,
      total: rows.length,
      details,
    };
  });
}
