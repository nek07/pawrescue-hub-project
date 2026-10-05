import type { components } from "@/shared/api";

export type City = components["schemas"]["City"];

/** Города, где работает платформа. Подписи — в messages: cities.<slug> */
export const CITIES = ["pavlodar", "astana", "almaty"] as const satisfies readonly City[];
