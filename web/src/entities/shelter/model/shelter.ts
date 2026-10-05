import type { components } from "@/shared/api";

type Schemas = components["schemas"];

/** Участник платформы: приют или проверенный волонтёр */
export type ShelterListItem = Schemas["CuratorCardOut"];
export type ShelterDetails = Schemas["ShelterProfileOut"];
export type ShelterKind = Schemas["CuratorType"];

export const SHELTER_KINDS = ["shelter", "volunteer"] as const satisfies readonly ShelterKind[];
