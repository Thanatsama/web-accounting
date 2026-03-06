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
    // no-op: client keeps source of truth in IndexedDB
  }
}

export async function pushBudgetToGoogleSheets(snapshot: BudgetSnapshot): Promise<boolean> {
  try {
    const response = await fetch("/api/sync/sheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snapshot }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function pullBudgetFromGoogleSheets(): Promise<BudgetSnapshot | null> {
  try {
    const response = await fetch("/api/sync/sheets", { cache: "no-store" });
    if (!response.ok) return null;
    const body = (await response.json()) as { ok?: boolean; snapshot?: BudgetSnapshot };
    return body.ok && body.snapshot ? body.snapshot : null;
  } catch {
    return null;
  }
}
