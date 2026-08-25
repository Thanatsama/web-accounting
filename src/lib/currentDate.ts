"use client";

import { useEffect, useState } from "react";

const LEGACY_TEST_MONTH_STORAGE_KEY = "web-accounting-test-month";

export function useCurrentDate(): Date {
  const [date] = useState<Date>(() => new Date());

  useEffect(() => {
    window.localStorage.removeItem(LEGACY_TEST_MONTH_STORAGE_KEY);
  }, []);

  return date;
}
