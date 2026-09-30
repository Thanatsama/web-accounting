import { CardType, RowStatus } from "@/lib/budgetState";

export type MonthDisplayRow = {
  id: number;
  itemNo: number;
  detail: string;
  expense: number;
  monthsLeft: number | null;
  totalMonths: number | null;
  compensation: number;
  source: string;
  cardType?: CardType;
  status: RowStatus;
  balanceAfter: number;
};
