"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";
import type { components } from "@/shared/api";
import { getPathname } from "@/shared/i18n";
import { Button, ErrorState, Field, Input } from "@/shared/ui";
import { devLogin } from "../api/dev-login";

type UserRole = components["schemas"]["UserRole"];

/** Сид-аккаунты бэкенда: dev-login с тем же именем и ролью входит в них */
const PRESETS = [
  { key: "user", name: "Асель", role: "user" },
  { key: "shelterAdmin", name: "Гульнара", role: "user" },
  { key: "moderator", name: "Модератор", role: "moderator" },
] as const satisfies readonly { key: string; name: string; role: UserRole }[];

/**
 * Вход без Google и Telegram — только для разработки и e2e.
 * Бэкенд отдаёт /auth/dev-login вне прода, фронт показывает форму
 * при NEXT_PUBLIC_DEV_LOGIN=1.
 */
export function DevLoginForm({ next }: { next: string }) {
  const t = useTranslations("login.dev");
  const locale = useLocale();
  const [name, setName] = useState("");
  const [pending, setPending] = useState<string>();
  const [failed, setFailed] = useState(false);
  // До гидратации браузер отправил бы форму сам, без запроса к API
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  const login = async (key: string, userName: string, role: UserRole) => {
    setPending(key);
    setFailed(false);
    const { ok } = await devLogin(userName, role);
    if (!ok) {
      setPending(undefined);
      setFailed(true);
      return;
    }
    // Полный переход: клиентский роутер мог запомнить редирект на вход
    window.location.assign(getPathname({ href: next, locale }));
  };

  return (
    <div className="flex flex-col gap-3 rounded-sm border border-dashed border-line p-4">
      <p className="text-sm text-ink-muted">{t("hint")}</p>
      <div className="flex flex-col gap-2">
        {PRESETS.map((preset) => (
          <Button
            key={preset.key}
            variant="secondary"
            size="sm"
            disabled={!hydrated || Boolean(pending)}
            loading={pending === preset.key}
            onClick={() => login(preset.key, preset.name, preset.role)}
          >
            {t(`presets.${preset.key}`)}
          </Button>
        ))}
      </div>
      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          login("custom", name, "user");
        }}
      >
        <Field label={t("name")}>
          <Input value={name} minLength={2} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Button
          type="submit"
          variant="ghost"
          disabled={!hydrated || Boolean(pending) || name.trim().length < 2}
          loading={pending === "custom"}
          className="border border-line"
        >
          {t("submit")}
        </Button>
      </form>
      {failed && <ErrorState title={t("failed")} />}
    </div>
  );
}

const noopSubscribe = () => () => {};
