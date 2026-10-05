import { defineRouting } from "next-intl/routing";

// Код казахского — kk (ISO 639-1), не kz. В переключателе подписываем «KZ».
export const routing = defineRouting({
  locales: ["ru", "kk"],
  defaultLocale: "ru",
});

export type Locale = (typeof routing.locales)[number];
