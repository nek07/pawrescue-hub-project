"use client";

import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import {
  chatKeys,
  fetchMessages,
  MessageBubble,
  type ChatMessage,
  type Conversation,
  type MessagePage,
} from "@/entities/conversation";
import { markRead, MessageComposer, sendMessage } from "@/features/send-message";
import { Link } from "@/shared/i18n";
import { Avatar, Button } from "@/shared/ui";
import { useChatSocket } from "../model/chat-socket";

const POLL_MS = 4_000;
type Pending = ChatMessage & { failed?: boolean };

export function ChatThread({
  conversation,
  initialMessages,
}: {
  conversation: Conversation;
  initialMessages: MessagePage;
}) {
  const t = useTranslations("chat");
  const queryClient = useQueryClient();
  const { connected, sendTyping, isTyping } = useChatSocket();
  const [pending, setPending] = useState<Pending[]>([]);
  const [error, setError] = useState<string>();
  const bottom = useRef<HTMLLIElement>(null);
  const key = chatKeys.messages(conversation.id);

  const messages = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => fetchMessages(conversation.id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    initialData: { pages: [initialMessages], pageParams: [undefined] },
    refetchInterval: connected ? false : POLL_MS,
  });

  // Страницы приходят от новых к старым — показываем по времени
  const items = messages.data.pages.flatMap((page) => page.items).toReversed();
  const newestId = items.at(-1)?.id;

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [newestId, pending.length]);

  // Открыли диалог или пришло новое — отмечаем прочитанным (и обновляем бейдж в шапке)
  useEffect(() => {
    if (newestId) markRead(conversation.id);
  }, [conversation.id, newestId]);

  const deliver = async (draft: Pending) => {
    setError(undefined);
    const result = await sendMessage(conversation.id, draft.text);
    if (!result.ok) {
      setError(result.error);
      setPending((list) => list.map((p) => (p.id === draft.id ? { ...p, failed: true } : p)));
      return;
    }
    setPending((list) => list.filter((p) => p.id !== draft.id));
    queryClient.setQueryData<InfiniteData<MessagePage>>(key, (data) => {
      if (!data || data.pages.some((p) => p.items.some((m) => m.id === result.message.id)))
        return data;
      const [first, ...rest] = data.pages;
      return { ...data, pages: [{ ...first, items: [result.message, ...first.items] }, ...rest] };
    });
    queryClient.invalidateQueries({ queryKey: chatKeys.conversations, exact: true });
  };

  const send = (text: string) => {
    const draft: Pending = {
      id: `pending-${Date.now()}`,
      conversation_id: conversation.id,
      kind: "text",
      side: conversation.my_side,
      sender_id: null,
      text,
      created_at: new Date().toISOString(),
    };
    setPending((list) => [...list, draft]);
    deliver(draft);
  };

  const { counterpart } = conversation;
  const name = counterpart.type === "shelter" ? `«${counterpart.name}»` : counterpart.name;

  return (
    <section
      aria-label={name}
      className="flex min-h-[60vh] flex-col rounded-sm border border-line bg-surface-raised lg:h-[calc(100vh-10rem)]"
    >
      <header className="flex items-center gap-3 border-b border-line p-3">
        <Link href="/messages" className="rounded-full p-1 lg:hidden" aria-label={t("back")}>
          <ChevronLeft aria-hidden className="size-5" />
        </Link>
        <Avatar
          name={counterpart.type === "shelter" ? "" : counterpart.name}
          src={counterpart.avatar_url}
        />
        <div className="min-w-0">
          <p className="truncate font-semibold">{name}</p>
          <p className="text-xs text-ink-muted" aria-live="polite">
            {isTyping(conversation.id) ? t("typing") : t(`counterpart.${counterpart.type}`)}
          </p>
        </div>
        {conversation.pet && (
          <Link
            href={`/pets/${conversation.pet.id}`}
            className="ml-auto text-sm font-semibold text-primary hover:underline"
          >
            {t("openPet")}
          </Link>
        )}
      </header>

      {!connected && (
        <p className="border-b border-line bg-surface px-3 py-1.5 text-xs text-ink-muted">
          {t("offline")}
        </p>
      )}

      <ol aria-live="polite" className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {messages.hasNextPage && (
          <li className="self-center">
            <Button
              size="sm"
              variant="ghost"
              loading={messages.isFetchingNextPage}
              onClick={() => messages.fetchNextPage()}
            >
              {t("earlier")}
            </Button>
          </li>
        )}
        {items.length === 0 && pending.length === 0 && (
          <li className="m-auto text-sm text-ink-muted">{t("emptyThread")}</li>
        )}
        {items.map((message) => (
          <MessageBubble key={message.id} message={message} mySide={conversation.my_side} />
        ))}
        {pending.map((draft) => (
          <MessageBubble
            key={draft.id}
            message={draft}
            mySide={conversation.my_side}
            pending={!draft.failed}
          />
        ))}
        <li ref={bottom} aria-hidden />
      </ol>

      {pending.some((p) => p.failed) && (
        <div className="flex justify-end gap-2 px-4 pb-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              pending.filter((p) => p.failed).forEach((p) => deliver({ ...p, failed: false }))
            }
          >
            {t("retry")}
          </Button>
        </div>
      )}
      <MessageComposer onSend={send} onTyping={() => sendTyping(conversation.id)} error={error} />
    </section>
  );
}
