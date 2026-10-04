type Messages = { [key: string]: string | Messages };

/**
 * Накладывает перевод на базовые (русские) сообщения. Ключи, которых нет
 * в переводе, остаются русскими и возвращаются в `missing`.
 */
export function mergeMessages(
  base: Messages,
  override: Messages,
  path = "",
  missing: string[] = [],
): { messages: Messages; missing: string[] } {
  const messages: Messages = {};

  for (const [key, baseValue] of Object.entries(base)) {
    const fullKey = path ? `${path}.${key}` : key;
    const value = override[key];

    if (typeof baseValue === "string") {
      if (typeof value === "string") {
        messages[key] = value;
      } else {
        messages[key] = baseValue;
        missing.push(fullKey);
      }
    } else {
      const nested = typeof value === "object" ? value : {};
      messages[key] = mergeMessages(baseValue, nested, fullKey, missing).messages;
    }
  }

  return { messages, missing };
}
