import { BudgetSnapshot, DEFAULT_BUDGET_SNAPSHOT } from "@/lib/budgetState";

const DB_NAME = "web-accounting-db";
const DB_VERSION = 1;
const STORE_NAME = "state";
const STATE_KEY = "budget";

type StateRecord = {
  key: string;
  value: BudgetSnapshot;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function readBudgetSnapshot(): Promise<BudgetSnapshot> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(STATE_KEY);

    request.onsuccess = () => {
      const record = request.result as StateRecord | undefined;
      resolve(record?.value ?? DEFAULT_BUDGET_SNAPSHOT);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function writeBudgetSnapshot(snapshot: BudgetSnapshot): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put({ key: STATE_KEY, value: snapshot } satisfies StateRecord);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function updateBudgetSnapshot(
  updater: (current: BudgetSnapshot) => BudgetSnapshot,
): Promise<BudgetSnapshot> {
  const current = await readBudgetSnapshot();
  const next = updater(current);
  await writeBudgetSnapshot(next);
  return next;
}
