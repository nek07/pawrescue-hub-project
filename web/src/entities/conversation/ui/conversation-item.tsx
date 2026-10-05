"use client";

import { useFormatter, useNow, useTranslations } from "next-intl";
import { Link } from "@/shared/i18n";
import { cn } from "@/shared/lib";
import { Avatar } from "@/shared/ui";
import type { Conversation } from "../model/conversation";

/** Строка списка бесед: собеседник, о ком речь, последнее сообщение, непрочитанные */
export function ConversationItem({
  conversation,
  active,
}: {
  conversation: Conversation;
  active: boolean;
}) {
  const t = useTranslations("chat");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const { counterpart, last_message: last, pet } = conversation;
  const name = counterpart.type === "shelter" ? `«${counterpart.name}»` : counterpart.name;
  const preview = last
    ? last.kind === "system"
      ? t(`system.${last.text}` as "system.application.sent")
      : last.text
    : t("noMessages");
  const at = new Date(conversation.last_message_at);
  const sameDay = at.toDateString() === now.toDateString();

  return (
    <Link
      href={`/messages/${conversation.id}`}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-sm p-3 transition-colors hover:bg-surface",
        active && "bg-surface",
      )}
    >
      <Avatar
        name={counterpart.type === "shelter" ? "" : counterpart.name}
        src={counterpart.avatar_url}
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate font-semibold">{name}</span>
          <span className="shrink-0 text-xs text-ink-muted">
            {format.dateTime(
              at,
              sameDay ? { hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short" },
            )}
          </span>
        </span>
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-sm text-ink-muted">
            {pet ? `${t("about", { name: pet.name })} · ` : ""}
            {preview}
          </span>
          {conversation.unread_count > 0 && (
            <span
              className="flex min-w-5 shrink-0 items-center justify-center rounded-pill bg-primary px-1.5 text-xs font-semibold text-on-primary"
              aria-label={t("unread", { count: conversation.unread_count })}
            >
              {conversation.unread_count}
            </span>
          )}
        </span>
      </span>
    </Link>
  );
}
