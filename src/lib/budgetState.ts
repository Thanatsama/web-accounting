export type RowStatus = "PENDING" | "PAID";
export type CardType = "JCB" | "THE_1" | "CARD_X" | "FIRST_CHOICE" | "UOB_ONE" | "SHOPPEE";

export const CARD_TYPE_OPTIONS: Array<{ value: CardType; label: string }> = [
  { value: "JCB", label: "JCB" },
  { value: "THE_1", label: "The 1" },
  { value: "CARD_X", label: "Card X" },
  { value: "FIRST_CHOICE", label: "First Choice" },
  { value: "UOB_ONE", label: "UOB One" },
  { value: "SHOPPEE", label: "Shopee" },
];

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
  cardType?: CardType;
  cardTypeByMonth?: Record<string, CardType>;
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
