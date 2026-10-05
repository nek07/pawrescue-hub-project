import type { components } from "@/shared/api";

type Schemas = components["schemas"];

export type Conversation = Schemas["ConversationOut"];
export type ConversationPage = Schemas["Page_ConversationOut_"];
export type ChatMessage = Schemas["MessageOut"];
export type MessagePage = Schemas["Page_MessageOut_"];
export type ChatSide = Schemas["ChatSide"];

/** События WebSocket /api/v1/ws — только доставка, данные берём из REST */
export type ChatEvent =
  | { type: "message.new"; message: ChatMessage }
  | { type: "message.read"; conversation_id: string; side: ChatSide }
  | { type: "typing"; conversation_id: string; side: ChatSide }
  | { type: "pong" }
  | { type: "error"; code: string };

/** Ключи запросов TanStack Query — одни и те же для списка, ленты сообщений и сокета */
export const chatKeys = {
  conversations: ["conversations"] as const,
  messages: (id: string) => ["conversations", id, "messages"] as const,
  unread: ["conversations", "unread"] as const,
};
