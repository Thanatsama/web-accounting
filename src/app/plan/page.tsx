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
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import MarketingLayout from '@/components/layout/MarketingLayout';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { readBudgetFromServer, writeBudgetToServer } from '@/lib/budgetApi';
import { getCurrentRoundIndex, getMonthInputValue, getRoundIndexFromDate, getRoundLabel } from '@/lib/budgetCalendar';
import { BudgetSnapshot, BudgetRow, DEFAULT_BUDGET_SNAPSHOT, RowStatus } from '@/lib/budgetState';
import { readBudgetSnapshot, writeBudgetSnapshot } from '@/lib/indexedDbBudget';
import { useEffectiveCurrentDate } from '@/lib/testingDate';
import styles from './page.module.css';

type PlanItem = {
  id: number;
  name: string;
  price: number;
  discountPercent: number;
  upfront: number;
  startMonthValue: string;
  termMonths: number;
};

const TERM_OPTIONS = [3, 6, 10, 12, 18, 24];
const STATUS_OPTIONS: RowStatus[] = ['PENDING', 'PAID'];

function formatNumber(value: number): string {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function nowTimestamp(): number {
  return new Date().getTime();
}

function buildExpenseByMonth(startMonth: number, termMonths: number, monthlyPay: number): Record<string, number> {
  const result: Record<string, number> = {};
  for (let i = 0; i < termMonths; i += 1) {
    result[String(startMonth + i)] = monthlyPay;
  }
  return result;
}

function monthValueToRound(monthValue: string): number {
  const [yearRaw, monthRaw] = monthValue.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return 1;
  return getRoundIndexFromDate(new Date(year, month - 1, 1));
}

function roundToMonthValue(roundIndex: number): string {
  const baseDate = new Date(2026, 2, 1);
  const date = new Date(baseDate.getFullYear(), baseDate.getMonth() + Math.max(roundIndex - 1, 0), 1);
  return getMonthInputValue(date);
}

function getRowEndMonth(row: BudgetRow): number {
  const start = Math.max(1, Math.floor(row.startMonth ?? 1));
  return start + Math.max(1, Math.floor(row.spreadMonths)) - 1;
}

export default function PlanPage() {
  const theme = useTheme();
  const isMobileView = useMediaQuery(theme.breakpoints.down('sm'));
  const currentDate = useEffectiveCurrentDate();
  const currentMonthValue = useMemo(() => getMonthInputValue(currentDate), [currentDate]);
  const [snapshot, setSnapshot] = useState<BudgetSnapshot>(DEFAULT_BUDGET_SNAPSHOT);
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('0');
  const [itemDiscount, setItemDiscount] = useState('0');
  const [itemUpfront, setItemUpfront] = useState('0');
  const [itemStartMonth, setItemStartMonth] = useState(getMonthInputValue());
  const [itemTermMonths, setItemTermMonths] = useState<number>(3);
  const [items, setItems] = useState<PlanItem[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingMonthlyPay, setEditingMonthlyPay] = useState('0');
  const [editingTerm, setEditingTerm] = useState<number>(3);
  const [editingStartMonth, setEditingStartMonth] = useState(getMonthInputValue());
  const [editingStatus, setEditingStatus] = useState<RowStatus>('PENDING');
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'draft' | 'row'; id: number } | null>(null);
  const [convertTargetPlanId, setConvertTargetPlanId] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const hydrate = async () => {
      const local = await readBudgetSnapshot();
      let next = local;
      const fromServer = await readBudgetFromServer();
      if (fromServer && fromServer.updatedAt > local.updatedAt) {
        next = fromServer;
        await writeBudgetSnapshot(fromServer);
      }
      if (!mounted) return;
      setSnapshot(next);
    };
    void hydrate();
    return () => {
      mounted = false;
    };
  }, []);

  const inactiveDraftPlans = useMemo(
    () =>
      map(items, (item) => {
        const discountValue = item.price * (item.discountPercent / 100);
        const net = Math.max(item.price - discountValue - item.upfront, 0);
        const monthlyPay = item.termMonths > 0 ? net / item.termMonths : net;
        return {
          ...item,
          monthlyPay,
          startRound: monthValueToRound(item.startMonthValue),
        };
      }),
    [items],
  );

  const currentRoundIndex = useMemo(
    () => getCurrentRoundIndex(Math.max(snapshot.totalTables, 1), currentDate),
    [snapshot.totalTables, currentDate],
  );

  const activePlans = useMemo(
    () =>
      map(
        snapshot.rows
          .filter((row) => row.planMeta && !row.isCancelled && getRowEndMonth(row) >= currentRoundIndex)
          .sort((a, b) => (a.startMonth ?? 1) - (b.startMonth ?? 1)),
        (row) => {
          const start = row.startMonth ?? row.planMeta?.startMonth ?? 1;
          const end = getRowEndMonth(row);
          return {
            id: row.id,
            detail: row.detail,
            monthlyPay: row.expense,
            termMonths: row.spreadMonths,
            startMonth: start,
            endMonth: end,
            status: row.status,
          };
        },
      ),
    [snapshot.rows, currentRoundIndex],
  );

  const inactiveRowPlans = useMemo(
    () =>
      map(
        snapshot.rows
          .filter((row) => row.planMeta && row.isCancelled)
          .sort((a, b) => (a.startMonth ?? 1) - (b.startMonth ?? 1)),
        (row) => {
          const start = row.startMonth ?? row.planMeta?.startMonth ?? 1;
          const end = getRowEndMonth(row);
          return {
            id: row.id,
            detail: row.detail,
            monthlyPay: row.expense,
            termMonths: row.spreadMonths,
            startMonth: start,
            endMonth: end,
            status: row.status,
          };
        },
      ),
    [snapshot.rows],
  );

  const resetAddForm = () => {
    setItemName('');
    setItemPrice('0');
    setItemDiscount('0');
    setItemUpfront('0');
    setItemStartMonth(currentMonthValue);
    setItemTermMonths(3);
  };

  const closeAddDialog = () => {
    setIsAddOpen(false);
    resetAddForm();
  };

  const addItem = (event: FormEvent) => {
    event.preventDefault();
    const price = Number(itemPrice);
    const discount = Number(itemDiscount);
    const upfront = Number(itemUpfront);
    const trimmedName = itemName.trim();
    if (!trimmedName) return;
    if (!Number.isFinite(price) || price < 0) return;
    if (!Number.isFinite(discount) || discount < 0) return;
    if (!Number.isFinite(upfront) || upfront < 0) return;

    setItems((prev) => [
      ...prev,
      {
        id: nowTimestamp(),
        name: trimmedName,
        price,
        discountPercent: discount,
        upfront,
        startMonthValue: itemStartMonth,
        termMonths: itemTermMonths,
      },
    ]);
    closeAddDialog();
  };

  const addDraftPlanToTable = async (draftId: number) => {
    const target = items.find((item) => item.id === draftId);
    if (!target) return;

    const discountValue = target.price * (target.discountPercent / 100);
    const net = Math.max(target.price - discountValue - target.upfront, 0);
    const monthlyPay = Number((net / target.termMonths).toFixed(2));
    const startMonth = monthValueToRound(target.startMonthValue);
    const termMonths = target.termMonths;

    const planRow: BudgetRow = {
      id: nowTimestamp() + target.id,
      detail: `${target.name} (${termMonths} เดือน)`,
      expense: monthlyPay,
      expenseByMonth: buildExpenseByMonth(startMonth, termMonths, monthlyPay),
      startMonth,
      spreadMonths: termMonths,
      compensation: 0,
      source: 'PLAN',
      status: 'PENDING',
      planMeta: {
        planId: `plan-${target.id}`,
        termMonths,
        startMonth,
      },
    };

    const nextSnapshot: BudgetSnapshot = {
      ...snapshot,
      rows: [...snapshot.rows, planRow],
      totalTables: Math.max(snapshot.totalTables, getRowEndMonth(planRow), 1),
      updatedAt: nowTimestamp(),
    };

    await writeBudgetSnapshot(nextSnapshot);
    void writeBudgetToServer(nextSnapshot);
    setSnapshot(nextSnapshot);
    setItems((prev) => prev.filter((item) => item.id !== draftId));
  };

  const openEditPlanDialog = (rowId: number) => {
    const target = snapshot.rows.find((row) => row.id === rowId && row.planMeta && !row.isCancelled);
    if (!target) return;
    const start = target.startMonth ?? target.planMeta?.startMonth ?? 1;
    setEditingRowId(target.id);
    setEditingName(target.detail);
    setEditingMonthlyPay(String(target.expense));
    setEditingTerm(Math.max(1, target.spreadMonths));
    setEditingStartMonth(roundToMonthValue(start));
    setEditingStatus(target.status);
    setIsEditOpen(true);
  };

  const closeEditPlanDialog = () => {
    setIsEditOpen(false);
    setEditingRowId(null);
    setEditingName('');
    setEditingMonthlyPay('0');
    setEditingTerm(3);
    setEditingStartMonth(currentMonthValue);
    setEditingStatus('PENDING');
  };

  const saveEditedPlan = async () => {
    if (editingRowId === null) return;

    const nextMonthlyPay = Number(editingMonthlyPay);
    const nextTerm = Number(editingTerm);
    const trimmedName = editingName.trim();
    const nextStartRound = monthValueToRound(editingStartMonth);
    if (!trimmedName) return;
    if (!Number.isFinite(nextMonthlyPay) || nextMonthlyPay < 0) return;
    if (!Number.isFinite(nextTerm) || nextTerm < 1) return;

    const normalizedTerm = Math.floor(nextTerm);
    const updatedRows = map(snapshot.rows, (row) => {
      if (row.id !== editingRowId) return row;
      if (!row.planMeta) return row;
      return {
        ...row,
        detail: trimmedName,
        expense: nextMonthlyPay,
        expenseByMonth: buildExpenseByMonth(nextStartRound, normalizedTerm, nextMonthlyPay),
        startMonth: nextStartRound,
        spreadMonths: normalizedTerm,
        status: editingStatus,
        planMeta: {
          ...row.planMeta,
          startMonth: nextStartRound,
          termMonths: normalizedTerm,
        },
      };
    });

    const nextTotalTables = updatedRows.reduce(
      (maxMonth, row) => Math.max(maxMonth, getRowEndMonth(row)),
      1,
    );

    const nextSnapshot: BudgetSnapshot = {
      ...snapshot,
      rows: updatedRows,
      totalTables: Math.max(nextTotalTables, 1),
      updatedAt: nowTimestamp(),
    };
    await writeBudgetSnapshot(nextSnapshot);
    void writeBudgetToServer(nextSnapshot);
    setSnapshot(nextSnapshot);
    closeEditPlanDialog();
  };

  const removePlanFromTable = async (rowId: number) => {
    const nextRows = map(snapshot.rows, (row) => {
      if (row.id !== rowId) return row;
      return {
        ...row,
        isCancelled: true,
      };
    });

    const nextSnapshot: BudgetSnapshot = {
      ...snapshot,
      rows: nextRows,
      updatedAt: nowTimestamp(),
    };
    await writeBudgetSnapshot(nextSnapshot);
    void writeBudgetToServer(nextSnapshot);
    setSnapshot(nextSnapshot);
  };

  const convertPlanToRealItem = async (rowId: number) => {
    const nextRows = map(snapshot.rows, (row) => {
      if (row.id !== rowId) return row;
      return {
        ...row,
        planMeta: undefined,
        source: row.source === 'PLAN' ? '' : row.source,
      };
    });

    const nextSnapshot: BudgetSnapshot = {
      ...snapshot,
      rows: nextRows,
      updatedAt: nowTimestamp(),
    };
    await writeBudgetSnapshot(nextSnapshot);
    void writeBudgetToServer(nextSnapshot);
    setSnapshot(nextSnapshot);
  };

  const openConvertPlanDialog = (rowId: number) => {
    setConvertTargetPlanId(rowId);
  };

  const closeConvertPlanDialog = () => {
    setConvertTargetPlanId(null);
  };

  const confirmConvertPlan = async () => {
    if (convertTargetPlanId === null) return;
    await convertPlanToRealItem(convertTargetPlanId);
    closeConvertPlanDialog();
  };

  const addInactiveRowPlanToTable = async (rowId: number) => {
    const nextRows = map(snapshot.rows, (row) => {
      if (row.id !== rowId) return row;
      return {
        ...row,
        isCancelled: false,
      };
    });

    const nextSnapshot: BudgetSnapshot = {
      ...snapshot,
      rows: nextRows,
      updatedAt: nowTimestamp(),
    };
    await writeBudgetSnapshot(nextSnapshot);
    void writeBudgetToServer(nextSnapshot);
    setSnapshot(nextSnapshot);
  };

  const openDeletePlanDialog = (target: { type: 'draft' | 'row'; id: number }) => {
    setDeleteTarget(target);
  };

  const closeDeletePlanDialog = () => {
    setDeleteTarget(null);
  };

  const confirmDeletePlan = async () => {
    if (!deleteTarget) return;

    if (deleteTarget.type === 'draft') {
      setItems((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      closeDeletePlanDialog();
      return;
    }

    const nextSnapshot: BudgetSnapshot = {
      ...snapshot,
      rows: snapshot.rows.filter((row) => row.id !== deleteTarget.id),
      updatedAt: nowTimestamp(),
    };
    await writeBudgetSnapshot(nextSnapshot);
    void writeBudgetToServer(nextSnapshot);
    setSnapshot(nextSnapshot);
    closeDeletePlanDialog();
  };

  return (
    <MarketingLayout>
      <Container maxWidth="lg" className={styles.wrapper}>
        <Typography variant="h3" className={styles.title}>
          Plan Calculator
        </Typography>
        <Typography className={styles.subtitle}>
          แผนที่ยังไม่เพิ่มเข้า Table จะอยู่ใน Inactive Plans และสามารถจัดการรายแถวได้
        </Typography>
        {isMobileView && (
          <Typography className={styles.subtitle}>โหมดมือถือเป็น View Only</Typography>
        )}

        <Box className={styles.panel}>
          <Typography className={styles.sectionTitle}>เพิ่มรายการแผน</Typography>
          {!isMobileView && (
            <Stack direction="row" justifyContent="flex-end">
              <Button
                variant="contained"
                onClick={() => {
                  setItemStartMonth(currentMonthValue);
                  setIsAddOpen(true);
                }}
                sx={{
                  borderRadius: '18px',
                  px: 1.2,
                  mt: 1,
                  py: 0.5,
                  maxHeight: 48,
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
            </Stack>
          )}
        </Box>

        <Box className={`${styles.panel} ${styles.activePanel}`}>
          <Typography className={styles.sectionTitle}>Active Plans</Typography>
          <Box className={styles.itemsBox}>
            {activePlans.length === 0 && <Typography className={styles.emptyText}>ยังไม่มีแผนที่ active</Typography>}
            {activePlans.length > 0 &&
              map(activePlans, (plan) => (
                <Box key={plan.id} className={styles.itemRow}>
                  <Box>
                    <Typography className={styles.rowTitle}>{plan.detail}</Typography>
                    <Typography className={styles.rowMeta}>เริ่ม: {getRoundLabel(plan.startMonth)}</Typography>
                    <Typography className={styles.rowMeta}>สิ้นสุด: {getRoundLabel(plan.endMonth)}</Typography>
                    <Typography className={styles.rowMeta}>ระยะเวลาผ่อน: {plan.termMonths} เดือน</Typography>
                    <Typography className={styles.rowMeta}>ค่างวด: {formatNumber(plan.monthlyPay)} THB</Typography>
                  </Box>
                  {!isMobileView && <Stack direction="row" spacing={1}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<EditRoundedIcon fontSize="small" />}
                      onClick={() => openEditPlanDialog(plan.id)}
                    >
                      แก้ไข
                    </Button>
                    <Button
                      variant="outlined"
                      color="success"
                      size="small"
                      onClick={() => openConvertPlanDialog(plan.id)}
                    >
                      เปลี่ยนเป็นรายการจริง
                    </Button>
                    <Button
                      variant="outlined"
                      color="warning"
                      size="small"
                      onClick={() => {
                        void removePlanFromTable(plan.id);
                      }}
                    >
                      ลบออกจาก Table
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      startIcon={<DeleteOutlineRoundedIcon fontSize="small" />}
                      onClick={() => openDeletePlanDialog({ type: 'row', id: plan.id })}
                    >
                      ลบแผน
                    </Button>
                  </Stack>}
                </Box>
              ))}
          </Box>
        </Box>

        <Box className={`${styles.panel} ${styles.inactivePanel}`}>
          <Typography className={styles.sectionTitle}>Inactive Plans</Typography>
          <Box className={styles.itemsBox}>
            {inactiveDraftPlans.length === 0 && inactiveRowPlans.length === 0 && (
              <Typography className={styles.emptyText}>ไม่มีแผนที่ inactive</Typography>
            )}

            {map(inactiveDraftPlans, (item) => (
              <Box key={`draft-${item.id}`} className={styles.itemRow}>
                <Box>
                  <Typography className={styles.rowTitle}>{item.name}</Typography>
                  <Typography className={styles.rowMeta}>เริ่ม: {getRoundLabel(item.startRound)}</Typography>
                  <Typography className={styles.rowMeta}>
                    สิ้นสุด: {getRoundLabel(item.startRound + item.termMonths - 1)}
                  </Typography>
                  <Typography className={styles.rowMeta}>ระยะเวลาผ่อน: {item.termMonths} เดือน</Typography>
                  <Typography className={styles.rowMeta}>ค่างวด: {formatNumber(item.monthlyPay)} THB</Typography>
                </Box>
                {!isMobileView && <Stack direction="row" spacing={1}>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => {
                      void addDraftPlanToTable(item.id);
                    }}
                  >
                    เพิ่มเข้า Table
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    startIcon={<DeleteOutlineRoundedIcon fontSize="small" />}
                    onClick={() => openDeletePlanDialog({ type: 'draft', id: item.id })}
                  >
                    ลบแผน
                  </Button>
                </Stack>}
              </Box>
            ))}

            {map(inactiveRowPlans, (plan) => (
              <Box key={`inactive-${plan.id}`} className={styles.itemRow}>
                <Box>
                  <Typography className={styles.rowTitle}>{plan.detail}</Typography>
                  <Typography className={styles.rowMeta}>เริ่ม: {getRoundLabel(plan.startMonth)}</Typography>
                  <Typography className={styles.rowMeta}>สิ้นสุด: {getRoundLabel(plan.endMonth)}</Typography>
                  <Typography className={styles.rowMeta}>ระยะเวลาผ่อน: {plan.termMonths} เดือน</Typography>
                  <Typography className={styles.rowMeta}>ค่างวด: {formatNumber(plan.monthlyPay)} THB</Typography>
                </Box>
                {!isMobileView && <Stack direction="row" spacing={1}>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => {
                      void addInactiveRowPlanToTable(plan.id);
                    }}
                  >
                    เพิ่มเข้า Table
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    startIcon={<DeleteOutlineRoundedIcon fontSize="small" />}
                    onClick={() => openDeletePlanDialog({ type: 'row', id: plan.id })}
                  >
                    ลบแผน
                  </Button>
                </Stack>}
              </Box>
            ))}
          </Box>
        </Box>
      </Container>

      <Dialog open={isAddOpen && !isMobileView} onClose={closeAddDialog} fullWidth maxWidth="md">
        <DialogTitle sx={{ pb: 0.6 }}>
          <Typography component="div" variant="h6" sx={{ fontWeight: 700 }}>
            เพิ่มรายการแผน
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: '14px !important', pb: 1.4 }}>
          <form onSubmit={addItem}>
            <Stack spacing={1.6}>
              <TextField
                fullWidth
                size="small"
                label="รายการ"
                value={itemName}
                onChange={(event) => setItemName(event.target.value)}
              />
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2}>
                <TextField
                  size="small"
                  label="ราคา (THB)"
                  type="number"
                  value={itemPrice}
                  onChange={(event) => setItemPrice(event.target.value)}
                  slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
                  fullWidth
                />
                <TextField
                  size="small"
                  label="ส่วนลด (%)"
                  type="number"
                  value={itemDiscount}
                  onChange={(event) => setItemDiscount(event.target.value)}
                  slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
                  fullWidth
                />
              </Stack>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2}>
                <TextField
                  size="small"
                  label="จ่ายล่วงหน้า"
                  type="number"
                  value={itemUpfront}
                  onChange={(event) => setItemUpfront(event.target.value)}
                  slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
                  fullWidth
                />
                <TextField
                  size="small"
                  label="วันที่เริ่ม"
                  type="month"
                  value={itemStartMonth}
                  onChange={(event) => setItemStartMonth(event.target.value)}
                  slotProps={{ htmlInput: { min: currentMonthValue } }}
                  fullWidth
                />
              </Stack>
              <TextField
                size="small"
                select
                label="งวดผ่อน 0%"
                value={itemTermMonths}
                onChange={(event) => setItemTermMonths(Number(event.target.value))}
                fullWidth
              >
                {map(TERM_OPTIONS, (term) => (
                  <MenuItem key={`add-term-${term}`} value={term}>
                    0% {term} เดือน
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
            <DialogActions sx={{ px: 0, pb: 0, pt: 2 }}>
              <Button onClick={closeAddDialog}>ยกเลิก</Button>
              <Button type="submit" variant="contained">
                เพิ่มรายการ
              </Button>
            </DialogActions>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen && !isMobileView} onClose={closeEditPlanDialog} fullWidth maxWidth="sm">
        <DialogTitle sx={{ pb: 0.6 }}>
          <Typography component="div" variant="h6" sx={{ fontWeight: 700 }}>
            แก้ไข Active Plan
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: '14px !important', pb: 1.4 }}>
          <Stack spacing={1.6}>
            <TextField
              size="small"
              label="ชื่อรายการ"
              value={editingName}
              onChange={(event) => setEditingName(event.target.value)}
              fullWidth
            />
            <TextField
              size="small"
              label="ค่างวดต่อเดือน (THB)"
              type="number"
              value={editingMonthlyPay}
              onChange={(event) => setEditingMonthlyPay(event.target.value)}
              fullWidth
              slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
            />
            <TextField
              size="small"
              select
              label="จำนวนเดือน"
              value={editingTerm}
              onChange={(event) => setEditingTerm(Number(event.target.value))}
              fullWidth
            >
              {map(TERM_OPTIONS, (term) => (
                <MenuItem key={`edit-term-${term}`} value={term}>
                  {term} เดือน
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              label="เดือนเริ่ม"
              type="month"
              value={editingStartMonth}
              onChange={(event) => setEditingStartMonth(event.target.value)}
              fullWidth
              slotProps={{ htmlInput: { min: currentMonthValue } }}
            />
            <TextField
              size="small"
              select
              label="สถานะ"
              value={editingStatus}
              onChange={(event) => setEditingStatus(event.target.value as RowStatus)}
              fullWidth
            >
              {map(STATUS_OPTIONS, (option) => (
                <MenuItem key={`edit-status-${option}`} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, pt: 1 }}>
          <Button onClick={closeEditPlanDialog}>ยกเลิก</Button>
          <Button variant="contained" onClick={saveEditedPlan}>
            อัปเดต
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteTarget !== null && !isMobileView} onClose={closeDeletePlanDialog} fullWidth maxWidth="xs">
        <DialogTitle sx={{ pb: 0.6 }}>
          <Typography component="div" variant="h6" sx={{ fontWeight: 700 }}>
            ยืนยันการลบแผน
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: '10px !important' }}>
          <Typography sx={{ color: 'text.secondary' }}>
            ต้องการลบแผนนี้ออกจากระบบใช่หรือไม่? การลบจะลบข้อมูลแผนออกทั้งหมด
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, pt: 1 }}>
          <Button onClick={closeDeletePlanDialog}>ยกเลิก</Button>
          <Button color="error" variant="contained" onClick={confirmDeletePlan}>
            ลบแผน
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={convertTargetPlanId !== null && !isMobileView} onClose={closeConvertPlanDialog} fullWidth maxWidth="xs">
        <DialogTitle sx={{ pb: 0.6 }}>
          <Typography component="div" variant="h6" sx={{ fontWeight: 700 }}>
            ยืนยันการเปลี่ยนเป็นรายการจริง
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: '10px !important' }}>
          <Typography sx={{ color: 'text.secondary' }}>
            ต้องการเปลี่ยนแผนนี้เป็นรายการจริงใช่หรือไม่? รายการนี้จะไม่ถูกจัดการใน Active/Inactive Plans อีก
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, pt: 1 }}>
          <Button onClick={closeConvertPlanDialog}>ยกเลิก</Button>
          <Button color="success" variant="contained" onClick={confirmConvertPlan}>
            ยืนยัน
          </Button>
        </DialogActions>
      </Dialog>
    </MarketingLayout>
  );
}
