'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import map from 'lodash/map';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ArchiveRoundedIcon from '@mui/icons-material/ArchiveRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { getStatusChipSx } from '@/components/shared/statusChip';
import MarketingLayout from '@/components/layout/MarketingLayout';
import { getCurrentRoundIndex, getRoundLabel, RESERVE_SYSTEM_START_ROUND } from '@/lib/budgetCalendar';
import { BudgetRow, BudgetSnapshot, CardType, DEFAULT_BUDGET_SNAPSHOT, HomeExpense, RowStatus } from '@/lib/budgetState';
import { CARD_TYPE_SELECT_OPTIONS, CardTypeInput, getCardIcon, getCardLabel } from '@/lib/cardBrand';
import { readBudgetSnapshot, updateBudgetSnapshot } from '@/lib/indexedDbBudget';
import { useCurrentDate } from '@/lib/currentDate';
import styles from './page.module.css';

type RoundRow = {
  id: number;
  itemNo: number;
  detail: string;
  monthsLeft: number | null;
  totalMonths: number | null;
  expense: number;
  compensation: number;
  source: string;
  cardType?: CardType;
  status: 'PENDING' | 'PAID';
  isOutstanding?: boolean;
};

type HomeExpenseWithMonth = HomeExpense & {
  tableIndex: number;
};

function ExpenseCardIcon({ cardType }: { cardType?: CardType }) {
  if (!cardType) return null;
  return (
    <Image
      src={getCardIcon(cardType) ?? ''}
      alt={getCardLabel(cardType)}
      title={getCardLabel(cardType)}
      width={24}
      height={16}
      style={cardType === 'TTB' ? { width: 18, height: 9, borderRadius: 0 } : undefined}
      className={styles.expenseCardIcon}
    />
  );
}

