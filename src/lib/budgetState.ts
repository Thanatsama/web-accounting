export type RowStatus = "PENDING" | "PAID";
export type CardType = "JCB" | "THE_1" | "CARD_X" | "FIRST_CHOICE" | "UOB_ONE" | "SHOPPEE" | "TTB" | "HOME_PRO";

export const CARD_TYPE_OPTIONS: Array<{ value: CardType; label: string }> = [
  { value: "JCB", label: "JCB" },
  { value: "THE_1", label: "The 1" },
  { value: "CARD_X", label: "Card X" },
  { value: "FIRST_CHOICE", label: "First Choice" },
  { value: "UOB_ONE", label: "UOB One" },
  { value: "SHOPPEE", label: "Shopee" },
  { value: "TTB", label: "TTB" },
  { value: "HOME_PRO", label: "HomePro" },
];

export type BudgetRow = {
  id: number;
  detail: string;
  expense: number;
  expenseByMonth?: Record<string, number>;
  startMonth?: number;
  // null represents an ongoing automatic deduction with no installment term.
  spreadMonths: number | null;
  compensation: number;
  compensationByMonth?: Record<string, number>;
  source: string;
  sourceByMonth?: Record<string, string>;
  cardType?: CardType;
  cardTypeByMonth?: Record<string, CardType | null>;
  status: RowStatus;
  statusByMonth?: Record<string, RowStatus>;
  // Existing rows count as outstanding unless explicitly opted out.
  isOutstanding?: boolean;
  isCancelled?: boolean;
  planMeta?: {
    planId: string;
    termMonths: number;
    startMonth: number;
    originalPrice?: number;
    discountedPrice?: number;
    upfront?: number;
    discountPercent?: number;
  };
};

export type HomeExpense = {
  id: number;
  detail: string;
  amount: number;
  cardType?: CardType;
  status: RowStatus;
  paidAt?: number;
  isRecurring?: boolean;
  recurringGroupId?: number;
  isCancelled?: boolean;
};

export type BudgetSnapshot = {
  accountBalance: number;
  accountBalanceByMonth?: Record<string, number>;
  monthlyIncome: number;
  monthlyIncomeByMonth?: Record<string, number>;
  homeExpensesByMonth?: Record<string, HomeExpense[]>;
  totalTables: number;
  rows: BudgetRow[];
  updatedAt: number;
};

export const DEFAULT_BUDGET_SNAPSHOT: BudgetSnapshot = {
  accountBalance: 0,
  accountBalanceByMonth: {},
  monthlyIncome: 0,
  monthlyIncomeByMonth: {},
  homeExpensesByMonth: {},
  totalTables: 1,
  rows: [],
  updatedAt: 0,
};
