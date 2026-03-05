export type RowStatus = "PENDING" | "PAID";

export type BudgetRow = {
  id: number;
  detail: string;
  expense: number;
  expenseByMonth?: Record<string, number>;
  startMonth?: number;
  spreadMonths: number;
  compensation: number;
  compensationByMonth?: Record<string, number>;
  source: string;
  sourceByMonth?: Record<string, string>;
  status: RowStatus;
  statusByMonth?: Record<string, RowStatus>;
  isCancelled?: boolean;
  planMeta?: {
    planId: string;
    termMonths: number;
    startMonth: number;
  };
};

export type BudgetSnapshot = {
  accountBalance: number;
  accountBalanceByMonth?: Record<string, number>;
  monthlyIncome: number;
  monthlyIncomeByMonth?: Record<string, number>;
  totalTables: number;
  rows: BudgetRow[];
  updatedAt: number;
};

export const DEFAULT_BUDGET_SNAPSHOT: BudgetSnapshot = {
  accountBalance: 0,
  accountBalanceByMonth: {},
  monthlyIncome: 0,
  monthlyIncomeByMonth: {},
  totalTables: 1,
  rows: [],
  updatedAt: 0,
};
