import type { components } from "@/shared/api";

export type City = components["schemas"]["City"];

/**
 * Города, где работает платформа. Сейчас только Астана; бэкенд знает больше
 * (City), подписи остальных остаются в messages: cities.<slug> — для старых данных.
 */
export const CITIES = ["astana"] as const satisfies readonly City[];

/** Выбор города показываем, только когда городов больше одного */
export const HAS_CITY_CHOICE = (CITIES as readonly City[]).length > 1;
