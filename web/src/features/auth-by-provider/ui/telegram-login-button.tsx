"use client";

import { Send } from "lucide-react";
import { useTranslations } from "next-intl";
import Script from "next/script";
import { useState } from "react";
import { api, type components } from "@/shared/api";
import { getPathname, type Locale } from "@/shared/i18n";
import { Button, ErrorState } from "@/shared/ui";

type TelegramUser = components["schemas"]["TelegramLoginIn"];

declare global {
  interface Window {
    Telegram?: {
      Login: {
        auth: (
          options: { bot_id: string; request_access?: "write"; lang?: string },
          callback: (user: TelegramUser | false) => void,
        ) => void;
      };
    };
  }
}

const BOT_ID = process.env.NEXT_PUBLIC_TELEGRAM_BOT_ID;

/**
 * Свой стиль кнопки поверх Telegram Login Widget: виджет открывает окно
 * Telegram, данные с подписью отправляем как есть в POST /auth/telegram,
 * бэкенд проверяет hash и ставит cookie.
 */
export function TelegramLoginButton({ next, locale }: { next: string; locale: Locale }) {
  const t = useTranslations("login");
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const login = () => {
    if (!BOT_ID || !window.Telegram) return;
    setFailed(false);
    window.Telegram.Login.auth(
      { bot_id: BOT_ID, request_access: "write", lang: locale },
      async (user) => {
        if (!user) return; // человек закрыл окно Telegram
        setPending(true);
        const { error } = await api.POST("/api/v1/auth/telegram", { body: user });
        if (error) {
          setPending(false);
          setFailed(true);
          return;
        }
        // Полный переход: клиентский роутер мог запомнить редирект на вход
        window.location.assign(getPathname({ href: next, locale }));
      },
    );
  };

  return (
    <div className="flex flex-col gap-2">
      {BOT_ID && (
        <Script
          src="https://telegram.org/js/telegram-widget.js?22"
          strategy="lazyOnload"
          onReady={() => setReady(true)}
        />
      )}
      <Button
        variant="secondary"
        size="lg"
        className="w-full"
        disabled={!BOT_ID || !ready}
        loading={pending}
        aria-describedby={BOT_ID ? undefined : "telegram-unavailable"}
        onClick={login}
      >
        <Send aria-hidden className="size-5" />
        {t("telegram")}
      </Button>
      {!BOT_ID && (
        <p id="telegram-unavailable" className="text-sm text-ink-muted">
          {t("telegramUnavailable")}
        </p>
      )}
      {failed && <ErrorState title={t("telegramFailed")} />}
    </div>
  );
}
