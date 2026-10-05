import type { components } from "@/shared/api";

type Schemas = components["schemas"];

export type Post = Schemas["PostOut"];
export type PostPage = Schemas["Page_PostOut_"];
export type PostComment = Schemas["CommentOut"];
export type CommentPage = Schemas["Page_CommentOut_"];
export type PostKind = Schemas["PostKind"];
export type PostAuthor = Schemas["AuthorOut"];
export type FeedCategory = Schemas["FeedCategory"];

/** Вкладки ленты из макета — в том же порядке */
export const FEED_CATEGORIES = [
  "all",
  "curators",
  "owners",
  "before_after",
  "help",
] as const satisfies readonly FeedCategory[];

export const POSTS_PAGE_SIZE = 10;

/** Плашка поста: «Нужна помощь» тёмная, как в макете */
export const POST_KIND_TONE = {
  story: "success",
  help: "inverse",
  update: "accent",
} as const satisfies Record<PostKind, "success" | "inverse" | "accent">;
