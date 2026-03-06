import { google } from "googleapis";
import { readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { BudgetRow, BudgetSnapshot, DEFAULT_BUDGET_SNAPSHOT, RowStatus } from "@/lib/budgetState";

const SNAPSHOT_SHEET = "Snapshot";
const ROWS_SHEET = "Rows";

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function getSheetsClient() {
  let clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? "";
  let privateKey = process.env.GOOGLE_PRIVATE_KEY ?? "";

  const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;
  if (keyFile) {
    const keyPath = isAbsolute(keyFile) ? keyFile : join(process.cwd(), keyFile);
    const raw = readFileSync(keyPath, "utf-8");
    const parsed = JSON.parse(raw) as { client_email?: string; private_key?: string };
    clientEmail = parsed.client_email ?? clientEmail;
    privateKey = parsed.private_key ?? privateKey;
  }

  if (!clientEmail) {
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_KEY_FILE");
  }
  if (!privateKey) {
    throw new Error("Missing GOOGLE_PRIVATE_KEY or GOOGLE_SERVICE_ACCOUNT_KEY_FILE");
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

function sheetId(): string {
  return getEnv("GOOGLE_SHEET_ID");
}

type SnapshotRow = [string, string];

function encodeSnapshotRows(snapshot: BudgetSnapshot): SnapshotRow[] {
  return [
    ["accountBalance", String(snapshot.accountBalance ?? 0)],
    ["monthlyIncome", String(snapshot.monthlyIncome ?? 0)],
    ["totalTables", String(snapshot.totalTables ?? 1)],
    ["updatedAt", String(snapshot.updatedAt ?? 0)],
    ["accountBalanceByMonth", JSON.stringify(snapshot.accountBalanceByMonth ?? {})],
    ["monthlyIncomeByMonth", JSON.stringify(snapshot.monthlyIncomeByMonth ?? {})],
  ];
}

function parseJsonObject(value: string): Record<string, number> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).map(([k, v]) => [k, Number(v ?? 0)]),
    );
  } catch {
    return {};
  }
}

function decodeSnapshotRows(rows: string[][]): Omit<BudgetSnapshot, "rows"> {
  const map = Object.fromEntries(rows.map((row) => [row[0], row[1] ?? ""]));
  return {
    accountBalance: Number(map.accountBalance ?? 0),
    monthlyIncome: Number(map.monthlyIncome ?? 0),
    totalTables: Math.max(1, Number(map.totalTables ?? 1)),
    updatedAt: Number(map.updatedAt ?? 0),
    accountBalanceByMonth: parseJsonObject(map.accountBalanceByMonth ?? "{}"),
    monthlyIncomeByMonth: parseJsonObject(map.monthlyIncomeByMonth ?? "{}"),
  };
}

type RowSheetRecord = [
  string, // id
  string, // detail
  string, // expense
  string, // spreadMonths
  string, // compensation
  string, // source
  string, // status
  string, // startMonth
  string, // isCancelled
  string, // expenseByMonth
  string, // compensationByMonth
  string, // sourceByMonth
  string, // statusByMonth
  string, // planMeta
];

function toRowRecord(row: BudgetRow): RowSheetRecord {
  return [
    String(row.id),
    row.detail ?? "",
    String(row.expense ?? 0),
    String(row.spreadMonths ?? 1),
    String(row.compensation ?? 0),
    row.source ?? "",
    row.status ?? "PENDING",
    String(row.startMonth ?? 1),
    String(Boolean(row.isCancelled)),
    JSON.stringify(row.expenseByMonth ?? {}),
    JSON.stringify(row.compensationByMonth ?? {}),
    JSON.stringify(row.sourceByMonth ?? {}),
    JSON.stringify(row.statusByMonth ?? {}),
    JSON.stringify(row.planMeta ?? null),
  ];
}

function parseJsonNumberMap(value: string): Record<string, number> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).map(([k, v]) => [k, Number(v ?? 0)]),
    );
  } catch {
    return {};
  }
}

function parseJsonStringMap(value: string): Record<string, string> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).map(([k, v]) => [k, String(v ?? "")]),
    );
  } catch {
    return {};
  }
}

