"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  chatKeys,
  ConversationItem,
  fetchConversations,
  type ConversationPage,
} from "@/entities/conversation";
import { useChatSocket } from "../model/chat-socket";

const POLL_MS = 5_000;

export function ConversationList({
  initial,
  activeId,
}: {
  initial: ConversationPage;
  activeId?: string;
}) {
  const t = useTranslations("chat");
  const { connected } = useChatSocket();
  const { data } = useQuery({
    queryKey: chatKeys.conversations,
    queryFn: fetchConversations,
    initialData: initial,
    // Без сокета новые сообщения узнаём опросом
    refetchInterval: connected ? false : POLL_MS,
  });

  return (
    <nav aria-label={t("listLabel")}>
      <ul className="flex flex-col gap-1">
        {data.items.map((conversation) => (
          <li key={conversation.id}>
            <ConversationItem conversation={conversation} active={conversation.id === activeId} />
          </li>
        ))}
      </ul>
    </nav>
  );
}
