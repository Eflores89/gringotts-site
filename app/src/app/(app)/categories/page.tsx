"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/common/PageHeader";
import {
  useCategories,
  useDeleteCategory,
} from "@/hooks/use-categories";

export default function CategoriesPage() {
  const { data, isLoading, isError, error } = useCategories();
  const del = useDeleteCategory();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function confirmDelete() {
    if (!confirmId) return;
    try {
      await del.mutateAsync(confirmId);
      toast.success("Category deleted");
      setConfirmId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  const rows = data?.categories ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        description="Full list of spend categories. Edit or delete as needed."
        actions={
          <Button asChild size="sm">
            <Link href="/categories/new">
              <Plus className="size-4" />
              New category
            </Link>
          </Button>
        }
      />

      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : isError ? (
          <div className="p-6">
            <p className="text-sm font-medium text-destructive">
              Failed to load categories
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Tag className="size-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">No categories yet</p>
            <p className="text-sm text-muted-foreground">
              Create one to get started.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Spend ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Spend name</TableHead>
                <TableHead>Group</TableHead>
                <TableHead>Lifecycle</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[120px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {c.spendId ?? "—"}
                  </TableCell>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.spendName ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.spendGrp ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.spendLifegrp ?? "—"}
                  </TableCell>
                  <TableCell>
                    {c.status ? (
                      <Badge variant="secondary">{c.status}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button asChild variant="ghost" size="icon">
                        <Link href={`/categories/${c.id}`} aria-label="Edit">
                          <Pencil className="size-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setConfirmId(c.id)}
                        aria-label="Delete"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={confirmId !== null} onOpenChange={(o) => !o && setConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete category?</DialogTitle>
            <DialogDescription>
              This cannot be undone. Categories referenced by spending, budget,
              or rules cannot be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirmId(null)}
              disabled={del.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={del.isPending}
            >
              {del.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
