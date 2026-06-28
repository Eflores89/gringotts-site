"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, Plus, Pencil, Scale, Table2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { CURRENCIES } from "@/lib/fx";
import { formatMoney } from "@/lib/format";
import {
  PRINCIPAL_ID,
  type ControllershipGraph as GraphData,
  type GraphJurisdiction,
  type GraphLoanEdge,
  type GraphOwnershipEdge,
} from "@/lib/controllership";
import {
  useCompanyCrud,
  useJurisdictionCrud,
  useLoanCrud,
  useOwnershipCrud,
} from "@/hooks/use-controllership";

// Radix Select needs non-empty item values, so we use sentinels and map them
// back to null / the principal at submit time.
const YOU = "__you__";
const NONE = "__none__";
const today = () => new Date().toISOString().slice(0, 10);
const num = (s: string): number | null => {
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

type EntityKind = "jurisdiction" | "company" | "stake" | "loan";
type Editing = { kind: EntityKind; initial: unknown } | null;
type Confirming = { kind: EntityKind; id: string; label: string } | null;

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label className="text-xs text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function PartySelect({
  value,
  onChange,
  companies,
  placeholder = "Select…",
}: {
  value: string;
  onChange: (v: string) => void;
  companies: GraphData["companies"];
  placeholder?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={YOU}>You (principal)</SelectItem>
        {companies.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ─── dialogs ────────────────────────────────────────────────────────────────

function JurisdictionDialog({
  initial,
  onClose,
  onSaved,
}: {
  initial: GraphJurisdiction | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const crud = useJurisdictionCrud();
  const [f, setF] = useState({
    name: initial?.name ?? "",
    code: initial?.code ?? "",
    corporateTaxRate: initial?.corporateTaxRate?.toString() ?? "",
    personalDividendRate: initial?.personalDividendRate?.toString() ?? "",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  async function save() {
    const payload = {
      name: f.name.trim(),
      code: f.code.trim(),
      corporateTaxRate: num(f.corporateTaxRate),
      personalDividendRate: num(f.personalDividendRate),
    };
    try {
      if (initial) await crud.update.mutateAsync({ id: initial.id, patch: payload });
      else await crud.create.mutateAsync(payload);
      toast.success(initial ? "Jurisdiction updated" : "Jurisdiction added");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  const pending = crud.create.isPending || crud.update.isPending;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Edit" : "New"} jurisdiction</DialogTitle>
          <DialogDescription>Tax rates are optional for now.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name">
            <Input value={f.name} onChange={set("name")} placeholder="Spain" />
          </Field>
          <Field label="Code">
            <Input value={f.code} onChange={set("code")} placeholder="ES" />
          </Field>
          <Field label="Corporate tax %">
            <Input
              type="number"
              step="any"
              value={f.corporateTaxRate}
              onChange={set("corporateTaxRate")}
            />
          </Field>
          <Field label="Personal dividend %">
            <Input
              type="number"
              step="any"
              value={f.personalDividendRate}
              onChange={set("personalDividendRate")}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!f.name.trim() || !f.code.trim() || pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CompanyDialog({
  initial,
  graph,
  onClose,
  onSaved,
}: {
  initial: GraphData["companies"][number] | null;
  graph: GraphData;
  onClose: () => void;
  onSaved: () => void;
}) {
  const crud = useCompanyCrud();
  const [f, setF] = useState({
    name: initial?.name ?? "",
    code: initial?.code ?? "",
    jurisdictionId: initial?.jurisdictionId ?? NONE,
    entityType: initial?.entityType ?? "",
    functionalCurrency: initial?.functionalCurrency ?? NONE,
    notes: initial?.notes ?? "",
  });
  const [investmentIds, setInvestmentIds] = useState<string[]>(
    initial?.linkedInvestmentIds ?? [],
  );
  const [pickKey, setPickKey] = useState(0);
  const available = graph.investments.filter((i) => !investmentIds.includes(i.id));
  const nameOfInv = (id: string) =>
    graph.investments.find((i) => i.id === id)?.name ?? id;

  async function save() {
    const payload = {
      name: f.name.trim(),
      code: f.code.trim(),
      jurisdictionId: f.jurisdictionId === NONE ? null : f.jurisdictionId,
      entityType: f.entityType.trim() || null,
      functionalCurrency: f.functionalCurrency === NONE ? null : f.functionalCurrency,
      investmentIds,
      notes: f.notes.trim() || null,
    };
    try {
      if (initial) await crud.update.mutateAsync({ id: initial.id, patch: payload });
      else await crud.create.mutateAsync(payload);
      toast.success(initial ? "Company updated" : "Company added");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  const pending = crud.create.isPending || crud.update.isPending;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Edit" : "New"} company</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name">
            <Input
              value={f.name}
              onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))}
              placeholder="MCF"
            />
          </Field>
          <Field label="Code">
            <Input
              value={f.code}
              onChange={(e) => setF((p) => ({ ...p, code: e.target.value }))}
              placeholder="mcf"
            />
          </Field>
          <Field label="Jurisdiction">
            <Select
              value={f.jurisdictionId}
              onValueChange={(v) => setF((p) => ({ ...p, jurisdictionId: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— none —</SelectItem>
                {graph.jurisdictions.map((j) => (
                  <SelectItem key={j.id} value={j.id}>
                    {j.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Entity type">
            <Input
              value={f.entityType}
              onChange={(e) => setF((p) => ({ ...p, entityType: e.target.value }))}
              placeholder="S.A. / S.L."
            />
          </Field>
          <Field label="Currency">
            <Select
              value={f.functionalCurrency}
              onValueChange={(v) => setF((p) => ({ ...p, functionalCurrency: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— none —</SelectItem>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Investment rounds (valuation)" className="col-span-2">
            {investmentIds.length ? (
              <div className="flex flex-wrap gap-1.5">
                {investmentIds.map((id) => (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 rounded-md border bg-muted/40 py-0.5 pl-2 pr-1 text-xs"
                  >
                    {nameOfInv(id)}
                    <button
                      type="button"
                      onClick={() =>
                        setInvestmentIds((ids) => ids.filter((x) => x !== id))
                      }
                      className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                      aria-label={`Remove ${nameOfInv(id)}`}
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No rounds linked — valuation will be blank.
              </p>
            )}
            <Select
              key={pickKey}
              onValueChange={(v) => {
                setInvestmentIds((ids) => [...ids, v]);
                setPickKey((k) => k + 1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="+ Add a round (investment)…" />
              </SelectTrigger>
              <SelectContent>
                {available.length ? (
                  available.map((inv) => (
                    <SelectItem key={inv.id} value={inv.id}>
                      {inv.name}
                      {inv.assetType ? ` (${inv.assetType})` : ""}
                    </SelectItem>
                  ))
                ) : (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    All investments linked
                  </div>
                )}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Notes" className="col-span-2">
            <Input
              value={f.notes}
              onChange={(e) => setF((p) => ({ ...p, notes: e.target.value }))}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!f.name.trim() || !f.code.trim() || pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StakeDialog({
  initial,
  graph,
  onClose,
  onSaved,
}: {
  initial: GraphOwnershipEdge | null;
  graph: GraphData;
  onClose: () => void;
  onSaved: () => void;
}) {
  const crud = useOwnershipCrud();
  const [f, setF] = useState({
    owner: initial ? (initial.ownerId === PRINCIPAL_ID ? YOU : initial.ownerId) : YOU,
    owned: initial?.ownedId ?? "",
    percentage: initial?.percentage?.toString() ?? "",
    effectiveFrom: initial?.effectiveFrom ?? today(),
    effectiveTo: initial?.effectiveTo ?? "",
    notes: initial?.notes ?? "",
  });

  async function save() {
    const pctVal = num(f.percentage);
    if (pctVal == null) {
      toast.error("Percentage is required");
      return;
    }
    const payload = {
      ownerCompanyId: f.owner === YOU ? null : f.owner,
      ownedCompanyId: f.owned,
      percentage: pctVal,
      effectiveFrom: f.effectiveFrom,
      effectiveTo: f.effectiveTo.trim() || null,
      notes: f.notes.trim() || null,
    };
    try {
      if (initial) await crud.update.mutateAsync({ id: initial.id, patch: payload });
      else await crud.create.mutateAsync(payload);
      toast.success(initial ? "Stake updated" : "Stake added");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  const pending = crud.create.isPending || crud.update.isPending;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Edit" : "New"} stake</DialogTitle>
          <DialogDescription>
            Time-versioned — leave “to” empty for the current stake.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Owner">
            <PartySelect
              value={f.owner}
              onChange={(v) => setF((p) => ({ ...p, owner: v }))}
              companies={graph.companies}
            />
          </Field>
          <Field label="Company owned">
            <Select
              value={f.owned}
              onValueChange={(v) => setF((p) => ({ ...p, owned: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {graph.companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Percentage">
            <Input
              type="number"
              step="any"
              value={f.percentage}
              onChange={(e) => setF((p) => ({ ...p, percentage: e.target.value }))}
              placeholder="50"
            />
          </Field>
          <div />
          <Field label="Effective from">
            <Input
              type="date"
              value={f.effectiveFrom}
              onChange={(e) => setF((p) => ({ ...p, effectiveFrom: e.target.value }))}
            />
          </Field>
          <Field label="Effective to">
            <Input
              type="date"
              value={f.effectiveTo}
              onChange={(e) => setF((p) => ({ ...p, effectiveTo: e.target.value }))}
            />
          </Field>
          <Field label="Notes" className="col-span-2">
            <Input
              value={f.notes}
              onChange={(e) => setF((p) => ({ ...p, notes: e.target.value }))}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={save}
            disabled={!f.owned || !f.percentage || !f.effectiveFrom || pending}
          >
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const LOAN_SELECTS = {
  interestType: ["fixed", "variable"],
  compounding: ["simple", "monthly", "annual"],
  repaymentType: ["bullet", "amortizing", "interest_only", "on_demand"],
  paymentFrequency: ["none", "monthly", "quarterly", "annual", "at_end"],
  status: ["draft", "active", "repaid", "defaulted"],
} as const;

function LoanDialog({
  initial,
  graph,
  onClose,
  onSaved,
}: {
  initial: GraphLoanEdge | null;
  graph: GraphData;
  onClose: () => void;
  onSaved: () => void;
}) {
  const crud = useLoanCrud();
  const [f, setF] = useState({
    lender: initial ? (initial.lenderId === PRINCIPAL_ID ? YOU : initial.lenderId) : YOU,
    borrower: initial
      ? initial.borrowerId === PRINCIPAL_ID
        ? YOU
        : initial.borrowerId
      : "",
    principal: initial?.principal?.toString() ?? "",
    currency: initial?.currency ?? "EUR",
    interestRate: initial?.interestRate?.toString() ?? "",
    interestType: initial?.interestType ?? "fixed",
    compounding: initial?.compounding ?? "simple",
    repaymentType: initial?.repaymentType ?? "bullet",
    paymentFrequency: initial?.paymentFrequency ?? "none",
    originationDate: initial?.originationDate ?? today(),
    maturityDate: initial?.maturityDate ?? "",
    status: initial?.status ?? "active",
    notes: initial?.notes ?? "",
  });
  const sel = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    const principalVal = num(f.principal);
    if (principalVal == null || principalVal <= 0) {
      toast.error("Principal must be positive");
      return;
    }
    const payload = {
      lenderCompanyId: f.lender === YOU ? null : f.lender,
      borrowerCompanyId: f.borrower === YOU ? null : f.borrower,
      principal: principalVal,
      currency: f.currency,
      interestRate: num(f.interestRate),
      interestType: f.interestType,
      compounding: f.compounding,
      repaymentType: f.repaymentType,
      paymentFrequency: f.paymentFrequency,
      originationDate: f.originationDate.trim() || null,
      maturityDate: f.maturityDate.trim() || null,
      status: f.status,
      notes: f.notes.trim() || null,
    };
    try {
      if (initial) await crud.update.mutateAsync({ id: initial.id, patch: payload });
      else await crud.create.mutateAsync(payload);
      toast.success(initial ? "Loan updated" : "Loan added");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  const enumSelect = (k: keyof typeof LOAN_SELECTS) => (
    <Select value={f[k]} onValueChange={sel(k)}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LOAN_SELECTS[k].map((o) => (
          <SelectItem key={o} value={o}>
            {o.replace("_", " ")}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const pending = crud.create.isPending || crud.update.isPending;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit" : "New"} loan</DialogTitle>
          <DialogDescription>
            Interest is taxable income to the lender; principal is return of
            capital.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Lender">
            <PartySelect
              value={f.lender}
              onChange={sel("lender")}
              companies={graph.companies}
            />
          </Field>
          <Field label="Borrower">
            <PartySelect
              value={f.borrower}
              onChange={sel("borrower")}
              companies={graph.companies}
              placeholder="Select…"
            />
          </Field>
          <Field label="Principal">
            <Input
              type="number"
              step="any"
              value={f.principal}
              onChange={(e) => setF((p) => ({ ...p, principal: e.target.value }))}
            />
          </Field>
          <Field label="Currency">
            <Select value={f.currency} onValueChange={sel("currency")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Interest rate %">
            <Input
              type="number"
              step="any"
              value={f.interestRate}
              onChange={(e) => setF((p) => ({ ...p, interestRate: e.target.value }))}
            />
          </Field>
          <Field label="Interest type">{enumSelect("interestType")}</Field>
          <Field label="Repayment">{enumSelect("repaymentType")}</Field>
          <Field label="Payment frequency">{enumSelect("paymentFrequency")}</Field>
          <Field label="Compounding">{enumSelect("compounding")}</Field>
          <Field label="Status">{enumSelect("status")}</Field>
          <Field label="Origination date">
            <Input
              type="date"
              value={f.originationDate}
              onChange={(e) =>
                setF((p) => ({ ...p, originationDate: e.target.value }))
              }
            />
          </Field>
          <Field label="Maturity date">
            <Input
              type="date"
              value={f.maturityDate}
              onChange={(e) => setF((p) => ({ ...p, maturityDate: e.target.value }))}
            />
          </Field>
          <Field label="Notes" className="col-span-2">
            <Input
              value={f.notes}
              onChange={(e) => setF((p) => ({ ...p, notes: e.target.value }))}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!f.borrower || !f.principal || pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── editor (menus, data tables, delete) ─────────────────────────────────────

export function ControllershipEditor({ graph }: { graph: GraphData }) {
  const router = useRouter();
  const [dataOpen, setDataOpen] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const [confirming, setConfirming] = useState<Confirming>(null);

  const jur = useJurisdictionCrud();
  const co = useCompanyCrud();
  const own = useOwnershipCrud();
  const loan = useLoanCrud();

  const onSaved = () => {
    setEditing(null);
    router.refresh();
  };
  const openCreate = (kind: EntityKind) => setEditing({ kind, initial: null });
  const openEdit = (kind: EntityKind, initial: unknown) =>
    setEditing({ kind, initial });

  const nameOf = (id: string) =>
    id === PRINCIPAL_ID
      ? "You"
      : (graph.companies.find((c) => c.id === id)?.name ?? id);

  async function doDelete() {
    if (!confirming) return;
    const remove = { jurisdiction: jur, company: co, stake: own, loan }[
      confirming.kind
    ].remove;
    try {
      await remove.mutateAsync(confirming.id);
      toast.success("Deleted");
      setConfirming(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm">
            <Plus className="size-4" />
            Add
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => openCreate("company")}>
            <Building2 className="size-4" /> Company
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openCreate("stake")}>
            <Scale className="size-4" /> Stake
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openCreate("loan")}>
            <Plus className="size-4" /> Loan
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openCreate("jurisdiction")}>
            <Plus className="size-4" /> Jurisdiction
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button variant="outline" size="sm" onClick={() => setDataOpen(true)}>
        <Table2 className="size-4" />
        Data tables
      </Button>

      {/* dialogs */}
      {editing?.kind === "jurisdiction" && (
        <JurisdictionDialog
          initial={editing.initial as GraphJurisdiction | null}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      )}
      {editing?.kind === "company" && (
        <CompanyDialog
          initial={editing.initial as GraphData["companies"][number] | null}
          graph={graph}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      )}
      {editing?.kind === "stake" && (
        <StakeDialog
          initial={editing.initial as GraphOwnershipEdge | null}
          graph={graph}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      )}
      {editing?.kind === "loan" && (
        <LoanDialog
          initial={editing.initial as GraphLoanEdge | null}
          graph={graph}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      )}

      {/* delete confirm */}
      <Dialog open={confirming != null} onOpenChange={(o) => !o && setConfirming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {confirming?.kind}?</DialogTitle>
            <DialogDescription>
              {confirming?.label} — this cannot be undone.
              {confirming?.kind === "company"
                ? " Its stakes and loans are removed too."
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={doDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* data tables drawer */}
      <Sheet open={dataOpen} onOpenChange={setDataOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
          <SheetHeader>
            <SheetTitle>Data tables</SheetTitle>
            <SheetDescription>
              The records behind the graph — add, edit, or delete.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <Tabs defaultValue="companies">
              <TabsList>
                <TabsTrigger value="companies">
                  Companies ({graph.companies.length})
                </TabsTrigger>
                <TabsTrigger value="ownership">
                  Stakes ({graph.ownershipEdges.length})
                </TabsTrigger>
                <TabsTrigger value="loans">Loans ({graph.loans.length})</TabsTrigger>
                <TabsTrigger value="jurisdictions">
                  Jurisdictions ({graph.jurisdictions.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="companies" className="space-y-3">
                <AddRow label="company" onClick={() => openCreate("company")} />
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Jurisdiction</TableHead>
                      <TableHead className="text-right">Look-through</TableHead>
                      <RowActionsHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {graph.companies.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>{c.jurisdictionName ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {c.lookThrough.toFixed(2)}%
                        </TableCell>
                        <RowActions
                          onEdit={() => openEdit("company", c)}
                          onDelete={() =>
                            setConfirming({ kind: "company", id: c.id, label: c.name })
                          }
                        />
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="ownership" className="space-y-3">
                <AddRow label="stake" onClick={() => openCreate("stake")} />
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Owner</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead className="text-right">%</TableHead>
                      <TableHead>From</TableHead>
                      <RowActionsHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {graph.ownershipEdges.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>{nameOf(e.ownerId)}</TableCell>
                        <TableCell>{nameOf(e.ownedId)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {e.percentage}%
                        </TableCell>
                        <TableCell className="tabular-nums">{e.effectiveFrom}</TableCell>
                        <RowActions
                          onEdit={() => openEdit("stake", e)}
                          onDelete={() =>
                            setConfirming({
                              kind: "stake",
                              id: e.id,
                              label: `${nameOf(e.ownerId)} → ${nameOf(e.ownedId)}`,
                            })
                          }
                        />
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="loans" className="space-y-3">
                <AddRow label="loan" onClick={() => openCreate("loan")} />
                {graph.loans.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Lender → Borrower</TableHead>
                        <TableHead className="text-right">Principal</TableHead>
                        <TableHead className="text-right">Rate</TableHead>
                        <TableHead>Status</TableHead>
                        <RowActionsHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {graph.loans.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell className="text-xs">
                            {nameOf(l.lenderId)} → {nameOf(l.borrowerId)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatMoney(l.principal, l.currency)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {l.interestRate != null ? `${l.interestRate}%` : "—"}
                          </TableCell>
                          <TableCell>{l.status}</TableCell>
                          <RowActions
                            onEdit={() => openEdit("loan", l)}
                            onDelete={() =>
                              setConfirming({
                                kind: "loan",
                                id: l.id,
                                label: `${nameOf(l.lenderId)} → ${nameOf(l.borrowerId)}`,
                              })
                            }
                          />
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="py-6 text-sm text-muted-foreground">No loans yet.</p>
                )}
              </TabsContent>

              <TabsContent value="jurisdictions" className="space-y-3">
                <AddRow
                  label="jurisdiction"
                  onClick={() => openCreate("jurisdiction")}
                />
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead className="text-right">Corp. tax</TableHead>
                      <RowActionsHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {graph.jurisdictions.map((j) => (
                      <TableRow key={j.id}>
                        <TableCell className="font-medium">{j.name}</TableCell>
                        <TableCell>{j.code}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {j.corporateTaxRate != null ? `${j.corporateTaxRate}%` : "—"}
                        </TableCell>
                        <RowActions
                          onEdit={() => openEdit("jurisdiction", j)}
                          onDelete={() =>
                            setConfirming({
                              kind: "jurisdiction",
                              id: j.id,
                              label: j.name,
                            })
                          }
                        />
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function AddRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button size="sm" variant="outline" onClick={onClick}>
      <Plus className="size-4" /> Add {label}
    </Button>
  );
}

function RowActionsHead() {
  return <TableHead className="w-[88px] text-right">Actions</TableHead>;
}

function RowActions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <TableCell className="text-right">
      <div className="flex justify-end gap-1">
        <Button variant="ghost" size="icon" onClick={onEdit}>
          <Pencil className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onDelete}>
          <Trash2 className="size-4" />
        </Button>
      </div>
    </TableCell>
  );
}
