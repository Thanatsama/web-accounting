import { NextResponse } from "next/server";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { BudgetSnapshot, DEFAULT_BUDGET_SNAPSHOT } from "@/lib/budgetState";

const COLLECTION_NAME = "web_accounting";
const DOCUMENT_ID = "budget_snapshot";

function getDb() {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: requiredEnv("FIREBASE_PROJECT_ID"),
        clientEmail: requiredEnv("FIREBASE_CLIENT_EMAIL"),
        privateKey: requiredEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
      }),
    });
  }
  return getFirestore();
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing server env: ${name}`);
  }
  return value;
}

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

export async function GET() {
  try {
    const db = getDb();
    const snapshotRef = db.collection(COLLECTION_NAME).doc(DOCUMENT_ID);
    const doc = await snapshotRef.get();
    if (!doc.exists) {
      return NextResponse.json(DEFAULT_BUDGET_SNAPSHOT);
    }
    return NextResponse.json(normalizeSnapshot(doc.data()));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const payload = (await request.json()) as Partial<BudgetSnapshot>;
    const nextSnapshot = normalizeSnapshot({
      ...payload,
      updatedAt: asNumber(payload.updatedAt, Date.now()),
    });

    const db = getDb();
    await db.collection(COLLECTION_NAME).doc(DOCUMENT_ID).set(nextSnapshot);
    return NextResponse.json(nextSnapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
