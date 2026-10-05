import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/shared/i18n/request.ts");

const nextConfig: NextConfig = {
  // Для Docker-образа (web/Dockerfile): только server.js и нужные зависимости
  output: "standalone",
  // Шрифты карточек превью (opengraph-image.tsx) читаются с диска — в standalone их надо
  // явно взять с собой: трассировка видит только импорты
  outputFileTracingIncludes: { "/**/*": ["src/shared/og/fonts/*.ttf"] },
  // Браузер ходит в FastAPI через свой домен: httpOnly-cookie сессии остаётся
  // первой стороной, CORS не нужен. Адрес нужен уже на этапе сборки.
  async rewrites() {
    if (!process.env.API_URL) return [];
    return [{ source: "/api/v1/:path*", destination: `${process.env.API_URL}/api/v1/:path*` }];
  },
};

export default withNextIntl(nextConfig);
