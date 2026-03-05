"use client";

import { Chip, Stack, Typography } from "@mui/material";
import map from "lodash/map";
import { MonthDisplayRow } from "@/components/table/types";
import styles from "./MobileMonthSummary.module.css";

type MobileMonthSummaryProps = {
  rows: MonthDisplayRow[];
};

export default function MobileMonthSummary({ rows }: MobileMonthSummaryProps) {
  return (
    <div className={styles.mobileSummaryCard}>
      {rows.length === 0 && <Typography className={styles.mobileSummarySubtle}>ไม่มีรายการ</Typography>}
      {map(rows, (row) => (
        <div key={`mobile-row-${row.id}`} className={styles.mobileItemRow}>
          <Typography className={styles.mobileItemTitle}>
            {row.itemNo}. {row.detail || "-"}
          </Typography>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography className={styles.mobileSummaryLabel}>ค่าใช้จ่าย {row.expense.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} THB</Typography>
            <Chip
              label={row.status}
              size="small"
              color={row.status === "PAID" ? "success" : "warning"}
              variant="filled"
            />
          </Stack>
        </div>
      ))}
    </div>
  );
}
