'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import map from 'lodash/map';
import { Box, Chip, Container, Stack, Typography } from '@mui/material';
import MarketingLayout from '@/components/layout/MarketingLayout';
import { readBudgetFromServer } from '@/lib/budgetApi';
import { getCurrentRoundIndex, getRoundLabel } from '@/lib/budgetCalendar';
import { BudgetRow, BudgetSnapshot, CardType, DEFAULT_BUDGET_SNAPSHOT } from '@/lib/budgetState';
import { getCardIcon, getCardLabel } from '@/lib/cardBrand';
import { readBudgetSnapshot, writeBudgetSnapshot } from '@/lib/indexedDbBudget';
import { useEffectiveCurrentDate } from '@/lib/testingDate';
import styles from './page.module.css';

type RoundRow = {
  id: number;
  itemNo: number;
  detail: string;
  expense: number;
  compensation: number;
  source: string;
  cardType?: CardType;
  status: 'PENDING' | 'PAID';
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
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
  return row.cardTypeByMonth?.[key] ?? row.cardType;
}

function getRowStartMonth(row: BudgetRow): number {
  return Math.max(1, Math.floor(row.startMonth ?? 1));
}

function getRowEndMonth(row: BudgetRow): number {
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
    const end = getRowEndMonth(row);
    return roundIndex >= start && roundIndex <= end;
  });
  const sortedRows = [...activeRows].sort((a, b) => a.spreadMonths - b.spreadMonths);
  return map(sortedRows, (row, index) => ({
    id: row.id,
    itemNo: index + 1,
    detail: row.detail,
    expense: resolveExpenseByMonth(row, roundIndex),
    compensation: resolveCompensationByMonth(row, roundIndex),
    source: resolveSourceByMonth(row, roundIndex),
    cardType: resolveCardTypeByMonth(row, roundIndex),
    status: resolveStatusByMonth(row, roundIndex),
  }));
}

export default function Home() {
  const [snapshot, setSnapshot] = useState<BudgetSnapshot>(DEFAULT_BUDGET_SNAPSHOT);
  const currentDate = useEffectiveCurrentDate();

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
      const fallbackStartBalance =
        i === 0 ? snapshot.accountBalance : (endings[i - 1] ?? snapshot.accountBalance) + monthIncome;
      const overriddenStartBalance = resolveAccountBalanceByMonth(
        snapshot.accountBalance,
        snapshot.accountBalanceByMonth,
        tableIndex,
      );
      const startBalance = overriddenStartBalance ?? fallbackStartBalance;
      const rows = buildRoundRows(snapshot.rows, tableIndex);
      const endBalance = rows.reduce(
        (running, row) => running + row.compensation - row.expense,
        startBalance,
      );
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
      if (i === 0) {
        starts.push(snapshot.accountBalance);
      } else {
        const prevEnding = monthEndingByMonth[i - 1] ?? snapshot.accountBalance;
        const tableIndex = i + 1;
        const monthIncome = resolveMonthlyIncomeByMonth(snapshot.monthlyIncome, snapshot.monthlyIncomeByMonth, tableIndex);
        const fallbackStartBalance = prevEnding + monthIncome;
        const overriddenStartBalance = resolveAccountBalanceByMonth(
          snapshot.accountBalance,
          snapshot.accountBalanceByMonth,
          tableIndex,
        );
        starts.push(overriddenStartBalance ?? fallbackStartBalance);
      }
    }
    return starts;
  }, [
    tableIndexes.length,
    snapshot.accountBalance,
    snapshot.accountBalanceByMonth,
    snapshot.monthlyIncome,
    snapshot.monthlyIncomeByMonth,
    monthEndingByMonth,
  ]);

  const currentRows = useMemo(() => buildRoundRows(snapshot.rows, currentRoundIndex), [snapshot.rows, currentRoundIndex]);
  const totalExpense = useMemo(() => currentRows.reduce((sum, row) => sum + row.expense, 0), [currentRows]);
  const monthStarting = roundStartingByMonth[currentRoundIndex - 1] ?? snapshot.accountBalance;
  const currentRowsWithBalance = useMemo(
    () =>
      currentRows.reduce<Array<RoundRow & { balanceAfter: number }>>((acc, row) => {
        const prevBalance = acc.length > 0 ? acc[acc.length - 1].balanceAfter : monthStarting;
        const nextBalance = prevBalance + row.compensation - row.expense;
        return [...acc, { ...row, balanceAfter: nextBalance }];
      }, []),
    [currentRows, monthStarting],
  );
  const monthRemaining =
    monthEndingByMonth[currentRoundIndex - 1] ??
    (currentRowsWithBalance.length > 0
      ? currentRowsWithBalance[currentRowsWithBalance.length - 1].balanceAfter
      : monthStarting);
  const pendingRows = currentRows.filter((row) => row.status === 'PENDING');

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
            <Typography className={styles.value}>{formatNumber(totalExpense)} THB</Typography>
          </Box>
          <Box className={styles.summaryCard}>
            <Typography className={styles.label}>คงเหลือต่อเดือน</Typography>
            <Typography className={styles.value}>{formatNumber(monthRemaining)} THB</Typography>
          </Box>
        </Box>

        <Box className={styles.pendingCard}>
          <Typography className={styles.pendingTitle}>รายการที่ยัง PENDING</Typography>
          {pendingRows.length === 0 && <Typography className={styles.emptyText}>ไม่มีรายการค้างในเดือนนี้</Typography>}
          {pendingRows.length > 0 && (
            <Stack spacing={1}>
              {map(pendingRows, (row) => (
                <Box key={row.id} className={styles.pendingRow}>
                  <Box>
                    <Typography className={styles.pendingDetail}>
                      {row.itemNo}. {row.detail || '-'}
                      {row.cardType ? (
                        <Box component="span" className={styles.pendingCardTypeInline}>
                          <span className={styles.pendingCardDot}>•</span>
                          <Image
                            src={getCardIcon(row.cardType) ?? ''}
                            alt={getCardLabel(row.cardType)}
                            width={14}
                            height={14}
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
                  <Chip label="PENDING" size="small" color="warning" />
                </Box>
              ))}
            </Stack>
          )}
        </Box>
      </Container>
    </MarketingLayout>
  );
}
