"use client";

import { useEffect, useState } from "react";

const TEST_MONTH_STORAGE_KEY = "web-accounting-test-month";
const TEST_MONTH_EVENT = "test-current-month-updated";

function parseMonthValue(value: string): Date | null {
  const [yearRaw, monthRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  if (month < 1 || month > 12) return null;
  return new Date(year, month - 1, 1);
}

export function readTestMonthValue(): string | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(TEST_MONTH_STORAGE_KEY);
  if (!raw) return null;
  return parseMonthValue(raw) ? raw : null;
}

export function getEffectiveCurrentDate(): Date {
  if (typeof window === "undefined") return new Date();
  const monthValue = readTestMonthValue();
  if (!monthValue) return new Date();
  const parsed = parseMonthValue(monthValue);
  return parsed ?? new Date();
}

export function setTestMonthValue(monthValue: string | null): void {
  if (typeof window === "undefined") return;
  if (monthValue && parseMonthValue(monthValue)) {
    window.localStorage.setItem(TEST_MONTH_STORAGE_KEY, monthValue);
  } else {
    window.localStorage.removeItem(TEST_MONTH_STORAGE_KEY);
  }
  window.dispatchEvent(new CustomEvent(TEST_MONTH_EVENT));
}

export function useEffectiveCurrentDate(): Date {
  const [date, setDate] = useState<Date>(() => getEffectiveCurrentDate());

  useEffect(() => {
    const syncDate = () => setDate(getEffectiveCurrentDate());
    syncDate();
    window.addEventListener(TEST_MONTH_EVENT, syncDate);
    return () => window.removeEventListener(TEST_MONTH_EVENT, syncDate);
  }, []);

  return date;
}
