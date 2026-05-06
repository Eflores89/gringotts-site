"use client";

import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRefreshPrices } from "@/hooks/use-investments";

export function RefreshPricesButton() {
  const refresh = useRefreshPrices();
  async function onRefresh() {
    try {
      const res = await refresh.mutateAsync();
      toast.success(
        `Prices: ${res.updated} updated, ${res.skipped} skipped, ${res.failed} failed`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Refresh failed");
    }
  }
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onRefresh}
      disabled={refresh.isPending}
    >
      <RefreshCw
        className={`size-4 ${refresh.isPending ? "animate-spin" : ""}`}
      />
      Refresh prices
    </Button>
  );
}