function ExpenseCardSelect({ value, onChange }: { value: CardTypeInput; onChange: (value: CardTypeInput) => void }) {
  return (
    <TextField
      size="small"
      select
      label="ประเภทบัตร"
      value={value}
      onChange={(event) => onChange(event.target.value as CardTypeInput)}
      fullWidth
    >
      {map(CARD_TYPE_SELECT_OPTIONS, (option) => (
        <MenuItem key={option.value} value={option.value}>
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  );
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// Shared look for the "primary save" contained buttons inside the off-table-expense
// dialogs (Add / Edit), so they match the green "เพิ่มรายจ่าย" button
// instead of MUI's default (blue) primary color.
const primaryGreenButtonSx = {
  color: '#ffffff',
  background: 'linear-gradient(135deg, #229568, #176b4d)',
  boxShadow: 'none',
  '&:hover': {
    background: 'linear-gradient(135deg, #1d8259, #145f43)',
    boxShadow: 'none',
  },
};

function nowTimestamp(): number {
  return new Date().getTime();
}

function formatPaidDate(timestamp?: number): string {
  if (!timestamp) return '-';
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(timestamp));
}

function resolveExpenseByMonth(row: BudgetRow, tableIndex: number): number {
  const key = String(tableIndex);
  return row.expenseByMonth?.[key] ?? row.expense;
}

function resolveCompensationByMonth(row: BudgetRow, tableIndex: number): number {
  const key = String(tableIndex);
  return row.compensationByMonth?.[key] ?? row.compensation;
}

function resolveSourceByMonth(row: BudgetRow, tableIndex: number): string {
  const key = String(tableIndex);
  return row.sourceByMonth?.[key] ?? row.source;
}

function resolveStatusByMonth(row: BudgetRow, tableIndex: number): 'PENDING' | 'PAID' {
  const key = String(tableIndex);
  return row.statusByMonth?.[key] ?? row.status;
}

function resolveCardTypeByMonth(row: BudgetRow, tableIndex: number): CardType | undefined {
  const key = String(tableIndex);
  const monthCardType = row.cardTypeByMonth?.[key];
  return monthCardType === null ? undefined : monthCardType ?? row.cardType;
}

function getMonthsBadgeClassName(monthsLeft: number | null): string {
  if (monthsLeft === null) return styles.pendingMonthsBadgeBlue;
  if (monthsLeft <= 1) return styles.pendingMonthsBadgeGreen;
  if (monthsLeft <= 5) return styles.pendingMonthsBadgeYellow;
  return styles.pendingMonthsBadgeBlue;
}

function getRowStartMonth(row: BudgetRow): number {
  return Math.max(1, Math.floor(row.startMonth ?? 1));
}

function getRowEndMonth(row: BudgetRow, throughMonth = getRowStartMonth(row)): number {
  if (row.spreadMonths === null) return Math.max(getRowStartMonth(row), throughMonth);
  return getRowStartMonth(row) + Math.max(1, Math.floor(row.spreadMonths)) - 1;
}

function resolveMonthlyIncomeByMonth(
  defaultIncome: number,
  monthlyIncomeByMonth: Record<string, number> | undefined,
  tableIndex: number,
): number {
  const value = monthlyIncomeByMonth?.[String(tableIndex)];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return defaultIncome;
  }
  return value;
}

function resolveAccountBalanceByMonth(
  accountBalance: number,
  accountBalanceByMonth: Record<string, number> | undefined,
  tableIndex: number,
): number | null {
  const value = accountBalanceByMonth?.[String(tableIndex)];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return tableIndex === 1 ? accountBalance : null;
  }
  return value;
}

function buildRoundRows(rows: BudgetRow[], roundIndex: number): RoundRow[] {
  const activeRows = rows.filter((row) => {
    if (row.isCancelled) return false;
    const start = getRowStartMonth(row);
    const end = getRowEndMonth(row, roundIndex);
    return roundIndex >= start && roundIndex <= end;
  });
  const sortedRows = [...activeRows].sort((a, b) => (a.spreadMonths ?? Infinity) - (b.spreadMonths ?? Infinity));
  return map(sortedRows, (row, index) => ({
    id: row.id,
    itemNo: index + 1,
    detail: row.detail,
    monthsLeft: row.spreadMonths === null ? null : getRowEndMonth(row) - roundIndex + 1,
    totalMonths: row.spreadMonths === null ? null : Math.max(1, Math.floor(row.spreadMonths)),
    expense: resolveExpenseByMonth(row, roundIndex),
    compensation: resolveCompensationByMonth(row, roundIndex),
    source: resolveSourceByMonth(row, roundIndex),
    cardType: resolveCardTypeByMonth(row, roundIndex),
    status: resolveStatusByMonth(row, roundIndex),
    isOutstanding: row.isOutstanding,
  }));
}

export default function Home() {
  const [snapshot, setSnapshot] = useState<BudgetSnapshot>(DEFAULT_BUDGET_SNAPSHOT);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isExpenseArchiveOpen, setIsExpenseArchiveOpen] = useState(false);
  const [expenseDetail, setExpenseDetail] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('0');
  const [expenseCardType, setExpenseCardType] = useState<CardTypeInput>('');
  const [isRecurringExpense, setIsRecurringExpense] = useState(false);
  const [editingArchivedExpense, setEditingArchivedExpense] = useState<HomeExpenseWithMonth | null>(null);
  const [editExpenseDetail, setEditExpenseDetail] = useState('');
  const [editExpenseAmount, setEditExpenseAmount] = useState('0');
  const [editExpenseCardType, setEditExpenseCardType] = useState<CardTypeInput>('');
  const [editExpenseStatus, setEditExpenseStatus] = useState<RowStatus>('PAID');
  const [editingPendingExpense, setEditingPendingExpense] = useState<HomeExpenseWithMonth | null>(null);
  const [editPendingDetail, setEditPendingDetail] = useState('');
  const [editPendingAmount, setEditPendingAmount] = useState('0');
  const [editPendingCardType, setEditPendingCardType] = useState<CardTypeInput>('');
  const [editPendingScope, setEditPendingScope] = useState<'this' | 'future'>('this');
  const currentDate = useCurrentDate();

  useEffect(() => {
    let mounted = true;

    const hydrate = async () => {
      const nextSnapshot = await readBudgetSnapshot();
      if (!mounted) return;
      setSnapshot(nextSnapshot);
    };

    void hydrate();
    return () => {
      mounted = false;
    };
  }, []);

  const currentRoundIndex = useMemo(
    () => getCurrentRoundIndex(Math.max(snapshot.totalTables, 1), currentDate),
    [snapshot.totalTables, currentDate],
  );
  const tableIndexes = useMemo(() => {
    const size = Math.max(snapshot.totalTables, 1);
    return Array.from({ length: size }, (_v, i) => i + 1);
  }, [snapshot.totalTables]);
  const monthEndingByMonth = useMemo(() => {
    const endings: number[] = [];
    for (let i = 0; i < tableIndexes.length; i += 1) {
      const tableIndex = i + 1;
      const monthIncome = resolveMonthlyIncomeByMonth(snapshot.monthlyIncome, snapshot.monthlyIncomeByMonth, tableIndex);
      const fallbackStartBalance = i === 0 ? snapshot.accountBalance : monthIncome;
      const overriddenStartBalance = resolveAccountBalanceByMonth(
        snapshot.accountBalance,
        snapshot.accountBalanceByMonth,
        tableIndex,
      );
      const startBalance = overriddenStartBalance ?? fallbackStartBalance;
      const rows = buildRoundRows(snapshot.rows, tableIndex);
      const endBalance = rows.reduce((running, row) => running + row.compensation - row.expense, startBalance);
      endings.push(endBalance);
    }
    return endings;
  }, [
    tableIndexes.length,
    snapshot.accountBalance,
    snapshot.accountBalanceByMonth,
    snapshot.monthlyIncome,
    snapshot.monthlyIncomeByMonth,
    snapshot.rows,
  ]);
  const roundStartingByMonth = useMemo(() => {
    const starts: number[] = [];
    for (let i = 0; i < tableIndexes.length; i += 1) {
      const tableIndex = i + 1;
      const monthIncome = resolveMonthlyIncomeByMonth(snapshot.monthlyIncome, snapshot.monthlyIncomeByMonth, tableIndex);
      const fallbackStartBalance = i === 0 ? snapshot.accountBalance : monthIncome;
      const overriddenStartBalance = resolveAccountBalanceByMonth(
        snapshot.accountBalance,
        snapshot.accountBalanceByMonth,
        tableIndex,
      );
      starts.push(overriddenStartBalance ?? fallbackStartBalance);
    }
    return starts;
  }, [
    tableIndexes.length,
    snapshot.accountBalance,
    snapshot.accountBalanceByMonth,
    snapshot.monthlyIncome,
    snapshot.monthlyIncomeByMonth,
  ]);

  const reserveByMonth = useMemo(() => {
    return tableIndexes.reduce<number[]>((reserves, tableIndex, monthArrayIndex) => {
      const outsideTableExpense = (snapshot.homeExpensesByMonth?.[String(tableIndex)] ?? []).reduce(
        (sum, item) => sum + (item.isCancelled ? 0 : item.amount),
        0,
      );
      const withinMonthRemaining =
        (monthEndingByMonth[monthArrayIndex] ?? roundStartingByMonth[monthArrayIndex] ?? 0) - outsideTableExpense;

      if (tableIndex < RESERVE_SYSTEM_START_ROUND) {
        return [...reserves, withinMonthRemaining];
      }
      if (tableIndex === RESERVE_SYSTEM_START_ROUND) {
        return [...reserves, -outsideTableExpense];
      }

      const previousReserve = reserves[monthArrayIndex - 1] ?? 0;
      return [...reserves, previousReserve + withinMonthRemaining];
    }, []);
  }, [tableIndexes, snapshot.homeExpensesByMonth, monthEndingByMonth, roundStartingByMonth]);

  const currentRows = useMemo(() => buildRoundRows(snapshot.rows, currentRoundIndex), [snapshot.rows, currentRoundIndex]);
  const allHomeExpenses = useMemo(
    () =>
      Object.entries(snapshot.homeExpensesByMonth ?? {}).reduce<HomeExpenseWithMonth[]>(
        (items, [monthKey, expenses]) => [
          ...items,
          ...expenses.reduce<HomeExpenseWithMonth[]>((monthItems, item) => {
            const tableIndex = Number(monthKey);
            if (!Number.isFinite(tableIndex) || item.isCancelled) return monthItems;
            return [...monthItems, { ...item, tableIndex }];
          }, []),
        ],
        [],
      ),
    [snapshot.homeExpensesByMonth],
  );
  const pendingHomeExpenses = useMemo(
    () =>
      allHomeExpenses
        .filter((item) => item.status !== 'PAID' && item.tableIndex <= currentRoundIndex)
        .sort((a, b) => b.id - a.id),
    [allHomeExpenses, currentRoundIndex],
  );
  const archivedHomeExpenses = useMemo(
    () => allHomeExpenses.filter((item) => item.status === 'PAID').sort((a, b) => (b.paidAt ?? b.id) - (a.paidAt ?? a.id)),
    [allHomeExpenses],
  );
  const totalPendingHomeExpense = useMemo(
    () => pendingHomeExpenses.reduce((sum, item) => sum + item.amount, 0),
    [pendingHomeExpenses],
  );
  const tableExpense = useMemo(() => currentRows.reduce((sum, row) => sum + row.expense, 0), [currentRows]);
  const monthStarting = roundStartingByMonth[currentRoundIndex - 1] ?? snapshot.accountBalance;
  const monthRemaining = reserveByMonth[currentRoundIndex - 1] ?? monthStarting;
  const pendingRows = currentRows.filter((row) => row.status === 'PENDING' && row.isOutstanding !== false);

  const closeAddExpenseDialog = () => {
    setIsAddExpenseOpen(false);
    setExpenseDetail('');
    setExpenseAmount('0');
    setExpenseCardType('');
    setIsRecurringExpense(false);
  };

  const addHomeExpense = () => {
    void (async () => {
      const amount = Number(expenseAmount);
      const detail = expenseDetail.trim();
      if (!detail) return;
      if (!Number.isFinite(amount) || amount < 0) return;

      const nextSnapshot = await updateBudgetSnapshot((current) => {
        const groupId = nowTimestamp();
        const finalTableIndex = isRecurringExpense ? Math.max(current.totalTables, currentRoundIndex) : currentRoundIndex;
        const targetTableIndexes = Array.from(
          { length: finalTableIndex - currentRoundIndex + 1 },
          (_value, index) => currentRoundIndex + index,
        );
        const nextExpensesByMonth = targetTableIndexes.reduce<Record<string, HomeExpense[]>>(
          (expensesByMonth, tableIndex) => {
            const monthKey = String(tableIndex);
            const nextExpense: HomeExpense = {
              id: isRecurringExpense ? groupId * 1000 + tableIndex : groupId,
              detail,
              amount,
              status: 'PENDING',
              ...(expenseCardType ? { cardType: expenseCardType } : {}),
              ...(isRecurringExpense ? { isRecurring: true, recurringGroupId: groupId } : {}),
            };
            return {
              ...expensesByMonth,
              [monthKey]: [...(expensesByMonth[monthKey] ?? []), nextExpense],
            };
          },
          { ...(current.homeExpensesByMonth ?? {}) },
        );

        return {
          ...current,
          homeExpensesByMonth: nextExpensesByMonth,
          updatedAt: nowTimestamp(),
        };
      });

      setSnapshot(nextSnapshot);
      closeAddExpenseDialog();
    })();
  };

  const markHomeExpensePaid = (expenseId: number, tableIndex: number) => {
    void (async () => {
      const monthKey = String(tableIndex);
      const paidAt = nowTimestamp();
      const nextSnapshot = await updateBudgetSnapshot((current) => {
        const currentExpenses = current.homeExpensesByMonth?.[monthKey] ?? [];
        return {
          ...current,
          homeExpensesByMonth: {
            ...(current.homeExpensesByMonth ?? {}),
            [monthKey]: map(currentExpenses, (item) =>
              item.id === expenseId ? { ...item, status: 'PAID' as const, paidAt } : item,
            ),
          },
          updatedAt: paidAt,
        };
      });

      setSnapshot(nextSnapshot);
    })();
  };

  const openArchivedExpenseEdit = (item: HomeExpenseWithMonth) => {
    setEditingArchivedExpense(item);
    setEditExpenseDetail(item.detail);
    setEditExpenseAmount(String(item.amount));
    setEditExpenseCardType(item.cardType ?? '');
    setEditExpenseStatus(item.status);
  };

  const closeArchivedExpenseEdit = () => {
    setEditingArchivedExpense(null);
    setEditExpenseDetail('');
    setEditExpenseAmount('0');
    setEditExpenseCardType('');
    setEditExpenseStatus('PAID');
  };

  const saveArchivedExpenseEdit = () => {
    if (!editingArchivedExpense) return;
    const detail = editExpenseDetail.trim();
    const amount = Number(editExpenseAmount);
    if (!detail || !Number.isFinite(amount) || amount < 0) return;

    void (async () => {
      const monthKey = String(editingArchivedExpense.tableIndex);
      const updatedAt = nowTimestamp();
      const nextSnapshot = await updateBudgetSnapshot((current) => {
        const currentExpenses = current.homeExpensesByMonth?.[monthKey] ?? [];
        return {
          ...current,
          homeExpensesByMonth: {
            ...(current.homeExpensesByMonth ?? {}),
            [monthKey]: map(currentExpenses, (item): HomeExpense => {
              if (item.id !== editingArchivedExpense.id) return item;
              if (editExpenseStatus === 'PENDING') {
                return { ...item, detail, amount, cardType: editExpenseCardType || undefined, status: 'PENDING', paidAt: undefined };
              }
              return {
                ...item,
                detail,
                amount,
                cardType: editExpenseCardType || undefined,
                status: 'PAID',
                paidAt: item.paidAt ?? updatedAt,
              };
            }),
          },
          updatedAt,
        };
      });

      setSnapshot(nextSnapshot);
      closeArchivedExpenseEdit();
    })();
  };

  const openPendingExpenseEdit = (item: HomeExpenseWithMonth) => {
    setEditingPendingExpense(item);
    setEditPendingDetail(item.detail);
    setEditPendingAmount(String(item.amount));
    setEditPendingCardType(item.cardType ?? '');
    setEditPendingScope('this');
  };

  const closePendingExpenseEdit = () => {
    setEditingPendingExpense(null);
    setEditPendingDetail('');
    setEditPendingAmount('0');
    setEditPendingCardType('');
    setEditPendingScope('this');
  };

  const savePendingExpenseEdit = () => {
    if (!editingPendingExpense) return;
    const detail = editPendingDetail.trim();
    const amount = Number(editPendingAmount);
    if (!detail || !Number.isFinite(amount) || amount < 0) return;

    const applyToFuture = Boolean(editingPendingExpense.isRecurring) && editPendingScope === 'future';
    const { id: expenseId, tableIndex: fromTableIndex, recurringGroupId } = editingPendingExpense;

    void (async () => {
      const updatedAt = nowTimestamp();
      const nextSnapshot = await updateBudgetSnapshot((current) => {
        const nextExpensesByMonth: Record<string, HomeExpense[]> = { ...(current.homeExpensesByMonth ?? {}) };

        if (!applyToFuture) {
          const monthKey = String(fromTableIndex);
          const currentExpenses = nextExpensesByMonth[monthKey] ?? [];
          nextExpensesByMonth[monthKey] = map(currentExpenses, (item) =>
            item.id === expenseId ? { ...item, detail, amount, cardType: editPendingCardType || undefined } : item,
          );
        } else {
          for (const [monthKey, expenses] of Object.entries(nextExpensesByMonth)) {
            const monthIndex = Number(monthKey);
            if (!Number.isFinite(monthIndex) || monthIndex < fromTableIndex) continue;
            nextExpensesByMonth[monthKey] = map(expenses, (item) =>
              item.recurringGroupId === recurringGroupId && item.status === 'PENDING' && !item.isCancelled
                ? { ...item, detail, amount, cardType: editPendingCardType || undefined }
                : item,
            );
          }
        }

        return {
          ...current,
          homeExpensesByMonth: nextExpensesByMonth,
          updatedAt,
        };
      });

      setSnapshot(nextSnapshot);
      closePendingExpenseEdit();
    })();
  };

  const removeHomeExpense = (expenseId: number, tableIndex: number) => {
    void (async () => {
      const monthKey = String(tableIndex);
      const nextSnapshot = await updateBudgetSnapshot((current) => {
        const currentExpenses = current.homeExpensesByMonth?.[monthKey] ?? [];
        const target = currentExpenses.find((item) => item.id === expenseId);
        const nextExpenses = target?.isRecurring
          ? map(currentExpenses, (item) => (item.id === expenseId ? { ...item, isCancelled: true } : item))
          : currentExpenses.filter((item) => item.id !== expenseId);
        return {
          ...current,
          homeExpensesByMonth: {
            ...(current.homeExpensesByMonth ?? {}),
            [monthKey]: nextExpenses,
          },
          updatedAt: nowTimestamp(),
        };
      });

      setSnapshot(nextSnapshot);
    })();
  };

  return (
    <MarketingLayout>
      <Container maxWidth="lg" className={styles.wrapper}>
        <Typography variant="h3" className={styles.title}>
          สรุปรายการจ่าย {getRoundLabel(currentRoundIndex)}
        </Typography>
        <br />
        <Box className={styles.summaryGrid}>
          <Box className={styles.summaryCard}>
            <Typography className={styles.label}>รอบจ่ายเดือน</Typography>
            <Typography className={styles.value}>{getRoundLabel(currentRoundIndex)}</Typography>
          </Box>
          <Box className={styles.summaryCard}>
            <Typography className={styles.label}>ยอดตั้งต้นรอบนี้</Typography>
            <Typography className={styles.value}>{formatNumber(monthStarting)} THB</Typography>
          </Box>
          <Box className={styles.summaryCard}>
            <Typography className={styles.label}>สรุปค่าใช้จ่าย</Typography>
            <Typography className={styles.value}>{formatNumber(tableExpense)} THB</Typography>
          </Box>
          <Box className={styles.summaryCard}>
            <Typography className={styles.label}>เงินสำรอง</Typography>
            <Typography className={styles.value}>{formatNumber(monthRemaining)} THB</Typography>
          </Box>
        </Box>

        <Box className={styles.pendingCard}>
          <Typography className={styles.pendingTitle}>รายการยอดค้างที่ยัง PENDING</Typography>
          {pendingRows.length === 0 && <Typography className={styles.emptyText}>ไม่มีรายการค้างในเดือนนี้</Typography>}
          {pendingRows.length > 0 && (
            <Stack spacing={1}>
              {map(pendingRows, (row) => (
                <Box key={row.id} className={styles.pendingRow}>
                  <Box>
                    <Typography className={styles.pendingDetail}>
                      {row.itemNo}. {row.detail || '-'}
                      <Box component="span" className={`${styles.pendingMonthsBadge} ${getMonthsBadgeClassName(row.monthsLeft)}`}>
                        {row.monthsLeft === null ? '-' : `เหลือ ${row.monthsLeft} เดือน`}
                      </Box>
                      {row.cardType ? (
                        <Box component="span" className={styles.pendingCardTypeInline}>
                          <span className={styles.pendingCardDot}>•</span>
                          <Image
                            src={getCardIcon(row.cardType) ?? ''}
                            alt={getCardLabel(row.cardType)}
                            width={14}
                            height={14}
                            style={row.cardType === 'TTB' ? { width: 12, height: 6, borderRadius: 0 } : undefined}
                            className={styles.pendingCardIcon}
                          />
                          <span>{getCardLabel(row.cardType)}</span>
                        </Box>
                      ) : null}
                    </Typography>
                    <Typography className={styles.pendingMeta}>
                      ค่าใช้จ่าย {formatNumber(row.expense)} THB
                      {row.source ? ` • ที่มา ${row.source}` : ''}
                    </Typography>
                  </Box>
                  <Chip label="PENDING" size="small" sx={getStatusChipSx('PENDING')} />
                </Box>
              ))}
            </Stack>
          )}
        </Box>

        <Box className={`${styles.pendingCard} ${styles.extraExpenseCard}`}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            justifyContent="space-between"
            gap={1}
            className={styles.extraExpenseHeader}
          >
            <Box>
              <Typography className={styles.pendingTitle}>รายจ่ายนอกตาราง</Typography>
              <Typography className={styles.extraExpenseSubtitle}>ค้างอยู่จนกว่าจะจ่าย · หักจากเงินสำรองเท่านั้น</Typography>
              <Box className={styles.extraExpenseTotalBadge}>
                ค้างจ่ายรวม {formatNumber(totalPendingHomeExpense)} THB
                {pendingHomeExpenses.length > 0 ? ` · ${pendingHomeExpenses.length} รายการ` : ''}
              </Box>
            </Box>
            <Box className={styles.extraExpenseHeaderActions}>
              <Button
                size="small"
                variant="contained"
                onClick={() => setIsAddExpenseOpen(true)}
                sx={{ ...primaryGreenButtonSx, flexShrink: 0 }}
              >
                เพิ่มรายจ่าย
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<ArchiveRoundedIcon fontSize="small" />}
                onClick={() => setIsExpenseArchiveOpen(true)}
                sx={{
                  flexShrink: 0,
                  borderColor: 'rgba(20, 111, 77, 0.4)',
                  color: '#176b4d',
                  background: 'rgba(255, 255, 255, 0.76)',
                  '&:hover': {
                    borderColor: 'rgba(20, 111, 77, 0.58)',
                    background: 'rgba(255, 255, 255, 0.94)',
                  },
                }}
              >
                Archive ({archivedHomeExpenses.length})
              </Button>
            </Box>
          </Stack>
          {pendingHomeExpenses.length === 0 && (
            <Typography className={styles.emptyText}>ไม่มีรายจ่ายนอกตารางที่ค้างชำระ</Typography>
          )}
          {pendingHomeExpenses.length > 0 && (
            <Stack spacing={1}>
              {map(pendingHomeExpenses, (item, index) => (
                <Box key={item.id} className={styles.extraExpenseRow}>
                  <Box>
                    <Typography className={styles.pendingDetail}>
                      {index + 1}. {item.detail}
                      <ExpenseCardIcon cardType={item.cardType} />
                      {item.isRecurring && (
                        <Box component="span" className={styles.recurringExpenseBadge}>
                          รายเดือน
                        </Box>
                      )}
                    </Typography>
                    <Typography className={styles.pendingMeta}>
                      {getRoundLabel(item.tableIndex)} · {formatNumber(item.amount)} THB
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={0.7} className={styles.extraExpenseActions}>
                    <Tooltip title="แก้ไขรายการ">
                      <IconButton
                        size="small"
                        onClick={() => openPendingExpenseEdit(item)}
                        aria-label={`แก้ไข ${item.detail}`}
                        className={styles.extraExpenseEditIconButton}
                        sx={{
                          alignSelf: 'center',
                          width: 40,
                          height: 40,
                          border: '1px solid rgba(20, 111, 77, 0.28)',
                          background: 'linear-gradient(145deg, #f4fbf7, #e9f7f0)',
                          color: '#176b4d',
                          '&:hover': {
                            borderColor: 'rgba(20, 111, 77, 0.42)',
                            background: 'linear-gradient(145deg, #eafaf1, #dcf3e6)',
                          },
                        }}
                      >
                        <EditRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Button
                      size="small"
                      color="success"
                      variant="contained"
                      startIcon={<CheckRoundedIcon fontSize="small" />}
                      onClick={() => markHomeExpensePaid(item.id, item.tableIndex)}
                    >
                      จ่ายแล้ว
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      variant="outlined"
                      startIcon={<DeleteOutlineRoundedIcon fontSize="small" />}
                      onClick={() => removeHomeExpense(item.id, item.tableIndex)}
                    >
                      ลบ
                    </Button>
                  </Stack>
                </Box>
              ))}
            </Stack>
          )}
        </Box>

        <Dialog open={isExpenseArchiveOpen} onClose={() => setIsExpenseArchiveOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle sx={{ pb: 0.8 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <ArchiveRoundedIcon sx={{ color: '#176b4d' }} />
              <Box>
                <Typography component="div" variant="h6" sx={{ fontWeight: 700 }}>
                  Archive รายจ่ายนอกตาราง
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  รายการที่ชำระแล้ว เรียงจากใหม่ไปเก่า
                </Typography>
              </Box>
            </Stack>
          </DialogTitle>
          <DialogContent sx={{ pt: '8px !important', maxHeight: '65vh' }}>
            {archivedHomeExpenses.length === 0 && <Box className={styles.expenseArchiveEmpty}>ยังไม่มีรายการที่ชำระแล้ว</Box>}
            {archivedHomeExpenses.length > 0 && (
              <Stack spacing={1}>
                {map(archivedHomeExpenses, (item, index) => (
                  <Box key={`expense-archive-${item.tableIndex}-${item.id}`} className={styles.expenseArchiveRow}>
                    <Box className={styles.expenseArchiveInfo}>
                      <Typography className={styles.pendingDetail}>
                        {index + 1}. {item.detail}
                        <ExpenseCardIcon cardType={item.cardType} />
                        {item.isRecurring && (
                          <Box component="span" className={styles.recurringExpenseBadge}>
                            รายเดือน
                          </Box>
                        )}
                      </Typography>
                      <Typography className={styles.pendingMeta}>
                        {getRoundLabel(item.tableIndex)} · จ่ายเมื่อ {formatPaidDate(item.paidAt)}
                      </Typography>
                    </Box>
                    <Typography className={styles.expenseArchiveAmount}>{formatNumber(item.amount)} THB</Typography>
                    <Stack direction="row" alignItems="center" spacing={0.7} className={styles.expenseArchiveActions}>
                      <Chip label="PAID" size="small" sx={getStatusChipSx('PAID')} />
                      <Tooltip title="แก้ไขรายการ">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => openArchivedExpenseEdit(item)}
                          className={styles.expenseArchiveEditButton}
                          aria-label={`แก้ไข ${item.detail}`}
                        >
                          <EditRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setIsExpenseArchiveOpen(false)} sx={{ color: '#229568' }}>ปิด</Button>
          </DialogActions>
        </Dialog>

        <Dialog open={Boolean(editingArchivedExpense)} onClose={closeArchivedExpenseEdit} fullWidth maxWidth="xs">
          <DialogTitle sx={{ pb: 0.8 }}>
            <Typography component="div" variant="h6" sx={{ fontWeight: 700 }}>
              แก้ไขรายจ่ายนอกตาราง
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {editingArchivedExpense ? getRoundLabel(editingArchivedExpense.tableIndex) : ''}
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ pt: '8px !important' }}>
            <Stack spacing={2.5}>
              <TextField
                size="small"
                label="รายละเอียด"
                value={editExpenseDetail}
                onChange={(event) => setEditExpenseDetail(event.target.value)}
                fullWidth
              />
              <TextField
                size="small"
                label="ค่าใช้จ่าย (THB)"
                type="number"
                value={editExpenseAmount}
                onChange={(event) => setEditExpenseAmount(event.target.value)}
                slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
                fullWidth
              />
              <ExpenseCardSelect value={editExpenseCardType} onChange={setEditExpenseCardType} />
              <TextField
                size="small"
                select
                label="สถานะ"
                value={editExpenseStatus}
                onChange={(event) => setEditExpenseStatus(event.target.value as RowStatus)}
                helperText="เปลี่ยนเป็น PENDING เพื่อย้ายกลับไปยังรายการค้าง"
                fullWidth
              >
                <MenuItem value="PAID">PAID</MenuItem>
                <MenuItem value="PENDING">PENDING</MenuItem>
              </TextField>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={closeArchivedExpenseEdit} sx={{ color: '#229568' }}>
              ยกเลิก
            </Button>
            <Button variant="contained" onClick={saveArchivedExpenseEdit} sx={primaryGreenButtonSx}>
              บันทึกการแก้ไข
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={Boolean(editingPendingExpense)} onClose={closePendingExpenseEdit} fullWidth maxWidth="xs">
          <DialogTitle sx={{ pb: 0.8 }}>
            <Typography component="div" variant="h6" sx={{ fontWeight: 700 }}>
              แก้ไขรายจ่ายนอกตาราง
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {editingPendingExpense ? getRoundLabel(editingPendingExpense.tableIndex) : ''}
              {editingPendingExpense?.isRecurring && (
                <Box component="span" className={styles.recurringExpenseBadge} sx={{ ml: 1 }}>
                  รายเดือน
                </Box>
              )}
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ pt: '8px !important' }}>
            <Stack spacing={2.5}>
              <TextField
                size="small"
                label="รายละเอียด"
                value={editPendingDetail}
                onChange={(event) => setEditPendingDetail(event.target.value)}
                fullWidth
              />
              <TextField
                size="small"
                label="ค่าใช้จ่าย (THB)"
                type="number"
                value={editPendingAmount}
                onChange={(event) => setEditPendingAmount(event.target.value)}
                slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
                fullWidth
              />
              <ExpenseCardSelect value={editPendingCardType} onChange={setEditPendingCardType} />
              {editingPendingExpense?.isRecurring && (
                <TextField
                  size="small"
                  select
                  label="ใช้การแก้ไขนี้กับ"
                  value={editPendingScope}
                  onChange={(event) => setEditPendingScope(event.target.value as 'this' | 'future')}
                  helperText="เดือนก่อนหน้าและรายการที่จ่ายแล้วจะไม่ถูกแก้ไข"
                  fullWidth
                >
                  <MenuItem value="this">เฉพาะเดือนนี้ ({getRoundLabel(editingPendingExpense.tableIndex)})</MenuItem>
                  <MenuItem value="future">เดือนนี้เป็นต้นไปทุกเดือน</MenuItem>
                </TextField>
              )}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={closePendingExpenseEdit} sx={{ color: '#229568' }}>ยกเลิก</Button>
            <Button variant="contained" onClick={savePendingExpenseEdit} sx={primaryGreenButtonSx}>
              บันทึกการแก้ไข
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={isAddExpenseOpen} onClose={closeAddExpenseDialog} fullWidth maxWidth="xs">
          <DialogTitle sx={{ pb: 0.8 }}>
            <Typography component="div" variant="h6" sx={{ fontWeight: 700 }}>
              เพิ่มรายจ่ายนอกตาราง
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ pt: '8px !important' }}>
            <Stack spacing={2.5}>
              <TextField
                size="small"
                label="รายละเอียด"
                value={expenseDetail}
                onChange={(event) => setExpenseDetail(event.target.value)}
                fullWidth
              />
              <TextField
                size="small"
                label="ค่าใช้จ่าย (THB)"
                type="number"
                value={expenseAmount}
                onChange={(event) => setExpenseAmount(event.target.value)}
                slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
                fullWidth
              />
              <ExpenseCardSelect value={expenseCardType} onChange={setExpenseCardType} />
              <FormControlLabel
                control={
                  <Checkbox checked={isRecurringExpense} onChange={(event) => setIsRecurringExpense(event.target.checked)} />
                }
                label={
                  <Box>
                    <Typography className={styles.recurringExpenseLabel}>ทำซ้ำทุกเดือน</Typography>
                    <Typography className={styles.recurringExpenseHint}>เหมาะสำหรับค่าประกัน ค่าไฟ และค่ามือถือ</Typography>
                  </Box>
                }
                className={styles.recurringExpenseControl}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={closeAddExpenseDialog} sx={{ color: '#229568' }}>
              ยกเลิก
            </Button>
            <Button variant="contained" onClick={addHomeExpense} sx={primaryGreenButtonSx}>
              บันทึก
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </MarketingLayout>
  );
}
