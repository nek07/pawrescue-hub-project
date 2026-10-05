"use client";

import { useFormatter, useTranslations } from "next-intl";
import { cn } from "@/shared/lib";
import type { ChatMessage, ChatSide } from "../model/conversation";

/** Своё — справа красным, чужое — слева белым, от платформы — по центру, как в макете */
export function MessageBubble({
  message,
  mySide,
  pending = false,
}: {
  message: ChatMessage;
  mySide: ChatSide;
  /** Отправляется: подпись «Отправляется…» вместо времени. Без прозрачности — она ломает контраст */
  pending?: boolean;
}) {
  const t = useTranslations("chat");
  const format = useFormatter();
  const time = format.dateTime(new Date(message.created_at), {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (message.kind === "system") {
    return (
      <li className="mx-auto max-w-md rounded-sm bg-accent px-4 py-2 text-center text-sm text-on-accent">
        {t(`system.${message.text}` as "system.application.sent")}
      </li>
    );
  }

  const mine = message.side === mySide;
  return (
    <li
      className={cn(
        "flex max-w-[80%] flex-col gap-1",
        mine ? "items-end self-end" : "items-start self-start",
      )}
    >
      <p
        className={cn(
          "rounded-[20px] px-4 py-2.5 whitespace-pre-line",
          mine ? "bg-primary text-on-primary" : "border border-line bg-surface-raised",
        )}
      >
        <span className="sr-only">{mine ? t("you") : t("them")}: </span>
        {message.text}
      </p>
      <span className="text-xs text-ink-muted">{pending ? t("sending") : time}</span>
    </li>
  );
}
