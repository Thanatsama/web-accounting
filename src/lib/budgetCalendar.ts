const THAI_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

// Month 1 is fixed to March 2026.
const BASE_YEAR = 2026;
const BASE_MONTH_INDEX = 2;

export function getMonthInputValue(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function getRoundIndexFromDate(date: Date): number {
  const diffMonths =
    (date.getFullYear() - BASE_YEAR) * 12 + (date.getMonth() - BASE_MONTH_INDEX);
  return Math.max(diffMonths + 1, 1);
}

export function getRoundLabel(roundIndex: number): string {
  const date = new Date(BASE_YEAR, BASE_MONTH_INDEX + (roundIndex - 1), 1);
  const monthName = THAI_MONTHS[date.getMonth()] ?? "";
  return `${monthName} / ${date.getFullYear()}`;
}

export function getCurrentRoundIndex(totalTables: number, date: Date = new Date()): number {
  const round = getRoundIndexFromDate(date);
  return Math.min(Math.max(round, 1), Math.max(totalTables, 1));
}
