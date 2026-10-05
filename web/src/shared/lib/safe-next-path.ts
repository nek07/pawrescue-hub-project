/**
 * Путь для возврата после входа. Только относительный путь внутри сайта —
 * иначе `?next=https://evil.example` превращается в открытый редирект.
 */
export function safeNextPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}
