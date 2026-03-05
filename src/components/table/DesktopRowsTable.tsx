"use client";

import map from "lodash/map";
import { Chip } from "@mui/material";
import { MonthDisplayRow } from "@/components/table/types";
import styles from "./DesktopRowsTable.module.css";

type DesktopRowsTableProps = {
  rows: MonthDisplayRow[];
  readonly?: boolean;
  onRowClick?: (rowId: number) => void;
  formatNumber: (value: number) => string;
};

export default function DesktopRowsTable({
  rows,
  readonly = false,
  onRowClick,
  formatNumber,
}: DesktopRowsTableProps) {
  return (
    <div className={styles.tableScroll}>
      <table className={styles.dataTable}>
        <thead>
          <tr>
            <th>รายการที่</th>
            <th>รายละเอียด</th>
            <th>ค่าใช้จ่าย</th>
            <th>จำนวนเดือนที่เหลือ</th>
            <th>เงินทดแทน</th>
            <th>ที่มา</th>
            <th>เหลือจ่าย</th>
            <th>STATUS</th>
          </tr>
        </thead>
        <tbody>
          {map(rows, (row) => (
            <tr
              key={row.id}
              className={readonly ? styles.readonlyRow : styles.clickableRow}
              onClick={() => {
                if (!readonly && onRowClick) onRowClick(row.id);
              }}
            >
              <td>{row.itemNo}</td>
              <td>{row.detail}</td>
              <td>{formatNumber(row.expense)}</td>
              <td>{row.monthsLeft}</td>
              <td>{formatNumber(row.compensation)}</td>
              <td>{row.source || "-"}</td>
              <td>{formatNumber(row.balanceAfter)}</td>
              <td>
                <Chip
                  label={row.status}
                  size="small"
                  color={row.status === "PAID" ? "success" : "warning"}
                  variant="filled"
                />
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className={styles.emptyCell}>
                No rows in this table
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
