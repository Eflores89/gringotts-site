import * as XLSX from "xlsx";

export type ParsedRow = {
  transaction: string;
  amount: number;
  currency: string;
  chargeDate: string;
  spendeeCategory: string;
  method: string;
  sourceFile: string;
};

// Spendee export column names. Match the legacy js/config.js mapping.
const COL = {
  DATE: "Date",
  TYPE: "Type",
  CATEGORY: "Category name",
  AMOUNT: "Amount",
  CURRENCY: "Currency",
  NOTE: "Note",
  WALLET: "Wallet",
  LABELS: "Labels",
} as const;

function toIsoDate(value: unknown): string {
  if (typeof value === "string") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  if (typeof value === "number") {
    // Excel serial date: days since 1899-12-30
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + value * 86_400_000);
    return d.toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

function isExpense(row: Record<string, unknown>): boolean {
  const type = row[COL.TYPE];
  if (type === "Expense") return true;
  const amount = row[COL.AMOUNT];
  return typeof amount === "number" && amount < 0;
}

export async function parseXlsxFiles(files: File[]): Promise<ParsedRow[]> {
  const all: ParsedRow[] = [];
  for (const file of files) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    for (const row of rows) {
      if (!isExpense(row)) continue;
      const note =
        (row[COL.NOTE] as string | undefined)?.trim() || "Unknown Transaction";
      const rawAmount = row[COL.AMOUNT];
      const amount =
        typeof rawAmount === "number" ? Math.abs(rawAmount) : Number(rawAmount) || 0;
      all.push({
        transaction: note,
        amount,
        currency: (row[COL.CURRENCY] as string | undefined) || "EUR",
        chargeDate: toIsoDate(row[COL.DATE]),
        spendeeCategory: (row[COL.CATEGORY] as string | undefined) || "",
        method: (row[COL.WALLET] as string | undefined) || "",
        sourceFile: file.name,
      });
    }
  }
  return all;
}
