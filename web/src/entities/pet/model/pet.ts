import type { components } from "@/shared/api";

type Schemas = components["schemas"];

export type Pet = Schemas["PetCardOut"];
export type PetDetails = Schemas["PetDetailOut"];
export type PetPage = Schemas["Page_PetCardOut_"];
export type PetKind = Schemas["PetKind"];
export type PetSex = Schemas["PetSex"];
export type PetTrait = Schemas["PetTrait"];
export type PetAge = Schemas["AgeBucket"];
export type PetSort = Schemas["PetSort"];
export type PetChip = Schemas["ChipStatus"];
export type Curator = Schemas["CuratorOut"];

export const PET_KINDS = ["cat", "dog"] as const satisfies readonly PetKind[];
export const PET_AGES = ["lt1", "1to5", "gt5"] as const satisfies readonly PetAge[];
export const PET_SORTS = ["new", "old"] as const satisfies readonly PetSort[];
export const PET_SEXES = ["female", "male"] as const satisfies readonly PetSex[];
export const PET_CHIPS = ["none", "planned", "done"] as const satisfies readonly PetChip[];
/** Черты характера в порядке чипов формы; подписи — pet.trait.<trait> */
export const PET_TRAITS = [
  "affectionate",
  "calm",
  "playful",
  "quiet",
  "good_with_kids",
  "loves_people",
  "well_mannered",
  "apartment_ok",
  "no_dogs",
  "no_cats",
  "after_treatment",
] as const satisfies readonly PetTrait[];

/** История приходит одним текстом, абзацы разделены пустой строкой */
export function storyParagraphs(story: string | null): string[] {
  return (story ?? "")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}
