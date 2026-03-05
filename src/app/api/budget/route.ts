import { mkdir, readFile, writeFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { BudgetSnapshot, DEFAULT_BUDGET_SNAPSHOT } from "@/lib/budgetState";

const DATA_DIR = `${process.cwd()}/data`;
const DATA_FILE = `${DATA_DIR}/budget.json`;

async function ensureFile(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    await readFile(DATA_FILE, "utf-8");
  } catch {
    await writeFile(DATA_FILE, JSON.stringify(DEFAULT_BUDGET_SNAPSHOT, null, 2), "utf-8");
  }
}

async function readSnapshot(): Promise<BudgetSnapshot> {
  await ensureFile();
  const raw = await readFile(DATA_FILE, "utf-8");
  const parsed = JSON.parse(raw) as Partial<BudgetSnapshot>;
  return {
    accountBalance: Number(parsed.accountBalance ?? 0),
    accountBalanceByMonth:
      parsed.accountBalanceByMonth && typeof parsed.accountBalanceByMonth === "object"
        ? Object.fromEntries(
            Object.entries(parsed.accountBalanceByMonth).map(([key, value]) => [key, Number(value ?? 0)]),
          )
        : {},
    monthlyIncome: Number(parsed.monthlyIncome ?? 0),
    monthlyIncomeByMonth:
      parsed.monthlyIncomeByMonth && typeof parsed.monthlyIncomeByMonth === "object"
        ? Object.fromEntries(
            Object.entries(parsed.monthlyIncomeByMonth).map(([key, value]) => [key, Number(value ?? 0)]),
          )
        : {},
    totalTables: Math.max(1, Number(parsed.totalTables ?? 1)),
    rows: Array.isArray(parsed.rows) ? parsed.rows : [],
    updatedAt: Number(parsed.updatedAt ?? 0),
  };
}

export async function GET() {
  const snapshot = await readSnapshot();
  return NextResponse.json(snapshot);
}

export async function PUT(request: Request) {
  const payload = (await request.json()) as Partial<BudgetSnapshot>;
  const nextSnapshot: BudgetSnapshot = {
    accountBalance: Number(payload.accountBalance ?? 0),
    accountBalanceByMonth:
      payload.accountBalanceByMonth && typeof payload.accountBalanceByMonth === "object"
        ? Object.fromEntries(
            Object.entries(payload.accountBalanceByMonth).map(([key, value]) => [key, Number(value ?? 0)]),
          )
        : {},
    monthlyIncome: Number(payload.monthlyIncome ?? 0),
    monthlyIncomeByMonth:
      payload.monthlyIncomeByMonth && typeof payload.monthlyIncomeByMonth === "object"
        ? Object.fromEntries(
            Object.entries(payload.monthlyIncomeByMonth).map(([key, value]) => [key, Number(value ?? 0)]),
          )
        : {},
    totalTables: Math.max(1, Number(payload.totalTables ?? 1)),
    rows: Array.isArray(payload.rows) ? payload.rows : [],
    updatedAt: Number(payload.updatedAt ?? Date.now()),
  };

  await ensureFile();
  await writeFile(DATA_FILE, JSON.stringify(nextSnapshot, null, 2), "utf-8");
  return NextResponse.json(nextSnapshot);
}
