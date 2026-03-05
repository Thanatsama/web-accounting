"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import {
  Box,
  Button,
  IconButton,
  InputAdornment,
  Popover,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { readBudgetFromServer, writeBudgetToServer } from "@/lib/budgetApi";
import { getCurrentRoundIndex, getMonthInputValue } from "@/lib/budgetCalendar";
import {
  BudgetRow,
  BudgetSnapshot,
  DEFAULT_BUDGET_SNAPSHOT,
} from "@/lib/budgetState";
import { readBudgetSnapshot, updateBudgetSnapshot, writeBudgetSnapshot } from "@/lib/indexedDbBudget";
import {
  readTestMonthValue,
  setTestMonthValue,
  useEffectiveCurrentDate,
} from "@/lib/testingDate";

function formatTHB(value: number): string {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function parseNumberInput(value: string): number | null {
  const normalized = value.replace(/[^\d.-]/g, "");
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function downloadBackupFile(snapshot: BudgetSnapshot): void {
  const payload = {
    backupVersion: 1,
    exportedAt: new Date().toISOString(),
    data: snapshot,
  };
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `web-accounting-backup-${stamp}.json`;

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function isBudgetSnapshot(value: unknown): value is BudgetSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<BudgetSnapshot>;
  return (
    typeof candidate.accountBalance === "number" &&
    typeof candidate.monthlyIncome === "number" &&
    typeof candidate.totalTables === "number" &&
    Array.isArray(candidate.rows) &&
    typeof candidate.updatedAt === "number"
  );
}

function getRowStartMonth(row: BudgetRow): number {
  return Math.max(1, Math.floor(row.startMonth ?? 1));
}

function getRowEndMonth(row: BudgetRow): number {
  return getRowStartMonth(row) + Math.max(1, Math.floor(row.spreadMonths)) - 1;
}

function resolveExpenseByMonth(row: BudgetRow, tableIndex: number): number {
  const monthKey = String(tableIndex);
  return row.expenseByMonth?.[monthKey] ?? row.expense;
}

function resolveCompensationByMonth(row: BudgetRow, tableIndex: number): number {
  const monthKey = String(tableIndex);
  return row.compensationByMonth?.[monthKey] ?? row.compensation;
}

function resolveMonthlyIncomeByMonth(
  monthlyIncome: number,
  monthlyIncomeByMonth: Record<string, number> | undefined,
  tableIndex: number,
): number {
  const monthValue = monthlyIncomeByMonth?.[String(tableIndex)];
  if (typeof monthValue !== "number" || !Number.isFinite(monthValue)) {
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
  if (typeof monthValue !== "number" || !Number.isFinite(monthValue)) {
    return tableIndex === 1 ? accountBalance : null;
  }
  return monthValue;
}

function buildDisplayRows(rows: BudgetRow[], tableIndex: number): Array<{ expense: number; compensation: number }> {
  const result: Array<{ expense: number; compensation: number }> = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (row.isCancelled) continue;
    const startMonth = getRowStartMonth(row);
    const endMonth = getRowEndMonth(row);
    if (tableIndex >= startMonth && tableIndex <= endMonth) {
      result.push({
        expense: resolveExpenseByMonth(row, tableIndex),
        compensation: resolveCompensationByMonth(row, tableIndex),
      });
    }
  }

  return result;
}

export default function AccountBalanceMenu() {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [snapshot, setSnapshot] = useState<BudgetSnapshot>(DEFAULT_BUDGET_SNAPSHOT);
  const [isEditing, setIsEditing] = useState(false);
  const [draftBalance, setDraftBalance] = useState("0");
  const [draftMonthlyIncome, setDraftMonthlyIncome] = useState("0");
  const [testMonthValue, setTestMonthValueState] = useState<string>("");
  const [restoreError, setRestoreError] = useState<string>("");
  const restoreInputRef = useRef<HTMLInputElement | null>(null);
  const currentDate = useEffectiveCurrentDate();

  const isOpen = Boolean(anchorEl);
  const currentRoundIndex = useMemo(
    () => getCurrentRoundIndex(Math.max(snapshot.totalTables, 1), currentDate),
    [snapshot.totalTables, currentDate],
  );

  const roundStartingByMonth = useMemo(() => {
    const starts: number[] = [];
    const endings: number[] = [];

    for (let i = 0; i < Math.max(snapshot.totalTables, 1); i += 1) {
      const tableIndex = i + 1;
      const monthIncome = resolveMonthlyIncomeByMonth(
        snapshot.monthlyIncome,
        snapshot.monthlyIncomeByMonth,
        tableIndex,
      );
      const fallbackStartBalance =
        i === 0
          ? snapshot.accountBalance
          : (endings[i - 1] ?? snapshot.accountBalance) + monthIncome;
      const overriddenStartBalance = resolveAccountBalanceByMonth(
        snapshot.accountBalance,
        snapshot.accountBalanceByMonth,
        tableIndex,
      );
      const startBalance = overriddenStartBalance ?? fallbackStartBalance;
      starts.push(startBalance);

      const displayRows = buildDisplayRows(snapshot.rows, tableIndex);
      const endBalance = displayRows.reduce(
        (running, row) => running + row.compensation - row.expense,
        startBalance,
      );
      endings.push(endBalance);
    }

    return starts;
  }, [
    snapshot.totalTables,
    snapshot.accountBalance,
    snapshot.accountBalanceByMonth,
    snapshot.monthlyIncome,
    snapshot.monthlyIncomeByMonth,
    snapshot.rows,
  ]);

  const currentRoundBalance =
    roundStartingByMonth[currentRoundIndex - 1] ?? snapshot.accountBalance;

  const formattedBalance = useMemo(() => formatTHB(currentRoundBalance), [currentRoundBalance]);
  const formattedMonthlyIncome = useMemo(() => formatTHB(snapshot.monthlyIncome), [snapshot.monthlyIncome]);

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
      setDraftBalance(String(nextSnapshot.accountBalance));
      setDraftMonthlyIncome(String(nextSnapshot.monthlyIncome));
      setTestMonthValueState(readTestMonthValue() ?? "");
    };

    void hydrate();
    return () => {
      mounted = false;
    };
  }, []);

  const openPopover = (event: React.MouseEvent<HTMLElement>) => {
    setTestMonthValueState(readTestMonthValue() ?? "");
    setAnchorEl(event.currentTarget);
  };

  const closePopover = () => {
    setAnchorEl(null);
    setIsEditing(false);
    setDraftBalance(String(currentRoundBalance));
    setDraftMonthlyIncome(String(snapshot.monthlyIncome));
  };

  const startEdit = () => {
    setDraftBalance(String(currentRoundBalance));
    setDraftMonthlyIncome(String(snapshot.monthlyIncome));
    setIsEditing(true);
  };

  const saveEdit = () => {
    void (async () => {
      const nextBalance = parseNumberInput(draftBalance);
      const nextMonthlyIncome = parseNumberInput(draftMonthlyIncome);
      if (nextBalance === null || nextMonthlyIncome === null) return;

      const nextSnapshot = await updateBudgetSnapshot((current) => {
        const currentRound = getCurrentRoundIndex(Math.max(current.totalTables, 1));
        return {
          ...current,
          accountBalance: currentRound === 1 ? nextBalance : current.accountBalance,
          accountBalanceByMonth: {
            ...(current.accountBalanceByMonth ?? {}),
            [String(currentRound)]: nextBalance,
          },
          monthlyIncome: nextMonthlyIncome,
          totalTables: Math.max(1, current.totalTables),
          updatedAt: Date.now(),
        };
      });

      setSnapshot(nextSnapshot);
      void writeBudgetToServer(nextSnapshot);
      window.dispatchEvent(
        new CustomEvent("account-balance-updated", {
          detail: { snapshot: nextSnapshot },
        }),
      );
      setIsEditing(false);
    })();
  };

  const backupData = () => {
    downloadBackupFile(snapshot);
  };

  const restoreDataFromFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      void (async () => {
        try {
          const text = String(reader.result ?? "");
          const parsed = JSON.parse(text) as { data?: unknown } | unknown;
          const candidate = (
            parsed && typeof parsed === "object" && "data" in parsed ? (parsed as { data?: unknown }).data : parsed
          ) as unknown;
          if (!isBudgetSnapshot(candidate)) {
            setRestoreError("ไฟล์ไม่ถูกต้อง: ไม่พบข้อมูล backup ที่รองรับ");
            return;
          }
          const nextSnapshot: BudgetSnapshot = {
            ...candidate,
            totalTables: Math.max(1, Number(candidate.totalTables ?? 1)),
            updatedAt: Date.now(),
          };
          await writeBudgetSnapshot(nextSnapshot);
          void writeBudgetToServer(nextSnapshot);
          setSnapshot(nextSnapshot);
          setRestoreError("");
          window.dispatchEvent(
            new CustomEvent("account-balance-updated", {
              detail: { snapshot: nextSnapshot },
            }),
          );
        } catch {
          setRestoreError("ไฟล์ไม่ถูกต้อง: อ่านหรือแปลงข้อมูลไม่สำเร็จ");
        } finally {
          if (restoreInputRef.current) {
            restoreInputRef.current.value = "";
          }
        }
      })();
    };
    reader.readAsText(file);
  };

  const openRestorePicker = () => {
    setRestoreError("");
    restoreInputRef.current?.click();
  };

  const saveTestMonth = () => {
    const normalized = testMonthValue.trim();
    setTestMonthValue(normalized ? normalized : null);
  };

  const resetTestMonth = () => {
    setTestMonthValueState("");
    setTestMonthValue(null);
  };

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        startIcon={<AccountBalanceWalletRoundedIcon fontSize="small" />}
        onClick={openPopover}
        sx={{
          borderColor: "rgba(0,0,0,0.12)",
          color: "text.primary",
          backgroundColor: "rgba(255,255,255,0.7)",
          backdropFilter: "blur(6px)",
          maxWidth: { xs: 180, md: "none" },
        }}
      >
        <Box
          component="span"
          sx={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            display: "inline-block",
          }}
        >
          {formattedBalance}
        </Box>
      </Button>

      <Popover
        open={isOpen}
        anchorEl={anchorEl}
        onClose={closePopover}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Box sx={{ p: 2, width: 320 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
            <Typography variant="subtitle2" sx={{ color: "text.secondary" }}>
              Account Balance
            </Typography>
            {!isEditing && (
              <Tooltip title="Edit balance">
                <IconButton size="small" onClick={startEdit} aria-label="Edit account balance">
                  <EditRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Stack>

          {!isEditing && (
            <Stack spacing={1}>
              <Box>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Account Balance (Current Round)
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {formattedBalance}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Monthly Income
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {formattedMonthlyIncome}
                </Typography>
              </Box>
            </Stack>
          )}

          {isEditing && (
            <Stack spacing={1.5}>
              <TextField
                size="small"
                autoFocus
                label="Account Balance"
                value={draftBalance}
                onChange={(event) => setDraftBalance(event.target.value)}
                placeholder="0.00"
                slotProps={{
                  input: {
                    startAdornment: <InputAdornment position="start">THB</InputAdornment>,
                  },
                }}
              />
              <TextField
                size="small"
                label="Monthly Income"
                value={draftMonthlyIncome}
                onChange={(event) => setDraftMonthlyIncome(event.target.value)}
                placeholder="0.00"
                slotProps={{
                  input: {
                    startAdornment: <InputAdornment position="start">THB</InputAdornment>,
                  },
                }}
              />
              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button size="small" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button size="small" variant="contained" onClick={saveEdit}>
                  Save
                </Button>
              </Stack>
            </Stack>
          )}

          <Box sx={{ mt: 1.8, pt: 1.2, borderTop: "1px solid rgba(0,0,0,0.08)" }}>
            <Typography variant="body2" sx={{ color: "text.secondary", mb: 0.8 }}>
              Test Current Month
            </Typography>
            <Stack spacing={1}>
              <TextField
                size="small"
                type="month"
                value={testMonthValue}
                onChange={(event) => setTestMonthValueState(event.target.value)}
                slotProps={{ htmlInput: { min: getMonthInputValue(new Date(2026, 2, 1)) } }}
              />
              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button size="small" onClick={resetTestMonth}>
                  Reset
                </Button>
                <Button size="small" variant="contained" onClick={saveTestMonth}>
                  Apply
                </Button>
              </Stack>
            </Stack>
          </Box>

          <Box sx={{ mt: 1.4, pt: 1.2, borderTop: "1px solid rgba(0,0,0,0.08)" }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} mb={1}>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Data Backup
              </Typography>
              <Button size="small" variant="outlined" onClick={backupData}>
                Backup Data
              </Button>
            </Stack>
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Data Restore
              </Typography>
              <Button size="small" variant="outlined" color="warning" onClick={openRestorePicker}>
                Restore Data
              </Button>
            </Stack>
            <input
              ref={restoreInputRef}
              type="file"
              accept="application/json"
              style={{ display: "none" }}
              onChange={restoreDataFromFile}
            />
            {restoreError && (
              <Typography variant="caption" sx={{ display: "block", mt: 0.8, color: "error.main" }}>
                {restoreError}
              </Typography>
            )}
          </Box>
        </Box>
      </Popover>
    </>
  );
}
