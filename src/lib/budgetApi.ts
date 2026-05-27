import { BudgetSnapshot } from "@/lib/budgetState";

const API_PATH = "/api/budget";
const CLIENT_CACHE_TTL_MS = 3000;

let cachedSnapshot: BudgetSnapshot | null = null;
let cachedAt = 0;
let inflightRead: Promise<BudgetSnapshot | null> | null = null;

function setBudgetCache(snapshot: BudgetSnapshot | null) {
  cachedSnapshot = snapshot;
  cachedAt = snapshot ? Date.now() : 0;
}

export function primeBudgetServerCache(snapshot: BudgetSnapshot): void {
  setBudgetCache(snapshot);
}

export function clearBudgetServerCache(): void {
  cachedSnapshot = null;
  cachedAt = 0;
  inflightRead = null;
}

export async function readBudgetFromServer(options?: { force?: boolean }): Promise<BudgetSnapshot | null> {
  const force = options?.force ?? false;
  const now = Date.now();

  if (!force && cachedSnapshot && now - cachedAt < CLIENT_CACHE_TTL_MS) {
    return cachedSnapshot;
  }

  if (!force && inflightRead) {
    return inflightRead;
  }

  inflightRead = (async () => {
    try {
      const response = await fetch(API_PATH, { cache: "no-store" });
      if (!response.ok) {
        return null;
      }
      const snapshot = (await response.json()) as BudgetSnapshot;
      setBudgetCache(snapshot);
      return snapshot;
    } catch {
      return null;
    } finally {
      inflightRead = null;
    }
  })();

  return inflightRead;
}

export async function writeBudgetToServer(snapshot: BudgetSnapshot): Promise<void> {
  try {
    await fetch(API_PATH, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot),
    });
    setBudgetCache(snapshot);
  } catch {
    // no-op: write is best-effort because caller already keeps local state
  }
}
