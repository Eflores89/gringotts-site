"use client";

import { useMemo, useState } from "react";
import type { SortState } from "@/components/common/SortableHead";
import { cycleSortState } from "@/components/common/SortableHead";

type Accessor<T, K extends string> = (item: T, key: K) => string | number | null;

export function useSort<T, K extends string>(
  rows: T[],
  accessor: Accessor<T, K>,
) {
  const [sort, setSort] = useState<SortState<K>>(null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    return [...rows].sort((a, b) => {
      const av = accessor(a, sort.key) ?? "";
      const bv = accessor(b, sort.key) ?? "";
      if (av < bv) return sort.dir === "asc" ? -1 : 1;
      if (av > bv) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
  }, [rows, sort, accessor]);

  function toggle(key: K) {
    setSort((prev) => cycleSortState(prev, key));
  }

  return { sorted, sort, toggle };
}
