import { HomeExpense } from '@/lib/budgetState';
import map from 'lodash/map';

export function expandRecurringHomeExpenses(
  expensesByMonth: Record<string, HomeExpense[]>,
  totalTables: number,
): Record<string, HomeExpense[]> {
  const expanded = Object.fromEntries(
    map(Object.entries(expensesByMonth), ([monthKey, expenses]) => [monthKey, [...expenses]]),
  );
  const templates = new Map<number, { startMonth: number; latestMonth: number; item: HomeExpense }>();

  for (const [monthKey, expenses] of Object.entries(expanded)) {
    const tableIndex = Number(monthKey);
    if (!Number.isFinite(tableIndex)) continue;

    for (const item of expenses) {
      if (!item.isRecurring || typeof item.recurringGroupId !== 'number') continue;
      const existing = templates.get(item.recurringGroupId);
      if (!existing) {
        templates.set(item.recurringGroupId, { startMonth: tableIndex, latestMonth: tableIndex, item });
        continue;
      }
      // The loop below still fills gaps starting from the earliest occurrence, but the
      // detail/amount used to fill those gaps comes from the most recent occurrence so
      // that an edit made "from this month onward" is honored once the table grows past
      // the months that already exist in storage.
      templates.set(item.recurringGroupId, {
        startMonth: Math.min(existing.startMonth, tableIndex),
        latestMonth: Math.max(existing.latestMonth, tableIndex),
        item: tableIndex >= existing.latestMonth ? item : existing.item,
      });
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
          ...(template.item.cardType ? { cardType: template.item.cardType } : {}),
          status: 'PENDING',
          isRecurring: true,
          recurringGroupId: groupId,
        },
      ];
    }
  }

  return expanded;
}
