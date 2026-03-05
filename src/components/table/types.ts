import { RowStatus } from "@/lib/budgetState";

export type MonthDisplayRow = {
  id: number;
  itemNo: number;
  detail: string;
  expense: number;
  monthsLeft: number;
  compensation: number;
  source: string;
  status: RowStatus;
  balanceAfter: number;
};
