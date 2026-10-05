export type RawSearchParams = Record<string, string | string[] | undefined>;

/** searchParams из Next → по одному значению на ключ (берём первое). */
export function firstValues(params: RawSearchParams): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );
}
