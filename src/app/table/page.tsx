'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import map from 'lodash/map';
import {
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  MenuItem,
  Stack,
  SxProps,
  TextField,
  Theme,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { readBudgetFromServer, writeBudgetToServer } from '@/lib/budgetApi';
import { getCurrentRoundIndex, getMonthInputValue, getRoundIndexFromDate, getRoundLabel } from '@/lib/budgetCalendar';
import { BudgetRow, CardType, RowStatus } from '@/lib/budgetState';
import { CARD_TYPE_SELECT_OPTIONS, CardTypeInput } from '@/lib/cardBrand';
import { ensureUniqueDetail, getDetailKey } from '@/lib/detailName';
import { readBudgetSnapshot, updateBudgetSnapshot, writeBudgetSnapshot } from '@/lib/indexedDbBudget';
import { useEffectiveCurrentDate } from '@/lib/testingDate';
import DesktopRowsTable from '@/components/table/DesktopRowsTable';
import MobileMonthSummary from '@/components/table/MobileMonthSummary';
import { MonthDisplayRow } from '@/components/table/types';
import MarketingLayout from '@/components/layout/MarketingLayout';
import styles from './page.module.css';

type DisplayRow = {
  id: number;
  itemNo: number;
  detail: string;
  expense: number;
  monthsLeft: number;
  totalMonths: number;
  compensation: number;
  source: string;
  cardType?: CardType;
  status: RowStatus;
};

type PendingSummaryAggregateItem = {
  detail: string;
  totalExpense: number;
};

const STATUS_OPTIONS: RowStatus[] = ['PENDING', 'PAID'];

function formatNumber(value: number): string {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function createTableIndexes(total: number): number[] {
  const result: number[] = [];
  for (let i = 1; i <= total; i += 1) {
    result.push(i);
  }
  return result;
}

function nowTimestamp(): number {
  return new Date().getTime();
}

function getRowStartMonth(row: BudgetRow): number {
  return Math.max(1, Math.floor(row.startMonth ?? 1));
}

function getRowEndMonth(row: BudgetRow): number {
  return getRowStartMonth(row) + Math.max(1, Math.floor(row.spreadMonths)) - 1;
}

function buildDefaultExpenseByMonth(spreadMonths: number, expense: number, startMonth: number = 1): Record<string, number> {
  const result: Record<string, number> = {};
  for (let i = 0; i < spreadMonths; i += 1) {
    result[String(startMonth + i)] = expense;
  }
  return result;
}

function resolveExpenseByMonth(row: BudgetRow, tableIndex: number): number {
  const monthKey = String(tableIndex);
  return row.expenseByMonth?.[monthKey] ?? row.expense;
}

function resolveCompensationByMonth(row: BudgetRow, tableIndex: number): number {
  const monthKey = String(tableIndex);
  return row.compensationByMonth?.[monthKey] ?? row.compensation;
}

function resolveSourceByMonth(row: BudgetRow, tableIndex: number): string {
  const monthKey = String(tableIndex);
  return row.sourceByMonth?.[monthKey] ?? row.source;
}

function resolveStatusByMonth(row: BudgetRow, tableIndex: number): RowStatus {
  const monthKey = String(tableIndex);
  return row.statusByMonth?.[monthKey] ?? row.status;
}

function resolveCardTypeByMonth(row: BudgetRow, tableIndex: number): CardType | undefined {
  const monthKey = String(tableIndex);
  return row.cardTypeByMonth?.[monthKey] ?? row.cardType;
}

function resolveMonthlyIncomeByMonth(
  monthlyIncome: number,
  monthlyIncomeByMonth: Record<string, number> | undefined,
  tableIndex: number,
): number {
  const monthValue = monthlyIncomeByMonth?.[String(tableIndex)];
  if (typeof monthValue !== 'number' || !Number.isFinite(monthValue)) {
    return monthlyIncome;
  }
  return monthValue;
}

function resolveAccountBalanceByMonth(
  accountBalance: number,
  accountBalanceByMonth: Record<string, number> | undefined,
  tableIndex: number,
): number | null {
  const monthValue = accountBalanceByMonth?.[String(tableIndex)];
  if (typeof monthValue !== 'number' || !Number.isFinite(monthValue)) {
    return tableIndex === 1 ? accountBalance : null;
  }
  return monthValue;
}

function isCustomMonthlyIncomeByMonth(monthlyIncomeByMonth: Record<string, number> | undefined, tableIndex: number): boolean {
  const value = monthlyIncomeByMonth?.[String(tableIndex)];
  return typeof value === 'number' && Number.isFinite(value);
}

function parseNumberInput(value: string): number | null {
  const normalized = value.replace(/[^\d.-]/g, '');
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function getRemainingValueClassName(value: number): string {
  if (value > 50000) return styles.remainingValueBlue;
  if (value > 10000) return styles.remainingValueYellow;
  return styles.remainingValueGreen;
}

function buildDisplayRows(rows: BudgetRow[], tableIndex: number): DisplayRow[] {
  const result: Omit<DisplayRow, 'itemNo'>[] = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (row.isCancelled) continue;
    const startMonth = getRowStartMonth(row);
    const endMonth = getRowEndMonth(row);
    if (tableIndex >= startMonth && tableIndex <= endMonth) {
      result.push({
        id: row.id,
        detail: row.detail,
        expense: resolveExpenseByMonth(row, tableIndex),
        monthsLeft: endMonth - tableIndex + 1,
        totalMonths: Math.max(1, Math.floor(row.spreadMonths)),
        compensation: resolveCompensationByMonth(row, tableIndex),
        source: resolveSourceByMonth(row, tableIndex),
        cardType: resolveCardTypeByMonth(row, tableIndex),
        status: resolveStatusByMonth(row, tableIndex),
      });
    }
  }

  const sortedByMonthsLeft = [...result].sort((a, b) => a.monthsLeft - b.monthsLeft);
  return map(sortedByMonthsLeft, (row, index) => ({
    ...row,
    itemNo: index + 1,
  }));
}

function monthValueToRound(monthValue: string): number {
  const [yearRaw, monthRaw] = monthValue.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return 1;
  return getRoundIndexFromDate(new Date(year, month - 1, 1));
}

function propagateCardTypeToMatchingRows(
  rows: BudgetRow[],
  targetRowId: number,
  targetDetail: string,
  tableIndex: number,
  nextCardType: CardType | undefined,
): BudgetRow[] {
  if (!nextCardType) return rows;

  const targetDetailKey = getDetailKey(targetDetail);
  if (!targetDetailKey) return rows;

  return map(rows, (row) => {
    if (row.id === targetRowId) return row;
    if (getDetailKey(row.detail) !== targetDetailKey) return row;

    if (!row.cardType) {
      const nextCardTypeByMonth = { ...(row.cardTypeByMonth ?? {}) };
      delete nextCardTypeByMonth[String(tableIndex)];
      return {
        ...row,
        cardType: nextCardType,
        cardTypeByMonth: Object.keys(nextCardTypeByMonth).length > 0 ? nextCardTypeByMonth : undefined,
      };
    }

    if (resolveCardTypeByMonth(row, tableIndex)) return row;

    const monthKey = String(tableIndex);
    return {
      ...row,
      cardTypeByMonth: {
        ...(row.cardTypeByMonth ?? {}),
        [monthKey]: nextCardType,
      },
    };
  });
}

export default function TablePage() {
  const theme = useTheme();
  const isMobileView = useMediaQuery(theme.breakpoints.down('sm'));
  const [totalTables, setTotalTables] = useState(1);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [accountBalanceByMonth, setAccountBalanceByMonth] = useState<Record<string, number>>({});
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [monthlyIncomeByMonth, setMonthlyIncomeByMonth] = useState<Record<string, number>>({});
  const [rows, setRows] = useState<BudgetRow[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isMonthIncomeOpen, setIsMonthIncomeOpen] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [showPendingSummary, setShowPendingSummary] = useState(false);
  const [deleteRowTarget, setDeleteRowTarget] = useState<{ id: number; detail: string } | null>(null);
  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  const [editingTableIndex, setEditingTableIndex] = useState<number>(1);
  const [editingCanCancel, setEditingCanCancel] = useState(false);
  const [editingMonthIncomeTableIndex, setEditingMonthIncomeTableIndex] = useState<number>(1);
  const [editingMonthIncomeValue, setEditingMonthIncomeValue] = useState('0');

  const [detail, setDetail] = useState('');
  const [expense, setExpense] = useState('0');
  const [spreadMonths, setSpreadMonths] = useState('1');
  const [itemStartMonth, setItemStartMonth] = useState(getMonthInputValue());
  const [compensation, setCompensation] = useState('0');
  const [source, setSource] = useState('');
  const [cardType, setCardType] = useState<CardTypeInput>('');
  const [status, setStatus] = useState<RowStatus>('PENDING');
  const [editDetail, setEditDetail] = useState('');
  const [editExpense, setEditExpense] = useState('0');
  const [editCompensation, setEditCompensation] = useState('0');
  const [editSource, setEditSource] = useState('');
  const [editCardType, setEditCardType] = useState<CardTypeInput>('');
  const [editStatus, setEditStatus] = useState<RowStatus>('PENDING');
  const currentDate = useEffectiveCurrentDate();
  const formFieldSx: SxProps<Theme> = {
    '& .MuiOutlinedInput-root': {
      borderRadius: '12px',
      backgroundColor: '#fcfdff',
    },
    '& .MuiInputBase-input': { py: 1.1 },
    '& .MuiFormHelperText-root': { mt: 0.6 },
  };

  const tableIndexes = useMemo(() => createTableIndexes(totalTables), [totalTables]);
  const currentRoundIndex = useMemo(() => getCurrentRoundIndex(totalTables, currentDate), [totalTables, currentDate]);
  const currentMonthValue = useMemo(() => getMonthInputValue(currentDate), [currentDate]);
  const selectedStartRound = useMemo(() => monthValueToRound(itemStartMonth), [itemStartMonth]);
  const activeTableIndexes = useMemo(
    () => tableIndexes.filter((index) => index >= currentRoundIndex),
    [tableIndexes, currentRoundIndex],
  );
  const archivedTableIndexes = useMemo(
    () => tableIndexes.filter((index) => index < currentRoundIndex).sort((a, b) => b - a),
    [tableIndexes, currentRoundIndex],
  );

  useEffect(() => {
    let mounted = true;

    const hydrate = async () => {
      const local = await readBudgetSnapshot();
      let nextSnapshot = local;
      const fromServer = await readBudgetFromServer();
      if (fromServer && fromServer.updatedAt > local.updatedAt) {
        nextSnapshot = fromServer;
        await writeBudgetSnapshot(fromServer);
      }

      if (!mounted) return;
      setRows(nextSnapshot.rows);
      setTotalTables(Math.max(1, nextSnapshot.totalTables));
      setOpeningBalance(nextSnapshot.accountBalance);
      setAccountBalanceByMonth(nextSnapshot.accountBalanceByMonth ?? {});
      setMonthlyIncome(nextSnapshot.monthlyIncome);
      setMonthlyIncomeByMonth(nextSnapshot.monthlyIncomeByMonth ?? {});
    };

    void hydrate();

    const onAccountBalanceUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{
        snapshot?: {
          accountBalance?: number;
          accountBalanceByMonth?: Record<string, number>;
          monthlyIncome?: number;
          monthlyIncomeByMonth?: Record<string, number>;
          totalTables?: number;
          rows?: BudgetRow[];
        };
      }>;
      const nextSnapshot = customEvent.detail?.snapshot;
      if (!nextSnapshot) return;
      if (typeof nextSnapshot.accountBalance === 'number') {
        setOpeningBalance(nextSnapshot.accountBalance);
      }
      if (typeof nextSnapshot.monthlyIncome === 'number') {
        setMonthlyIncome(nextSnapshot.monthlyIncome);
      }
      if (nextSnapshot.accountBalanceByMonth && typeof nextSnapshot.accountBalanceByMonth === 'object') {
        setAccountBalanceByMonth(nextSnapshot.accountBalanceByMonth);
      }
      if (nextSnapshot.monthlyIncomeByMonth && typeof nextSnapshot.monthlyIncomeByMonth === 'object') {
        setMonthlyIncomeByMonth(nextSnapshot.monthlyIncomeByMonth);
      }
      if (Array.isArray(nextSnapshot.rows)) {
        setRows(nextSnapshot.rows);
      }
      if (typeof nextSnapshot.totalTables === 'number') {
        setTotalTables(Math.max(1, nextSnapshot.totalTables));
      }
    };

    window.addEventListener('account-balance-updated', onAccountBalanceUpdate);
    return () => {
      mounted = false;
      window.removeEventListener('account-balance-updated', onAccountBalanceUpdate);
    };
  }, []);

  const openAddDialog = () => {
    setItemStartMonth(currentMonthValue);
    setIsAddOpen(true);
  };

  const closeAddDialog = () => {
    setIsAddOpen(false);
    setDetail('');
    setExpense('0');
    setSpreadMonths('1');
    setItemStartMonth(currentMonthValue);
    setCompensation('0');
    setSource('');
    setCardType('');
    setStatus('PENDING');
  };

  const handleAddRow = (event: FormEvent) => {
    event.preventDefault();
    void (async () => {
      const expenseNumber = Number(expense);
      const spreadNumber = Number(spreadMonths);
      const compensationNumber = Number(compensation);
      const startMonth = monthValueToRound(itemStartMonth);

      if (!Number.isFinite(expenseNumber) || expenseNumber < 0) return;
      if (!Number.isFinite(spreadNumber) || spreadNumber < 1) return;
      if (!Number.isFinite(compensationNumber) || compensationNumber < 0) return;
      if (!Number.isFinite(startMonth) || startMonth < currentRoundIndex) return;

      const normalizedSpread = Math.floor(spreadNumber);
      const trimmedDetail = detail.trim();
      const nextDetail = ensureUniqueDetail(
        trimmedDetail,
        rows.map((row) => row.detail),
        `รายการ ${rows.length + 1}`,
      );

      const newRow: BudgetRow = {
        id: nowTimestamp(),
        detail: nextDetail,
        expense: expenseNumber,
        expenseByMonth: buildDefaultExpenseByMonth(normalizedSpread, expenseNumber, startMonth),
        startMonth,
        spreadMonths: normalizedSpread,
        compensation: compensationNumber,
        source: source.trim(),
        cardType: cardType || undefined,
        status,
      };

      const nextSnapshot = await updateBudgetSnapshot((current) => {
        const nextRows = [...current.rows, newRow];
        const rowEndMonth = getRowEndMonth(newRow);
        return {
          ...current,
          rows: nextRows,
          totalTables: Math.max(current.totalTables, rowEndMonth, 1),
          updatedAt: nowTimestamp(),
        };
      });

      setRows(nextSnapshot.rows);
      setTotalTables(nextSnapshot.totalTables);
      setOpeningBalance(nextSnapshot.accountBalance);
      setAccountBalanceByMonth(nextSnapshot.accountBalanceByMonth ?? {});
      setMonthlyIncome(nextSnapshot.monthlyIncome);
      setMonthlyIncomeByMonth(nextSnapshot.monthlyIncomeByMonth ?? {});
      void writeBudgetToServer(nextSnapshot);
      closeAddDialog();
    })();
  };

  const saveRowsNow = (nextRows: BudgetRow[], nextTotalTables: number, updatedAt: number) => {
    const snapshot = {
      accountBalance: openingBalance,
      accountBalanceByMonth,
      monthlyIncome,
      monthlyIncomeByMonth,
      totalTables: Math.max(1, nextTotalTables),
      rows: nextRows,
      updatedAt,
    };
    void writeBudgetSnapshot(snapshot);
    void writeBudgetToServer(snapshot);
  };

  const updateRowField = (
    rowId: number,
    patch: Partial<Pick<BudgetRow, 'detail' | 'status' | 'isCancelled' | 'cardType'>>,
    monthPatch?: {
      tableIndex: number;
      expense: number;
      compensation: number;
      source: string;
      status: RowStatus;
      cardType: CardTypeInput;
    },
  ) => {
    const updatedAt = nowTimestamp();
    setRows((prev) => {
      const nextRows = map(prev, (row) => {
        if (row.id !== rowId) return row;

        if (!monthPatch) return { ...row, ...patch };

        const monthKey = String(monthPatch.tableIndex);
        const nextCardTypeByMonth = { ...(row.cardTypeByMonth ?? {}) };
        let nextDefaultCardType = row.cardType;

        if (monthPatch.tableIndex === 1) {
          nextDefaultCardType = monthPatch.cardType || undefined;
          delete nextCardTypeByMonth[monthKey];
        } else if (monthPatch.cardType) {
          if (!row.cardType) {
            nextDefaultCardType = monthPatch.cardType;
            delete nextCardTypeByMonth[monthKey];
          } else {
            nextCardTypeByMonth[monthKey] = monthPatch.cardType;
          }
        } else {
          delete nextCardTypeByMonth[monthKey];
        }

        return {
          ...row,
          ...patch,
          cardType: nextDefaultCardType,
          cardTypeByMonth: Object.keys(nextCardTypeByMonth).length > 0 ? nextCardTypeByMonth : undefined,
          expenseByMonth: {
            ...(row.expenseByMonth ?? {}),
            [monthKey]: monthPatch.expense,
          },
          compensationByMonth: {
            ...(row.compensationByMonth ?? {}),
            [monthKey]: monthPatch.compensation,
          },
          sourceByMonth: {
            ...(row.sourceByMonth ?? {}),
            [monthKey]: monthPatch.source,
          },
          statusByMonth: {
            ...(row.statusByMonth ?? {}),
            [monthKey]: monthPatch.status,
          },
        };
      });
      const targetRow = nextRows.find((row) => row.id === rowId);
      const propagatedRows =
        targetRow && monthPatch
          ? propagateCardTypeToMatchingRows(
              nextRows,
              rowId,
              targetRow.detail,
              monthPatch.tableIndex,
              monthPatch.cardType || undefined,
            )
          : nextRows;
      const inferredTotalTables = propagatedRows.reduce((maxMonth, row) => Math.max(maxMonth, getRowEndMonth(row)), 1);
      const nextTotalTables = Math.max(totalTables, inferredTotalTables);
      if (nextTotalTables !== totalTables) {
        setTotalTables(nextTotalTables);
      }
      saveRowsNow(propagatedRows, nextTotalTables, updatedAt);
      return propagatedRows;
    });
  };

  const openEditDialog = (rowId: number, tableIndex: number) => {
    const target = rows.find((row) => row.id === rowId);
    if (!target) return;

    const monthExpense = resolveExpenseByMonth(target, tableIndex);
    const monthCompensation = resolveCompensationByMonth(target, tableIndex);
    const monthSource = resolveSourceByMonth(target, tableIndex);
    const monthStatus = resolveStatusByMonth(target, tableIndex);
    const monthCardType = resolveCardTypeByMonth(target, tableIndex);

    setEditingRowId(target.id);
    setEditingTableIndex(tableIndex);
    setEditDetail(target.detail);
    setEditExpense(String(monthExpense));
    setEditCompensation(String(monthCompensation));
    setEditSource(monthSource);
    setEditCardType(monthCardType ?? '');
    setEditStatus(monthStatus);
    setEditingCanCancel(Boolean(target.planMeta) && !target.isCancelled);
    setIsEditOpen(true);
  };

  const closeEditDialog = () => {
    setIsEditOpen(false);
    setEditingRowId(null);
    setEditingTableIndex(1);
    setEditingCanCancel(false);
    setEditCardType('');
  };

  const handleSaveEdit = () => {
    if (editingRowId === null) return;

    const nextExpense = Number(editExpense);
    const nextCompensation = Number(editCompensation);
    if (!Number.isFinite(nextExpense) || nextExpense < 0) return;
    if (!Number.isFinite(nextCompensation) || nextCompensation < 0) return;

    const currentRow = rows.find((row) => row.id === editingRowId);
    if (!currentRow) return;

    const nextDetail = ensureUniqueDetail(
      editDetail,
      rows.map((row) => row.detail),
      currentRow.detail || `รายการ ${editingRowId}`,
      [currentRow.detail],
    );

    updateRowField(
      editingRowId,
      {
        detail: nextDetail,
        cardType: editCardType || undefined,
      },
      {
        tableIndex: editingTableIndex,
        expense: nextExpense,
        compensation: nextCompensation,
        source: editSource,
        cardType: editCardType,
        status: editStatus,
      },
    );
    closeEditDialog();
  };

  const handleCancelPlanRow = () => {
    if (editingRowId === null) return;
    updateRowField(editingRowId, { isCancelled: true });
    closeEditDialog();
  };

  const openDeleteRowDialog = () => {
    if (editingRowId === null) return;
    const target = rows.find((row) => row.id === editingRowId);
    if (!target) return;
    setDeleteRowTarget({
      id: target.id,
      detail: target.detail || `รายการ ${target.id}`,
    });
  };

  const closeDeleteRowDialog = () => {
    setDeleteRowTarget(null);
  };

  const confirmDeleteRow = () => {
    if (!deleteRowTarget) return;

    const updatedAt = nowTimestamp();
    const nextRows = rows.filter((row) => row.id !== deleteRowTarget.id);
    const inferredTotalTables = nextRows.reduce((maxMonth, row) => Math.max(maxMonth, getRowEndMonth(row)), 1);
    const nextTotalTables = Math.max(1, inferredTotalTables);

    setRows(nextRows);
    setTotalTables(nextTotalTables);
    saveRowsNow(nextRows, nextTotalTables, updatedAt);
    closeDeleteRowDialog();
    closeEditDialog();
  };

  const openMonthIncomeDialog = (tableIndex: number) => {
    const currentValue = resolveMonthlyIncomeByMonth(monthlyIncome, monthlyIncomeByMonth, tableIndex);
    setEditingMonthIncomeTableIndex(tableIndex);
    setEditingMonthIncomeValue(String(currentValue));
    setIsMonthIncomeOpen(true);
  };

  const closeMonthIncomeDialog = () => {
    setIsMonthIncomeOpen(false);
    setEditingMonthIncomeTableIndex(1);
    setEditingMonthIncomeValue('0');
  };

  const saveMonthIncomeDialog = () => {
    const parsed = parseNumberInput(editingMonthIncomeValue);
    if (parsed === null || parsed < 0) return;
    void (async () => {
      const tableIndex = editingMonthIncomeTableIndex;
      const value = parsed;
      const monthKey = String(tableIndex);
      const nextSnapshot = await updateBudgetSnapshot((current) => ({
        ...current,
        monthlyIncomeByMonth: {
          ...(current.monthlyIncomeByMonth ?? {}),
          [monthKey]: value,
        },
        totalTables: Math.max(current.totalTables, tableIndex, 1),
        updatedAt: nowTimestamp(),
      }));

      setRows(nextSnapshot.rows);
      setTotalTables(nextSnapshot.totalTables);
      setOpeningBalance(nextSnapshot.accountBalance);
      setAccountBalanceByMonth(nextSnapshot.accountBalanceByMonth ?? {});
      setMonthlyIncome(nextSnapshot.monthlyIncome);
      setMonthlyIncomeByMonth(nextSnapshot.monthlyIncomeByMonth ?? {});
      void writeBudgetToServer(nextSnapshot);
      closeMonthIncomeDialog();
    })();
  };

  const resetMonthIncomeToDefault = () => {
    void (async () => {
      const monthKey = String(editingMonthIncomeTableIndex);
      const nextSnapshot = await updateBudgetSnapshot((current) => {
        const nextMap = { ...(current.monthlyIncomeByMonth ?? {}) };
        delete nextMap[monthKey];
        return {
          ...current,
          monthlyIncomeByMonth: nextMap,
          updatedAt: nowTimestamp(),
        };
      });

      setRows(nextSnapshot.rows);
      setTotalTables(nextSnapshot.totalTables);
      setOpeningBalance(nextSnapshot.accountBalance);
      setAccountBalanceByMonth(nextSnapshot.accountBalanceByMonth ?? {});
      setMonthlyIncome(nextSnapshot.monthlyIncome);
      setMonthlyIncomeByMonth(nextSnapshot.monthlyIncomeByMonth ?? {});
      void writeBudgetToServer(nextSnapshot);
      closeMonthIncomeDialog();
    })();
  };

  const expenseByMonth = useMemo(() => {
    return map(tableIndexes, (tableIndex) => {
      const displayRows = buildDisplayRows(rows, tableIndex);
      return displayRows.reduce((sum, row) => sum + row.expense, 0);
    });
  }, [tableIndexes, rows]);

  const pendingSummaryAggregates = useMemo(() => {
    const grouped = new Map<string, PendingSummaryAggregateItem>();

    tableIndexes.forEach((tableIndex) => {
      buildDisplayRows(rows, tableIndex)
        .filter((row) => row.status === 'PENDING')
        .forEach((row) => {
          const originalRow = rows.find((item) => item.id === row.id);
          if (originalRow?.planMeta) return;

          const detail = row.detail || `รายการ ${row.id}`;
          const existing = grouped.get(detail);
          if (existing) {
            existing.totalExpense += row.expense;
            return;
          }
          grouped.set(detail, {
            detail,
            totalExpense: row.expense,
          });
        });
    });

    return Array.from(grouped.values()).sort((a, b) => b.totalExpense - a.totalExpense);
  }, [tableIndexes, rows]);

  const totalPendingExpense = useMemo(
    () => pendingSummaryAggregates.reduce((sum, item) => sum + item.totalExpense, 0),
    [pendingSummaryAggregates],
  );

  const monthEndingByMonth = useMemo(() => {
    const endings: number[] = [];
    for (let i = 0; i < tableIndexes.length; i += 1) {
      const tableIndex = i + 1;
      const monthIncome = resolveMonthlyIncomeByMonth(monthlyIncome, monthlyIncomeByMonth, tableIndex);
      const fallbackStartBalance = i === 0 ? openingBalance : (endings[i - 1] ?? openingBalance) + monthIncome;
      const overriddenStartBalance = resolveAccountBalanceByMonth(openingBalance, accountBalanceByMonth, tableIndex);
      const startBalance = overriddenStartBalance ?? fallbackStartBalance;
      const displayRows = buildDisplayRows(rows, tableIndex);
      const endBalance = displayRows.reduce((running, row) => running + row.compensation - row.expense, startBalance);
      endings.push(endBalance);
    }
    return endings;
  }, [tableIndexes.length, rows, openingBalance, accountBalanceByMonth, monthlyIncome, monthlyIncomeByMonth]);

  const roundStartingByMonth = useMemo(() => {
    const starts: number[] = [];
    for (let i = 0; i < tableIndexes.length; i += 1) {
      if (i === 0) {
        starts.push(openingBalance);
      } else {
        const prevEnding = monthEndingByMonth[i - 1] ?? openingBalance;
        const tableIndex = i + 1;
        const monthIncome = resolveMonthlyIncomeByMonth(monthlyIncome, monthlyIncomeByMonth, tableIndex);
        const fallbackStartBalance = prevEnding + monthIncome;
        const overriddenStartBalance = resolveAccountBalanceByMonth(openingBalance, accountBalanceByMonth, tableIndex);
        starts.push(overriddenStartBalance ?? fallbackStartBalance);
      }
    }
    return starts;
  }, [tableIndexes.length, openingBalance, accountBalanceByMonth, monthlyIncome, monthlyIncomeByMonth, monthEndingByMonth]);

  return (
    <MarketingLayout>
      <Container maxWidth="lg" className={styles.wrapper}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', md: 'center' }}
          gap={2}
          mb={2}
        >
          <Box>
            <Typography variant="h3" className={styles.title}>
              รายการจ่าย
            </Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2}>
            <Box className={styles.summaryField}>
              <Typography className={styles.summaryLabel}>จำนวนเดือนทั้งหมด</Typography>
              <Typography className={styles.summaryValue}>{totalTables}</Typography>
            </Box>
            <Box className={styles.summaryField}>
              <Typography className={styles.summaryLabel}>ยอดคงเหลือ (THB)</Typography>
              <Typography className={styles.summaryValue}>{formatNumber(openingBalance)}</Typography>
            </Box>
            {!isMobileView && (
              <Button
                variant="contained"
                onClick={openAddDialog}
                startIcon={<AddRoundedIcon />}
                sx={{
                  borderRadius: '18px',
                  px: 1.2,
                  py: 0.45,
                  alignSelf: { xs: 'flex-start', sm: 'center' },
                  maxHeight: 48,
                  minWidth: { xs: 124, sm: 0 },
                  fontSize: '0.86rem',
                  fontWeight: 600,
                  background: 'linear-gradient(135deg, #0071e3, #2b8cff)',
                  boxShadow: '0 4px 12px rgba(0,113,227,0.22)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #0067d1, #1e7ff0)',
                    boxShadow: '0 6px 14px rgba(0,113,227,0.28)',
                  },
                }}
              >
                เพิ่มรายการ
              </Button>
            )}
          </Stack>
        </Stack>
        {isMobileView && (
          <Typography className={styles.mobileReadonlyHint}>
            โหมดมือถือเป็น View Only (สรุปผล) กรุณาใช้หน้าจอใหญ่เพื่อแก้ไขรายการ
          </Typography>
        )}

        <Box className={styles.archiveToolbar}>
          <Button
            size="small"
            variant="outlined"
            className={styles.pendingSummaryButton}
            onClick={() => setShowPendingSummary(true)}
            color="success"
          >
            สรุปยอดค้าง
          </Button>
          {!isMobileView && (
            <Button
              size="small"
              variant="outlined"
              className={styles.archiveButton}
              color="primary"
              onClick={() => setShowArchive(true)}
            >
              {`Archive (${archivedTableIndexes.length})`}
            </Button>
          )}
        </Box>

        <Box className={styles.tableList}>
          {map(activeTableIndexes, (tableIndex) => {
            const displayRows = buildDisplayRows(rows, tableIndex);
            const monthArrayIndex = tableIndex - 1;
            const totalExpenseThisMonth = expenseByMonth[monthArrayIndex] ?? 0;
            const roundStartingBalance = roundStartingByMonth[monthArrayIndex] ?? openingBalance;
            const isCustomMonthIncome = isCustomMonthlyIncomeByMonth(monthlyIncomeByMonth, tableIndex);
            let runningRowBalance = roundStartingBalance;
            const displayRowsWithBalance: MonthDisplayRow[] = map(displayRows, (row) => {
              runningRowBalance = runningRowBalance + row.compensation - row.expense;
              return { ...row, balanceAfter: runningRowBalance };
            });
            const remainingThisMonth = monthEndingByMonth[monthArrayIndex] ?? roundStartingBalance;
            return (
              <section key={tableIndex} className={styles.tableCard}>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" className={styles.tableHeadingRow}>
                  <Box className={styles.tableTitleBlock}>
                    <Typography variant="h6" className={styles.tableHeading}>
                      รอบจ่าย {getRoundLabel(tableIndex)}
                    </Typography>
                    <Typography className={styles.roundBaseLabel}>
                      ยอดตั้งต้นรอบนี้: {formatNumber(roundStartingBalance)} THB
                    </Typography>
                  </Box>
                  <Box className={styles.monthSummaryGroup}>
                    <Box
                      className={`${styles.monthRemaining} ${styles.monthRemainingClickable} ${
                        isCustomMonthIncome ? styles.monthRemainingCustom : ''
                      }`}
                      onClick={() => {
                        if (!isMobileView) openMonthIncomeDialog(tableIndex);
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          if (!isMobileView) openMonthIncomeDialog(tableIndex);
                        }
                      }}
                    >
                      <Typography
                        className={styles.monthRemainingLabel}
                        sx={{ color: isCustomMonthIncome ? '#086F3A' : '#38679a' }}
                      >
                        คงเหลือต่อเดือน
                      </Typography>
                      <Typography
                        className={styles.monthRemainingValue}
                        sx={{ color: isCustomMonthIncome ? '#086F3A' : '#38679a' }}
                      >
                        {formatNumber(remainingThisMonth)} THB
                      </Typography>
                    </Box>
                    <Box className={styles.monthExpenseSummary}>
                      <Typography className={styles.monthExpenseLabel}>สรุปค่าใช้จ่าย</Typography>
                      <Typography className={styles.monthExpenseValue}>{formatNumber(totalExpenseThisMonth)} THB</Typography>
                    </Box>
                  </Box>
                </Stack>
                {!isMobileView && (
                  <DesktopRowsTable
                    rows={displayRowsWithBalance}
                    onRowClick={(rowId) => openEditDialog(rowId, tableIndex)}
                    formatNumber={formatNumber}
                  />
                )}
                {isMobileView && <MobileMonthSummary rows={displayRowsWithBalance} />}
              </section>
            );
          })}
        </Box>

        <Dialog
          open={showPendingSummary}
          onClose={() => setShowPendingSummary(false)}
          fullWidth
          maxWidth="md"
          slotProps={{
            paper: {
              sx: {
                borderRadius: 2,
                background: 'linear-gradient(180deg, #ffffff, #f8fbff)',
                border: '1px solid rgba(0,0,0,0.08)',
              },
            },
          }}
        >
          <DialogTitle sx={{ pb: 0.5 }}>
            <Typography component="div" variant="h6" sx={{ fontWeight: 700 }}>
              สรุปค่าใช้จ่ายที่ยังไม่ได้จ่าย
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ pt: '8px !important', maxHeight: '72vh' }}>
            <Box className={styles.pendingSummarySingleCard}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                spacing={1}
                mb={1.3}
              >
                <Box>
                  <Typography className={styles.pendingSummarySectionTitle}>สรุปรวมสำหรับปิดยอดก่อนกำหนด</Typography>
                  <Typography className={styles.pendingSummarySubtle}>
                    รวมเฉพาะรายการสินค้าที่ยัง `PENDING` และไม่รวม plan
                  </Typography>
                </Box>
                <Box className={styles.pendingSummaryTotalPill}>
                  <Typography className={styles.pendingSummaryTotalLabel}>ยอดคงเหลือรวม</Typography>
                  <Typography className={`${styles.pendingSummaryTotalValue} ${getRemainingValueClassName(totalPendingExpense)}`}>
                    {formatNumber(totalPendingExpense)} THB
                  </Typography>
                </Box>
              </Stack>

              <Stack spacing={0.85}>
                {pendingSummaryAggregates.length === 0 && <Typography color="text.secondary">ไม่มีรายการค้างชำระ</Typography>}
                {map(pendingSummaryAggregates, (item, index) => (
                  <Box key={`pending-aggregate-${item.detail}`} className={styles.pendingAggregateRow}>
                    <Typography className={styles.pendingAggregateLabel}>
                      {index + 1}. {item.detail}
                    </Typography>
                    <Typography className={`${styles.pendingAggregateValue} `}>
                      <span className={`${getRemainingValueClassName(item.totalExpense)}`}>
                        {formatNumber(item.totalExpense)} THB
                      </span>
                    
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setShowPendingSummary(false)}>ปิด</Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={showArchive}
          onClose={() => setShowArchive(false)}
          fullWidth
          maxWidth="lg"
          slotProps={{
            paper: {
              sx: {
                borderRadius: 2,
                background: 'linear-gradient(180deg, #ffffff, #f8fbff)',
                border: '1px solid rgba(0,0,0,0.08)',
              },
            },
          }}
        >
          <DialogTitle sx={{ pb: 0.6 }}>
            <Typography component="div" variant="h6" sx={{ fontWeight: 700 }}>
              Archive (อ่านอย่างเดียว)
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ pt: '8px !important', maxHeight: '72vh' }}>
            <Stack spacing={1.2}>
              {archivedTableIndexes.length === 0 && <Typography color="text.secondary">ยังไม่มีเดือนที่ผ่านมา</Typography>}
              {map(archivedTableIndexes, (tableIndex) => {
                const displayRows = buildDisplayRows(rows, tableIndex);
                const monthArrayIndex = tableIndex - 1;
                const totalExpenseThisMonth = expenseByMonth[monthArrayIndex] ?? 0;
                const roundStartingBalance = roundStartingByMonth[monthArrayIndex] ?? openingBalance;
                const remainingThisMonth = monthEndingByMonth[monthArrayIndex] ?? roundStartingBalance;
                const isCustomMonthIncome = isCustomMonthlyIncomeByMonth(monthlyIncomeByMonth, tableIndex);
                let runningRowBalance = roundStartingBalance;
                const displayRowsWithBalance: MonthDisplayRow[] = map(displayRows, (row) => {
                  runningRowBalance = runningRowBalance + row.compensation - row.expense;
                  return { ...row, balanceAfter: runningRowBalance };
                });

                return (
                  <section key={`archive-${tableIndex}`} className={styles.tableCard}>
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      justifyContent="space-between"
                      className={styles.tableHeadingRow}
                    >
                      <Box className={styles.tableTitleBlock}>
                        <Typography variant="h6" className={styles.tableHeading}>
                          รอบจ่าย {getRoundLabel(tableIndex)}
                        </Typography>
                        <Typography className={styles.roundBaseLabel}>
                          ยอดตั้งต้นรอบนี้: {formatNumber(roundStartingBalance)} THB
                        </Typography>
                      </Box>
                      <Box className={styles.monthSummaryGroup}>
                        <Box className={`${styles.monthRemaining} ${isCustomMonthIncome ? styles.monthRemainingCustom : ''}`}>
                          <Typography className={styles.monthRemainingLabel}>คงเหลือต่อเดือน</Typography>
                          <Typography className={styles.monthRemainingValue}>{formatNumber(remainingThisMonth)} THB</Typography>
                        </Box>
                        <Box className={styles.monthExpenseSummary}>
                          <Typography className={styles.monthExpenseLabel}>สรุปค่าใช้จ่าย</Typography>
                          <Typography className={styles.monthExpenseValue}>{formatNumber(totalExpenseThisMonth)} THB</Typography>
                        </Box>
                      </Box>
                    </Stack>
                    <DesktopRowsTable rows={displayRowsWithBalance} readonly formatNumber={formatNumber} />
                  </section>
                );
              })}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setShowArchive(false)}>ปิด</Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={isAddOpen}
          onClose={closeAddDialog}
          fullWidth
          maxWidth="sm"
          slotProps={{
            paper: {
              sx: {
                borderRadius: 1,
                background: 'linear-gradient(180deg, #ffffff, #f9fbff)',
                border: '1px solid rgba(0,0,0,0.08)',
                boxShadow: '0 24px 70px rgba(17, 31, 54, 0.26)',
              },
            },
          }}
        >
          <form onSubmit={handleAddRow}>
            <DialogTitle sx={{ pb: 1 }}>
              <Stack spacing={0.2}>
                <Typography component="div" variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
                  เพิ่มรายการ
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  กรอกรายละเอียดรายการที่ต้องการเพิ่มในรอบจ่าย
                </Typography>
              </Stack>
            </DialogTitle>
            <DialogContent sx={{ pt: '8px !important' }}>
              <Stack spacing={1.2} mt={0.5}>
                <TextField
                  size="small"
                  fullWidth
                  label="รายละเอียด"
                  value={detail}
                  onChange={(event) => setDetail(event.target.value)}
                  sx={formFieldSx}
                />
                <TextField
                  size="small"
                  fullWidth
                  label="ค่าใช้จ่าย (THB)"
                  type="number"
                  value={expense}
                  onChange={(event) => setExpense(event.target.value)}
                  slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
                  sx={formFieldSx}
                />
                <TextField
                  size="small"
                  fullWidth
                  label="เดือนเริ่ม"
                  type="month"
                  value={itemStartMonth}
                  onChange={(event) => setItemStartMonth(event.target.value)}
                  helperText={`รายการนี้จะเริ่มที่ ${getRoundLabel(selectedStartRound)}`}
                  slotProps={{ htmlInput: { min: currentMonthValue } }}
                  sx={formFieldSx}
                />
                <TextField
                  size="small"
                  fullWidth
                  label="จำนวนเดือน"
                  type="number"
                  value={spreadMonths}
                  onChange={(event) => setSpreadMonths(event.target.value)}
                  helperText={`เริ่มที่ ${getRoundLabel(selectedStartRound)} และถ้ารวมเกิน ${totalTables} เดือน ระบบจะเพิ่มจำนวนเดือนทั้งหมดให้อัตโนมัติ`}
                  slotProps={{ htmlInput: { min: 1 } }}
                  sx={formFieldSx}
                />
                <TextField
                  size="small"
                  fullWidth
                  label="เงินทดแทน (THB)"
                  type="number"
                  value={compensation}
                  onChange={(event) => setCompensation(event.target.value)}
                  slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
                  sx={formFieldSx}
                />
                <TextField
                  size="small"
                  fullWidth
                  label="ที่มา"
                  value={source}
                  onChange={(event) => setSource(event.target.value)}
                  sx={formFieldSx}
                />
                <TextField
                  size="small"
                  fullWidth
                  select
                  label="ประเภทบัตร"
                  value={cardType}
                  onChange={(event) => setCardType(event.target.value as CardTypeInput)}
                  sx={formFieldSx}
                >
                  {map(CARD_TYPE_SELECT_OPTIONS, (option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  size="small"
                  fullWidth
                  select
                  label="สถานะ"
                  value={status}
                  onChange={(event) => setStatus(event.target.value as RowStatus)}
                  sx={formFieldSx}
                >
                  {map(STATUS_OPTIONS, (option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2.4, pt: 1.5, gap: 1 }}>
              <Button onClick={closeAddDialog} sx={{ borderRadius: 999, px: 1.8 }}>
                ยกเลิก
              </Button>
              <Button type="submit" variant="contained" sx={{ borderRadius: 999, px: 2 }}>
                บันทึกรายการ
              </Button>
            </DialogActions>
          </form>
        </Dialog>

        <Dialog
          open={isEditOpen}
          onClose={closeEditDialog}
          fullWidth
          maxWidth="sm"
          slotProps={{
            paper: {
              sx: {
                borderRadius: 1,
                background: 'linear-gradient(180deg, #ffffff, #f9fbff)',
                border: '1px solid rgba(0,0,0,0.08)',
                boxShadow: '0 24px 70px rgba(17, 31, 54, 0.26)',
              },
            },
          }}
        >
          <DialogTitle sx={{ pb: 1 }}>
            <Stack spacing={0.2}>
              <Typography component="div" variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
                แก้ไขรายการ
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                เดือน {getRoundLabel(editingTableIndex)} (เงินทดแทน/ที่มา แยกตามเดือน)
              </Typography>
            </Stack>
          </DialogTitle>
          <DialogContent sx={{ pt: '8px !important' }}>
            <Stack spacing={1.2} mt={0.5}>
              <TextField
                size="small"
                fullWidth
                label="รายละเอียด"
                value={editDetail}
                onChange={(event) => setEditDetail(event.target.value)}
                sx={formFieldSx}
              />
              <TextField
                size="small"
                fullWidth
                label="ค่าใช้จ่าย (THB)"
                type="number"
                value={editExpense}
                onChange={(event) => setEditExpense(event.target.value)}
                slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
                sx={formFieldSx}
              />
              <TextField
                size="small"
                fullWidth
                label="เงินทดแทน (THB)"
                type="number"
                value={editCompensation}
                onChange={(event) => setEditCompensation(event.target.value)}
                slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
                sx={formFieldSx}
              />
              <TextField
                size="small"
                fullWidth
                label="ที่มา"
                value={editSource}
                onChange={(event) => setEditSource(event.target.value)}
                sx={formFieldSx}
              />
              <TextField
                size="small"
                fullWidth
                select
                label="ประเภทบัตร"
                value={editCardType}
                onChange={(event) => setEditCardType(event.target.value as CardTypeInput)}
                sx={formFieldSx}
              >
                {map(CARD_TYPE_SELECT_OPTIONS, (option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                size="small"
                fullWidth
                select
                label="สถานะ"
                value={editStatus}
                onChange={(event) => setEditStatus(event.target.value as RowStatus)}
                sx={formFieldSx}
              >
                {map(STATUS_OPTIONS, (option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.4, pt: 1.5, gap: 1 }}>
            <Button color="error" variant="outlined" onClick={openDeleteRowDialog} sx={{ borderRadius: 999, px: 1.8 }}>
              ลบรายการ
            </Button>
            {editingCanCancel && (
              <Button color="error" onClick={handleCancelPlanRow} sx={{ borderRadius: 999, px: 1.8 }}>
                ยกเลิกรายการจากแผน
              </Button>
            )}
            <Button onClick={closeEditDialog} sx={{ borderRadius: 999, px: 1.8 }}>
              ยกเลิก
            </Button>
            <Button onClick={handleSaveEdit} variant="contained" sx={{ borderRadius: 999, px: 2 }}>
              บันทึกรายการ
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={Boolean(deleteRowTarget)}
          onClose={closeDeleteRowDialog}
          fullWidth
          maxWidth="xs"
          slotProps={{
            paper: {
              sx: {
                borderRadius: 2,
                background: 'linear-gradient(180deg, #ffffff, #fff8f7)',
                border: '1px solid rgba(198,40,40,0.14)',
              },
            },
          }}
        >
          <DialogTitle sx={{ pb: 0.5 }}>
            <Typography component="div" variant="h6" sx={{ fontWeight: 700 }}>
              ยืนยันการลบรายการ
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ pt: '8px !important' }}>
            <Typography sx={{ color: 'text.secondary' }}>
              รายการ <strong>{deleteRowTarget?.detail}</strong> จะถูกลบออกจากทุกเดือนของรายการนี้ทันที
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.2, pt: 1, gap: 0.8 }}>
            <Button onClick={closeDeleteRowDialog}>ยกเลิก</Button>
            <Button color="error" variant="contained" onClick={confirmDeleteRow}>
              ลบรายการ
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={isMonthIncomeOpen}
          onClose={closeMonthIncomeDialog}
          fullWidth
          maxWidth="xs"
          slotProps={{
            paper: {
              sx: {
                borderRadius: 2,
                background: 'linear-gradient(180deg, #ffffff, #f8fbff)',
                border: '1px solid rgba(0,0,0,0.08)',
                boxShadow: '0 20px 50px rgba(17, 31, 54, 0.24)',
              },
            },
          }}
        >
          <DialogTitle sx={{ pb: 0.5 }}>
            <Typography component="div" variant="h6" sx={{ fontWeight: 700 }}>
              ตั้งค่า Monthly Income
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              รอบ {getRoundLabel(editingMonthIncomeTableIndex)}
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ pt: '8px !important' }}>
            <TextField
              fullWidth
              size="small"
              label="Monthly Income (THB)"
              value={editingMonthIncomeValue}
              onChange={(event) => setEditingMonthIncomeValue(event.target.value)}
              slotProps={{
                input: {
                  startAdornment: <InputAdornment position="start">THB</InputAdornment>,
                },
                htmlInput: { min: 0, step: '0.01' },
              }}
              type="number"
            />
            <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
              ค่า default มาจาก Monthly Income หลัก และจะบันทึกเมื่อกดปุ่มอัปเดต
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.2, pt: 1, gap: 0.8 }}>
            <Button onClick={resetMonthIncomeToDefault}>ใช้ค่า default</Button>
            <Button onClick={closeMonthIncomeDialog}>ยกเลิก</Button>
            <Button variant="contained" onClick={saveMonthIncomeDialog}>
              อัปเดต
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </MarketingLayout>
  );
}
