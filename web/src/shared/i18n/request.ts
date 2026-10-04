import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import ru from "../../../messages/ru.json";
import { mergeMessages } from "./merge-messages";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  if (locale === routing.defaultLocale) {
    return { locale, messages: ru };
  }

  const translation = (await import(`../../../messages/${locale}.json`)).default;
  const { messages, missing } = mergeMessages(ru, translation);

  if (process.env.NODE_ENV === "development" && missing.length > 0) {
    console.warn(
      `[i18n] ${locale}: нет перевода, показываем русский текст — ${missing.join(", ")}`,
    );
  }

  return { locale, messages };
});
