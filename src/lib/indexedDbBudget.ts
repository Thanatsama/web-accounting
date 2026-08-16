import { readBudgetFromServer, writeBudgetToServer } from "@/lib/budgetApi";
import { BudgetSnapshot, DEFAULT_BUDGET_SNAPSHOT, HomeExpense } from "@/lib/budgetState";

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
  const homeExpensesByMonth =
    candidate.homeExpensesByMonth && typeof candidate.homeExpensesByMonth === "object"
      ? Object.fromEntries(
          Object.entries(candidate.homeExpensesByMonth).map(([key, value]) => [
            key,
            Array.isArray(value)
              ? value
                  .map((item) => {
                    if (!item || typeof item !== "object") return null;
                    const candidateItem = item as Partial<HomeExpense>;
                    return {
                      id: asNumber(candidateItem.id, Date.now()),
                      detail: typeof candidateItem.detail === "string" ? candidateItem.detail : "",
                      amount: asNumber(candidateItem.amount, 0),
                    };
                  })
                  .filter((item): item is HomeExpense => item !== null)
              : [],
          ]),
        )
      : {};

  return {
    accountBalance: asNumber(candidate.accountBalance, 0),
    accountBalanceByMonth,
    monthlyIncome: asNumber(candidate.monthlyIncome, 0),
    monthlyIncomeByMonth,
    homeExpensesByMonth,
    totalTables: Math.max(1, Math.floor(asNumber(candidate.totalTables, 1))),
    rows: Array.isArray(candidate.rows) ? candidate.rows : [],
    updatedAt: asNumber(candidate.updatedAt, 0),
  };
}

export async function readBudgetSnapshot(): Promise<BudgetSnapshot> {
  try {
    const payload = await readBudgetFromServer();
    if (!payload) return DEFAULT_BUDGET_SNAPSHOT;
    return normalizeSnapshot(payload);
  } catch (error) {
    console.error("Failed to read budget snapshot from server:", error);
    return DEFAULT_BUDGET_SNAPSHOT;
  }
}

export async function writeBudgetSnapshot(snapshot: BudgetSnapshot): Promise<void> {
  try {
    const nextSnapshot = normalizeSnapshot(snapshot);
    await writeBudgetToServer(nextSnapshot);
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
