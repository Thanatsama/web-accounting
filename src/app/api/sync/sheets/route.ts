import { NextResponse } from "next/server";
import { BudgetSnapshot } from "@/lib/budgetState";
import { pullSnapshotFromGoogleSheets, pushSnapshotToGoogleSheets } from "@/lib/googleSheetsSync";

export async function GET() {
  try {
    const snapshot = await pullSnapshotFromGoogleSheets();
    return NextResponse.json({ ok: true, snapshot });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to pull from Google Sheets";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { snapshot?: BudgetSnapshot };
    if (!payload.snapshot) {
      return NextResponse.json({ ok: false, error: "Missing snapshot" }, { status: 400 });
    }
    await pushSnapshotToGoogleSheets(payload.snapshot);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to push to Google Sheets";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
