"use client";

import Link from "next/link";
import { ExternalLink, PieChart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAllocations } from "@/hooks/use-allocations";

export function InvestmentAllocationsPanel({
  investmentId,
}: {
  investmentId: string;
}) {
  const { data, isLoading } = useAllocations({ investmentId });
  const rows = data?.allocations ?? [];

  return (
    <Card className="max-w-3xl">
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="text-base">Allocations</CardTitle>
          <p className="text-sm text-muted-foreground">
            Industry/geography splits this holding belongs to.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/allocations">
            <ExternalLink className="size-4" />
            Manage all
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <PieChart className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No allocations link to this investment yet.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map(({ allocation }) => (
              <li
                key={allocation.id}
                className="flex items-center justify-between gap-4 py-3"
              >
                <div className="flex items-center gap-3">
                  {allocation.allocationType ? (
                    <Badge variant="outline">{allocation.allocationType}</Badge>
                  ) : null}
                  <span className="font-medium">{allocation.category ?? "—"}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm tabular-nums">
                    {allocation.percentage != null
                      ? `${allocation.percentage}%`
                      : "—"}
                  </span>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/allocations/${allocation.id}`}>Edit</Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
