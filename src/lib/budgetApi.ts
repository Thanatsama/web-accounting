import { BudgetSnapshot } from "@/lib/budgetState";

export async function readBudgetFromServer(): Promise<BudgetSnapshot | null> {
  try {
    const response = await fetch("/api/budget", { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as BudgetSnapshot;
  } catch {
    return null;
  }
}

export async function writeBudgetToServer(snapshot: BudgetSnapshot): Promise<void> {
  try {
    await fetch("/api/budget", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot),
    });
  } catch {
    // no-op: write is best-effort because caller already keeps local state
  }
}
