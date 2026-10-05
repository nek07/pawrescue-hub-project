import type { ReactNode } from "react";
import { fontStack } from "./fonts";

/** Размер превью для Telegram, WhatsApp, VK и соцсетей (соотношение 1.91:1) */
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

// Цвета — из дизайн-системы (shared/styles/tokens.css); CSS-переменные Satori не понимает
export const OG = {
  surface: "#faf7f2",
  raised: "#ffffff",
  sunken: "#e5ddd1",
  ink: "#161616",
  muted: "#5e5a55",
  line: "#e3ddd3",
  primary: "#c03a29",
  accent: "#f3e1c7",
  onAccent: "#3a2410",
  success: "#2c6a44",
  successSurface: "#e4efe6",
};

export const SERIF = fontStack("Literata");
export const SANS = fontStack("IBM Plex Sans");

function PawIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.2}
    >
      <circle cx="11" cy="4" r="2" />
      <circle cx="18" cy="8" r="2" />
      <circle cx="20" cy="16" r="2" />
      <path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z" />
    </svg>
  );
}

/** Рамка карточки: фон сайта, полоса бренда снизу и логотип */
export function OgFrame({ siteName, children }: { siteName: string; children: ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: OG.surface,
        fontFamily: SANS,
        color: OG.ink,
      }}
    >
      <div style={{ display: "flex", flex: 1, padding: "56px 64px 36px" }}>{children}</div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 64px",
          height: 72,
          background: OG.primary,
          color: "#ffffff",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontFamily: SERIF,
            fontSize: 34,
            fontWeight: 600,
          }}
        >
          <PawIcon size={34} color="#ffffff" />
          {siteName}
        </div>
      </div>
    </div>
  );
}

/** Подпись-«бейдж» как на сайте: «Ищет дом», «Проверен» */
export function OgBadge({
  children,
  tone = "accent",
}: {
  children: ReactNode;
  tone?: "accent" | "success";
}) {
  return (
    <div
      style={{
        display: "flex",
        alignSelf: "flex-start",
        flexShrink: 0,
        whiteSpace: "nowrap",
        padding: "8px 18px",
        borderRadius: 999,
        fontSize: 26,
        fontWeight: 600,
        background: tone === "success" ? OG.successSurface : OG.accent,
        color: tone === "success" ? OG.success : OG.onAccent,
      }}
    >
      {children}
    </div>
  );
}

/** Фото слева (или мозаика), текст справа */
export function OgSplit({ photos, children }: { photos: (string | null)[]; children: ReactNode }) {
  const shown = photos.filter((p): p is string => Boolean(p));
  return (
    <div style={{ display: "flex", flex: 1, gap: 48 }}>
      {shown.length > 0 && (
        <div style={{ display: "flex", gap: 12, width: 440, flexShrink: 0 }}>
          {shown.length === 1 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shown[0]}
              width={440}
              height={466}
              style={{ borderRadius: 24, objectFit: "cover" }}
              alt=""
            />
          ) : (
            <Mosaic photos={shown.slice(0, 3)} />
          )}
        </div>
      )}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          flex: 1,
          gap: 20,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Mosaic({ photos }: { photos: string[] }) {
  const [first, ...rest] = photos;
  return (
    <div style={{ display: "flex", gap: 12 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={first}
        width={rest.length ? 284 : 440}
        height={466}
        style={{ borderRadius: 24, objectFit: "cover" }}
        alt=""
      />
      {rest.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {rest.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src.slice(-32)}
              src={src}
              width={144}
              height={227}
              style={{ borderRadius: 18, objectFit: "cover" }}
              alt=""
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Заголовок и текст карточки: обрезаем, чтобы длинное не вылезало за рамку */
export function OgText({
  eyebrow,
  title,
  text,
}: {
  eyebrow?: string;
  title: string;
  text?: string | null;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {eyebrow && (
        <div
          style={{
            display: "flex",
            fontSize: 26,
            fontWeight: 600,
            color: OG.muted,
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          {eyebrow}
        </div>
      )}
      <div
        style={{
          display: "flex",
          fontFamily: SERIF,
          fontSize: title.length > 28 ? 58 : 76,
          fontWeight: 600,
          lineHeight: 1.08,
        }}
      >
        {clip(title, 60)}
      </div>
      {text && (
        <div style={{ display: "flex", fontSize: 30, lineHeight: 1.35, color: OG.muted }}>
          {clip(text, 150)}
        </div>
      )}
    </div>
  );
}

export function clip(value: string, max: number) {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
