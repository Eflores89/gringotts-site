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

function asString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  // Defensive — sheetjs sometimes returns rich-text objects.
  return String(value).trim();
}

function asNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number(value.replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function isExpense(row: Record<string, unknown>): boolean {
  const type = asString(row[COL.TYPE]).toLowerCase();
  if (type === "expense") return true;
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
      const note = asString(row[COL.NOTE]) || "Unknown Transaction";
      const amount = Math.abs(asNumber(row[COL.AMOUNT]));
      all.push({
        transaction: note,
        amount,
        currency: asString(row[COL.CURRENCY]) || "EUR",
        chargeDate: toIsoDate(row[COL.DATE]),
        spendeeCategory: asString(row[COL.CATEGORY]),
        method: asString(row[COL.WALLET]),
        sourceFile: file.name,
      });
    }
  }
  return all;
}