function parseJsonStatusMap(value: string): Record<string, RowStatus> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).map(([k, v]) => [
        k,
        String(v ?? "PENDING") === "PAID" ? "PAID" : "PENDING",
      ]),
    );
  } catch {
    return {};
  }
}

function fromRowRecord(record: string[]): BudgetRow {
  const [
    id,
    detail,
    expense,
    spreadMonths,
    compensation,
    source,
    status,
    startMonth,
    isCancelled,
    expenseByMonth,
    compensationByMonth,
    sourceByMonth,
    statusByMonth,
    planMeta,
  ] = record;

  let parsedPlanMeta: BudgetRow["planMeta"] = undefined;
  try {
    const value = JSON.parse(planMeta ?? "null") as unknown;
    if (value && typeof value === "object") {
      const plan = value as { planId?: string; termMonths?: number; startMonth?: number };
      if (plan.planId) {
        parsedPlanMeta = {
          planId: String(plan.planId),
          termMonths: Number(plan.termMonths ?? 0),
          startMonth: Number(plan.startMonth ?? 1),
        };
      }
    }
  } catch {
    parsedPlanMeta = undefined;
  }

  return {
    id: Number(id ?? 0),
    detail: detail ?? "",
    expense: Number(expense ?? 0),
    spreadMonths: Math.max(1, Number(spreadMonths ?? 1)),
    compensation: Number(compensation ?? 0),
    source: source ?? "",
    status: String(status ?? "PENDING") === "PAID" ? "PAID" : "PENDING",
    startMonth: Math.max(1, Number(startMonth ?? 1)),
    isCancelled: String(isCancelled ?? "false") === "true",
    expenseByMonth: parseJsonNumberMap(expenseByMonth ?? "{}"),
    compensationByMonth: parseJsonNumberMap(compensationByMonth ?? "{}"),
    sourceByMonth: parseJsonStringMap(sourceByMonth ?? "{}"),
    statusByMonth: parseJsonStatusMap(statusByMonth ?? "{}"),
    planMeta: parsedPlanMeta,
  };
}

export async function pushSnapshotToGoogleSheets(snapshot: BudgetSnapshot): Promise<void> {
  const sheets = getSheetsClient();
  const spreadsheetId = sheetId();

  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${SNAPSHOT_SHEET}!A:B`,
  });
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${SNAPSHOT_SHEET}!A:B`,
    valueInputOption: "RAW",
    requestBody: {
      values: [["key", "value"], ...encodeSnapshotRows(snapshot)],
    },
  });

  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${ROWS_SHEET}!A:N`,
  });
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${ROWS_SHEET}!A:N`,
    valueInputOption: "RAW",
    requestBody: {
      values: [
        [
          "id",
          "detail",
          "expense",
          "spreadMonths",
          "compensation",
          "source",
          "status",
          "startMonth",
          "isCancelled",
          "expenseByMonth",
          "compensationByMonth",
          "sourceByMonth",
          "statusByMonth",
          "planMeta",
        ],
        ...snapshot.rows.map(toRowRecord),
      ],
    },
  });
}

export async function pullSnapshotFromGoogleSheets(): Promise<BudgetSnapshot> {
  const sheets = getSheetsClient();
  const spreadsheetId = sheetId();

  const [snapshotRes, rowsRes] = await Promise.all([
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SNAPSHOT_SHEET}!A:B`,
    }),
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${ROWS_SHEET}!A:N`,
    }),
  ]);

  const snapshotRows = (snapshotRes.data.values ?? []).slice(1) as string[][];
  const rowRows = (rowsRes.data.values ?? []).slice(1) as string[][];

  if (snapshotRows.length === 0) {
    return DEFAULT_BUDGET_SNAPSHOT;
  }

  const parsedSnapshot = decodeSnapshotRows(snapshotRows);
  const parsedRows = rowRows.map(fromRowRecord).filter((row) => Number.isFinite(row.id));

  return {
    ...DEFAULT_BUDGET_SNAPSHOT,
    ...parsedSnapshot,
    rows: parsedRows,
  };
}
