import type { components } from "@/shared/api";

type Schemas = components["schemas"];

export type ModPost = Schemas["ModPostOut"];
export type ModComment = Schemas["ModCommentOut"];
export type ModUser = Schemas["ModUserOut"];
export type Liker = Schemas["LikerOut"];
export type ModerationStats = Schemas["ModerationStats"];
export type Visibility = Schemas["Visibility"];
export type ModOnboarding = Schemas["OnboardingOut"];
export type OnboardingStatus = Schemas["OnboardingStatus"];

export const VISIBILITIES: Visibility[] = ["all", "visible", "hidden"];
export const MOD_PAGE_SIZE = 20;

/** Черновики модератору не показываем — только отправленные и решённые */
export const REVIEW_STATUSES = [
  "submitted",
  "approved",
  "rejected",
] as const satisfies readonly OnboardingStatus[];
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/** Что лайкают: пост или комментарий */
export type LikeTarget = "post" | "comment";
