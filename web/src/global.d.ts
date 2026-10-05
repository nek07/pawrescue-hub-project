import type ru from "../messages/ru.json";
import type { Locale } from "@/shared/i18n";

// Ключи переводов проверяются TypeScript: опечатка в t("...") — ошибка сборки
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof ru;
  }
}
