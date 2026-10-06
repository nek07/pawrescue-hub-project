import type { components } from "@/shared/api";

type Schemas = components["schemas"];

export type ModPost = Schemas["ModPostOut"];
export type ModComment = Schemas["ModCommentOut"];
export type ModUser = Schemas["ModUserOut"];
export type Liker = Schemas["LikerOut"];
export type ModerationStats = Schemas["ModerationStats"];
export type Visibility = Schemas["Visibility"];

export const VISIBILITIES: Visibility[] = ["all", "visible", "hidden"];
export const MOD_PAGE_SIZE = 20;

/** Что лайкают: пост или комментарий */
export type LikeTarget = "post" | "comment";
