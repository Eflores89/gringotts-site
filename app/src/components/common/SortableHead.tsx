"use client";

import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";

export type SortDir = "asc" | "desc";
export type SortState<K extends string> = { key: K; dir: SortDir } | null;

export function cycleSortState<K extends string>(
  prev: SortState<K>,
  key: K,
): SortState<K> {
  if (!prev || prev.key !== key) return { key, dir: "asc" };
  if (prev.dir === "asc") return { key, dir: "desc" };
  return null;
}

export function SortableHead<K extends string>({
  label,
  sortKey,
  sort,
  onClick,
  className,
}: {
  label: string;
  sortKey: K;
  sort: SortState<K>;
  onClick: (key: K) => void;
  className?: string;
}) {
  const active = sort?.key === sortKey;
  const Icon = !active
    ? ChevronsUpDown
    : sort.dir === "asc"
      ? ChevronUp
      : ChevronDown;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onClick(sortKey)}
        className={`flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground ${active ? "text-foreground" : ""}`}
      >
        <span>{label}</span>
        <Icon className="size-3" />
      </button>
    </TableHead>
  );
}
