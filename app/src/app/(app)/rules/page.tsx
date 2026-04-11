"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Save, X, Sparkles } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/common/PageHeader";
import { useCategories } from "@/hooks/use-categories";
import {
  useCreateMerchantRule,
  useCreateSpendeeRule,
  useDeleteMerchantRule,
  useDeleteSpendeeRule,
  useMerchantRules,
  useSpendeeRules,
  useUpdateMerchantRule,
  useUpdateSpendeeRule,
} from "@/hooks/use-rules";
import type { Category } from "@/db/schema";

export default function RulesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Categorizer rules"
        description="Two-tier matcher used by the import wizard. Merchant patterns match transaction descriptions; Spendee categories are the fallback."
      />
      <Tabs defaultValue="merchant" className="space-y-4">
        <TabsList>
          <TabsTrigger value="merchant">Merchant rules</TabsTrigger>
          <TabsTrigger value="spendee">Spendee rules</TabsTrigger>
        </TabsList>
        <TabsContent value="merchant">
          <MerchantRulesTab />
        </TabsContent>
        <TabsContent value="spendee">
          <SpendeeRulesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function categoryLabel(c: Category): string {
  return c.spendId ? `[${c.spendId}] ${c.name}` : c.name;
}

function MerchantRulesTab() {
  const cats = useCategories();
  const { data, isLoading } = useMerchantRules();
  const create = useCreateMerchantRule();
  const update = useUpdateMerchantRule();
  const del = useDeleteMerchantRule();

  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPattern, setEditPattern] = useState("");
  const [editSpendId, setEditSpendId] = useState("");
  const [newPattern, setNewPattern] = useState("");
  const [newSpendId, setNewSpendId] = useState("");

  const spendIdOptions = useMemo(
    () =>
      (cats.data?.categories ?? [])
        .filter((c) => !!c.spendId)
        .sort((a, b) => (a.spendId ?? "").localeCompare(b.spendId ?? "")),
    [cats.data],
  );

  async function onCreate() {
    if (!newPattern || !newSpendId) return;
    try {
      await create.mutateAsync({ pattern: newPattern, spendId: newSpendId });
      toast.success("Rule added");
      setNewPattern("");
      setNewSpendId("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Add failed");
    }
  }

  async function onSaveEdit() {
    if (!editingId) return;
    try {
      await update.mutateAsync({
        id: editingId,
        patch: { pattern: editPattern, spendId: editSpendId },
      });
      toast.success("Rule saved");
      setEditingId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function confirmDelete() {
    if (!confirmId) return;
    try {
      await del.mutateAsync(confirmId);
      toast.success("Rule deleted");
      setConfirmId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">Merchant pattern</label>
            <Input
              value={newPattern}
              onChange={(e) => setNewPattern(e.target.value)}
              placeholder="mercadona"
              className="w-[260px]"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">Maps to category</label>
            <Select value={newSpendId} onValueChange={setNewSpendId}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {spendIdOptions.map((c) => (
                  <SelectItem key={c.spendId!} value={c.spendId!}>
                    {categoryLabel(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            onClick={onCreate}
            disabled={!newPattern || !newSpendId || create.isPending}
          >
            <Plus className="size-4" />
            Add rule
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : (data?.rules.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Sparkles className="size-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">No merchant rules yet</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pattern</TableHead>
                <TableHead>Spend ID</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="w-[140px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.rules ?? []).map((r) => {
                const isEditing = editingId === r.id;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-sm">
                      {isEditing ? (
                        <Input
                          value={editPattern}
                          onChange={(e) => setEditPattern(e.target.value)}
                        />
                      ) : (
                        r.pattern
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Select value={editSpendId} onValueChange={setEditSpendId}>
                          <SelectTrigger className="w-[260px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {spendIdOptions.map((c) => (
                              <SelectItem key={c.spendId!} value={c.spendId!}>
                                {categoryLabel(c)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className="font-mono">
                          {r.spendId}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.source === "user" ? "default" : "secondary"}>
                        {r.source}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {isEditing ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={onSaveEdit}
                              disabled={update.isPending}
                              aria-label="Save"
                            >
                              <Save className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingId(null)}
                              aria-label="Cancel"
                            >
                              <X className="size-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingId(r.id);
                                setEditPattern(r.pattern);
                                setEditSpendId(r.spendId);
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setConfirmId(r.id)}
                              aria-label="Delete"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={confirmId !== null} onOpenChange={(o) => !o && setConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete merchant rule?</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmId(null)}>
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

function SpendeeRulesTab() {
  const cats = useCategories();
  const { data, isLoading } = useSpendeeRules();
  const create = useCreateSpendeeRule();
  const update = useUpdateSpendeeRule();
  const del = useDeleteSpendeeRule();

  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState("");
  const [editSpendId, setEditSpendId] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newSpendId, setNewSpendId] = useState("");

  const spendIdOptions = useMemo(
    () =>
      (cats.data?.categories ?? [])
        .filter((c) => !!c.spendId)
        .sort((a, b) => (a.spendId ?? "").localeCompare(b.spendId ?? "")),
    [cats.data],
  );

  async function onCreate() {
    if (!newCategory || !newSpendId) return;
    try {
      await create.mutateAsync({
        spendeeCategory: newCategory,
        spendId: newSpendId,
      });
      toast.success("Rule added");
      setNewCategory("");
      setNewSpendId("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Add failed");
    }
  }

  async function onSaveEdit() {
    if (!editingId) return;
    try {
      await update.mutateAsync({
        id: editingId,
        patch: { spendeeCategory: editCategory, spendId: editSpendId },
      });
      toast.success("Rule saved");
      setEditingId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function confirmDelete() {
    if (!confirmId) return;
    try {
      await del.mutateAsync(confirmId);
      toast.success("Rule deleted");
      setConfirmId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">Spendee category</label>
            <Input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="groceries"
              className="w-[260px]"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">Maps to category</label>
            <Select value={newSpendId} onValueChange={setNewSpendId}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {spendIdOptions.map((c) => (
                  <SelectItem key={c.spendId!} value={c.spendId!}>
                    {categoryLabel(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            onClick={onCreate}
            disabled={!newCategory || !newSpendId || create.isPending}
          >
            <Plus className="size-4" />
            Add rule
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : (data?.rules.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Sparkles className="size-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">No spendee rules yet</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Spendee category</TableHead>
                <TableHead>Spend ID</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="w-[140px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.rules ?? []).map((r) => {
                const isEditing = editingId === r.id;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-sm">
                      {isEditing ? (
                        <Input
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value)}
                        />
                      ) : (
                        r.spendeeCategory
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Select value={editSpendId} onValueChange={setEditSpendId}>
                          <SelectTrigger className="w-[260px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {spendIdOptions.map((c) => (
                              <SelectItem key={c.spendId!} value={c.spendId!}>
                                {categoryLabel(c)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className="font-mono">
                          {r.spendId}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.source === "user" ? "default" : "secondary"}>
                        {r.source}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {isEditing ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={onSaveEdit}
                              disabled={update.isPending}
                              aria-label="Save"
                            >
                              <Save className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingId(null)}
                              aria-label="Cancel"
                            >
                              <X className="size-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingId(r.id);
                                setEditCategory(r.spendeeCategory);
                                setEditSpendId(r.spendId);
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setConfirmId(r.id)}
                              aria-label="Delete"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={confirmId !== null} onOpenChange={(o) => !o && setConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete spendee rule?</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmId(null)}>
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
