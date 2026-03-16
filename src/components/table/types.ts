import { CardType, RowStatus } from "@/lib/budgetState";

export type MonthDisplayRow = {
  id: number;
  itemNo: number;
  detail: string;
  expense: number;
  monthsLeft: number;
  compensation: number;
  source: string;
  cardType?: CardType;
  status: RowStatus;
  balanceAfter: number;
};
