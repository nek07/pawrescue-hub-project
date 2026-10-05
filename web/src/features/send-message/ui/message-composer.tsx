"use client";

import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { Button, Textarea } from "@/shared/ui";

type MessageComposerProps = {
  /** Отправка — снаружи: окно чата показывает сообщение сразу и знает о сбое */
  onSend: (text: string) => void;
  /** Сообщить собеседнику «печатает…» — не чаще раза в несколько секунд */
  onTyping?: () => void;
  error?: string;
};

export function MessageComposer({ onSend, onTyping, error }: MessageComposerProps) {
  const t = useTranslations("chat");
  const id = useId();
  const [text, setText] = useState("");
  const lastTyping = useRef(0);

  const send = () => {
    const value = text.trim();
    if (!value) return;
    onSend(value);
    setText("");
  };

  return (
    <form
      method="post"
      className="flex flex-col gap-1.5 border-t border-line p-3"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <div className="flex items-end gap-2">
        <label htmlFor={id} className="sr-only">
          {t("messageLabel")}
        </label>
        <Textarea
          id={id}
          rows={1}
          value={text}
          maxLength={4000}
          placeholder={t("placeholder")}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => {
            setText(event.target.value);
            if (onTyping && Date.now() - lastTyping.current > 3000) {
              lastTyping.current = Date.now();
              onTyping();
            }
          }}
          onKeyDown={(event) => {
            // Enter — отправить, Shift+Enter — новая строка
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              send();
            }
          }}
          className="max-h-40 min-h-11 resize-none rounded-[22px] bg-surface py-2.5"
        />
        <Button
          type="submit"
          size="icon"
          className="size-11"
          disabled={!text.trim()}
          aria-label={t("send")}
        >
          <ArrowRight aria-hidden className="size-5" />
        </Button>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger">
          {t(`errors.${error as "server_unavailable"}`)}
        </p>
      )}
    </form>
  );
}
