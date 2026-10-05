import "server-only";
import { ImageResponse } from "next/og";
import type { ReactElement } from "react";
import { OG_SIZE } from "./card";
import { OG_FONTS } from "./fonts";

/** PNG 1200×630 со шрифтами сайта. Мессенджеры кэшируют превью сами — час нам достаточно. */
export function renderOg(element: ReactElement) {
  return new ImageResponse(element, {
    ...OG_SIZE,
    fonts: OG_FONTS,
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" },
  });
}
