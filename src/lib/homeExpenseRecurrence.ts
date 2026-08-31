import { HomeExpense } from '@/lib/budgetState';
import map from 'lodash/map';

export function expandRecurringHomeExpenses(
  expensesByMonth: Record<string, HomeExpense[]>,
  totalTables: number,
): Record<string, HomeExpense[]> {
  const expanded = Object.fromEntries(
    map(Object.entries(expensesByMonth), ([monthKey, expenses]) => [monthKey, [...expenses]]),
  );
  const templates = new Map<number, { startMonth: number; item: HomeExpense }>();

  for (const [monthKey, expenses] of Object.entries(expanded)) {
    const tableIndex = Number(monthKey);
    if (!Number.isFinite(tableIndex)) continue;

    for (const item of expenses) {
      if (!item.isRecurring || typeof item.recurringGroupId !== 'number') continue;
      const existing = templates.get(item.recurringGroupId);
      if (!existing || tableIndex < existing.startMonth) {
        templates.set(item.recurringGroupId, { startMonth: tableIndex, item });
      }
    }
  }

  for (const [groupId, template] of templates) {
    for (let tableIndex = template.startMonth; tableIndex <= totalTables; tableIndex += 1) {
      const monthKey = String(tableIndex);
      const currentExpenses = expanded[monthKey] ?? [];
      const alreadyExists = currentExpenses.some((item) => item.recurringGroupId === groupId);
      if (alreadyExists) continue;

      expanded[monthKey] = [
        ...currentExpenses,
        {
          id: groupId * 1000 + tableIndex,
          detail: template.item.detail,
          amount: template.item.amount,
          status: 'PENDING',
          isRecurring: true,
          recurringGroupId: groupId,
        },
      ];
    }
  }

  return expanded;
}
