function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function normalizeDetail(value: string): string {
  return normalizeWhitespace(value);
}

export function getDetailKey(value: string): string {
  return normalizeDetail(value).toLocaleLowerCase();
}

export function ensureUniqueDetail(
  desiredValue: string,
  existingValues: string[],
  fallbackBase: string,
  excludeValues: string[] = [],
): string {
  const existingKeys = new Set(existingValues.map(getDetailKey));
  excludeValues.forEach((value) => existingKeys.delete(getDetailKey(value)));

  const baseValue = normalizeDetail(desiredValue) || normalizeDetail(fallbackBase) || 'รายการ';
  if (!existingKeys.has(getDetailKey(baseValue))) {
    return baseValue;
  }

  let suffix = 2;
  while (true) {
    const nextValue = `${baseValue} (${suffix})`;
    if (!existingKeys.has(getDetailKey(nextValue))) {
      return nextValue;
    }
    suffix += 1;
  }
}
