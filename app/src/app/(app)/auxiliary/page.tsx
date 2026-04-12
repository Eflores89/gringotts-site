"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Save, X, Pencil, CreditCard, DollarSign } from "lucide-react";
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
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SortableHead } from "@/components/common/SortableHead";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/common/PageHeader";
import { useSort } from "@/hooks/use-sort";
import {
  usePaymentMethods,
  useCreatePaymentMethod,
  useUpdatePaymentMethod,
  useDeletePaymentMethod,
} from "@/hooks/use-payment-methods";
import {
  useIncome,
  useCreateIncome,
  useDeleteIncome,
} from "@/hooks/use-income";
import { formatMoney } from "@/lib/format";
import { CURRENCIES, FX_TO_EUR } from "@/lib/fx";
import type { Income, PaymentMethod } from "@/db/schema";

export default function AuxiliaryPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Auxiliary"
        description="Payment methods, income, and other auxiliary data."
      />
      <Tabs defaultValue="payment-methods" className="space-y-4">
        <TabsList>
          <TabsTrigger value="payment-methods">Payment Methods</TabsTrigger>
          <TabsTrigger value="income">Income</TabsTrigger>
        </TabsList>
        <TabsContent value="payment-methods">
          <PaymentMethodsTab />
        </TabsContent>
        <TabsContent value="income">
          <IncomeTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------- Payment Methods ----------

function PaymentMethodsTab() {
  const { data, isLoading } = usePaymentMethods();
  const create = useCreatePaymentMethod();
  const update = useUpdatePaymentMethod();
  const del = useDeletePaymentMethod();
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  type MK = "name";
  const acc = useCallback((r: PaymentMethod, _k: MK) => r.name, []);
  const { sorted, sort, toggle } = useSort<PaymentMethod, MK>(data?.methods ?? [], acc);

  async function onCreate() {
    if (!newName.trim()) return;
    try {
      await create.mutateAsync(newName.trim());
      toast.success("Payment method added");
      setNewName("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">New method</label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Revolut-Credit"
              className="w-64"
              onKeyDown={(e) => e.key === "Enter" && onCreate()}
            />
          </div>
          <Button size="sm" onClick={onCreate} disabled={!newName.trim() || create.isPending}>
            <Plus className="size-4" /> Add
          </Button>
        </div>
      </Card>
      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <div className="space-y-3 p-6"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <CreditCard className="size-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">No payment methods yet</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label="Name" sortKey="name" sort={sort} onClick={toggle} />
                <SortableHead label="" sortKey={"name" as MK} sort={null} onClick={() => {}} className="w-[120px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((m) => {
                const isEditing = editId === m.id;
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">
                      {isEditing ? (
                        <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                      ) : (
                        m.name
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {isEditing ? (
                          <>
                            <Button variant="ghost" size="icon" onClick={async () => {
                              try { await update.mutateAsync({ id: m.id, name: editName }); toast.success("Saved"); setEditId(null); }
                              catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
                            }}><Save className="size-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => setEditId(null)}><X className="size-4" /></Button>
                          </>
                        ) : (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => { setEditId(m.id); setEditName(m.name); }}><Pencil className="size-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => setConfirmId(m.id)}><Trash2 className="size-4" /></Button>
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
          <DialogHeader><DialogTitle>Delete payment method?</DialogTitle><DialogDescription>This cannot be undone.</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={async () => {
              if (!confirmId) return;
              try { await del.mutateAsync(confirmId); toast.success("Deleted"); setConfirmId(null); }
              catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
            }} disabled={del.isPending}>{del.isPending ? "Deleting…" : "Delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------- Income ----------

const INCOME_SOURCES = ["salary", "freelance", "reimbursement", "gift", "investment", "other"] as const;

function IncomeTab() {
  const [year] = useState(new Date().getFullYear());
  const { data, isLoading } = useIncome({ year });
  const create = useCreateIncome();
  const del = useDeleteIncome();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    description: "", amount: "", currency: "EUR", chargeDate: new Date().toISOString().slice(0, 10),
    source: "salary", notes: "", fxRate: "1",
  });

  type IK = "date" | "description" | "amount" | "source" | "eur";
  const acc = useCallback(
    (r: Income, key: IK): string | number =>
      key === "date" ? r.chargeDate : key === "description" ? (r.description ?? "") :
      key === "amount" ? r.amount : key === "source" ? (r.source ?? "") : (r.euroMoney ?? 0),
    [],
  );
  const { sorted, sort, toggle } = useSort<Income, IK>(data?.income ?? [], acc);

  async function onAdd() {
    try {
      await create.mutateAsync({
        description: form.description || null,
        amount: Number(form.amount),
        currency: form.currency,
        chargeDate: form.chargeDate,
        source: form.source || null,
        notes: form.notes || null,
        fxRate: Number(form.fxRate) || null,
      });
      toast.success("Income added");
      setShowAdd(false);
      setForm({ description: "", amount: "", currency: "EUR", chargeDate: new Date().toISOString().slice(0, 10), source: "salary", notes: "", fxRate: "1" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="size-4" /> New income
        </Button>
      </div>
      {showAdd && (
        <Card className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Description</label>
              <Input value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="March salary" className="w-48" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Amount</label>
              <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))} className="w-28" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Currency</label>
              <Select value={form.currency} onValueChange={(v) => {
                setForm(f => ({ ...f, currency: v, fxRate: String(FX_TO_EUR[v] ?? 1) }));
              }}>
                <SelectTrigger className="w-[90px]"><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">FX → EUR</label>
              <Input type="number" step="any" value={form.fxRate} onChange={(e) => setForm(f => ({ ...f, fxRate: e.target.value }))} className="w-24" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Date</label>
              <Input type="date" value={form.chargeDate} onChange={(e) => setForm(f => ({ ...f, chargeDate: e.target.value }))} className="w-36" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Source</label>
              <Select value={form.source} onValueChange={(v) => setForm(f => ({ ...f, source: v }))}>
                <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>{INCOME_SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={onAdd} disabled={!form.amount || create.isPending}>Add</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </Card>
      )}
      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <div className="space-y-3 p-6"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <DollarSign className="size-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">No income entries yet</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label="Date" sortKey="date" sort={sort} onClick={toggle} className="w-[110px]" />
                <SortableHead label="Description" sortKey="description" sort={sort} onClick={toggle} />
                <SortableHead label="Source" sortKey="source" sort={sort} onClick={toggle} />
                <SortableHead label="Amount" sortKey="amount" sort={sort} onClick={toggle} className="text-right" />
                <SortableHead label="EUR" sortKey="eur" sort={sort} onClick={toggle} className="text-right" />
                <SortableHead label="" sortKey={"date" as IK} sort={null} onClick={() => {}} className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-muted-foreground">{r.chargeDate}</TableCell>
                  <TableCell className="font-medium">{r.description ?? "—"}</TableCell>
                  <TableCell>{r.source ? <Badge variant="outline">{r.source}</Badge> : "—"}</TableCell>
                  <TableCell className="text-right font-mono">{formatMoney(r.amount, r.currency)}</TableCell>
                  <TableCell className="text-right font-mono">{formatMoney(r.euroMoney, "EUR")}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setConfirmId(r.id)}><Trash2 className="size-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      <Dialog open={confirmId !== null} onOpenChange={(o) => !o && setConfirmId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete income entry?</DialogTitle><DialogDescription>This cannot be undone.</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={async () => {
              if (!confirmId) return;
              try { await del.mutateAsync(confirmId); toast.success("Deleted"); setConfirmId(null); }
              catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
            }} disabled={del.isPending}>{del.isPending ? "Deleting…" : "Delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
