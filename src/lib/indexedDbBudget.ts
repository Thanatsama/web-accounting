import { BudgetSnapshot, DEFAULT_BUDGET_SNAPSHOT } from "@/lib/budgetState";

const API_PATH = "/api/budget";

function asNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeSnapshot(value: unknown): BudgetSnapshot {
  if (!value || typeof value !== "object") {
    return DEFAULT_BUDGET_SNAPSHOT;
  }

  const candidate = value as Partial<BudgetSnapshot>;
  const accountBalanceByMonth =
    candidate.accountBalanceByMonth && typeof candidate.accountBalanceByMonth === "object"
      ? Object.fromEntries(
          Object.entries(candidate.accountBalanceByMonth).map(([key, monthValue]) => [
            key,
            asNumber(monthValue, 0),
          ]),
        )
      : {};
  const monthlyIncomeByMonth =
    candidate.monthlyIncomeByMonth && typeof candidate.monthlyIncomeByMonth === "object"
      ? Object.fromEntries(
          Object.entries(candidate.monthlyIncomeByMonth).map(([key, monthValue]) => [
            key,
            asNumber(monthValue, 0),
          ]),
        )
      : {};

  return {
    accountBalance: asNumber(candidate.accountBalance, 0),
    accountBalanceByMonth,
    monthlyIncome: asNumber(candidate.monthlyIncome, 0),
    monthlyIncomeByMonth,
    totalTables: Math.max(1, Math.floor(asNumber(candidate.totalTables, 1))),
    rows: Array.isArray(candidate.rows) ? candidate.rows : [],
    updatedAt: asNumber(candidate.updatedAt, 0),
  };
}

export async function readBudgetSnapshot(): Promise<BudgetSnapshot> {
  try {
    const response = await fetch(API_PATH, { cache: "no-store" });
    if (!response.ok) return DEFAULT_BUDGET_SNAPSHOT;
    const payload = (await response.json()) as unknown;
    return normalizeSnapshot(payload);
  } catch (error) {
    console.error("Failed to read budget snapshot from server:", error);
    return DEFAULT_BUDGET_SNAPSHOT;
  }
}

export async function writeBudgetSnapshot(snapshot: BudgetSnapshot): Promise<void> {
  try {
    const nextSnapshot = normalizeSnapshot(snapshot);
    const response = await fetch(API_PATH, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextSnapshot),
    });
    if (!response.ok) {
      throw new Error(`Write failed: ${response.status}`);
    }
  } catch (error) {
    console.error("Failed to write budget snapshot to server:", error);
    throw error;
  }
}

export async function updateBudgetSnapshot(
  updater: (current: BudgetSnapshot) => BudgetSnapshot,
): Promise<BudgetSnapshot> {
  const current = await readBudgetSnapshot();
  const next = normalizeSnapshot(updater(current));
  await writeBudgetSnapshot(next);
  return next;
}
