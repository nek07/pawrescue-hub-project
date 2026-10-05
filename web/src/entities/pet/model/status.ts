import type { components } from "@/shared/api";

export type PetStatus = components["schemas"]["PetStatus"];

/**
 * Все статусы питомца — одним списком, как PetStatus на бэкенде.
 * Подписи: pet.status.<status>; тон плашки — здесь же, чтобы «Ищет дом»
 * выглядел одинаково везде. draft в каталог не попадает.
 */
export const PET_STATUSES = {
  draft: { tone: "neutral" },
  seeking: { tone: "accent" },
  needs_foster: { tone: "accent" },
  treatment: { tone: "accent" },
  reserved: { tone: "neutral" },
  adopted: { tone: "success" },
} as const satisfies Record<PetStatus, { tone: "accent" | "neutral" | "success" }>;

/** Заявки принимаем, пока питомец ищет дом или передержку — как в ApplicationService */
export function isOpenForApplications(status: PetStatus) {
  return status === "seeking" || status === "needs_foster";
}
