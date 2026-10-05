import { ArrowRight, BadgeCheck, PawPrint } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { HAS_CITY_CHOICE } from "@/shared/config";
import { Link } from "@/shared/i18n";
import { cn } from "@/shared/lib";
import { Avatar } from "@/shared/ui";
import type { ShelterListItem } from "../model/shelter";
import { ShelterLink } from "./shelter-link";

type ShelterCardProps = {
  shelter: ShelterListItem;
  /** Слот справа от имени: «Подписаться» (только у приютов) */
  action?: ReactNode;
};

/**
 * Карточка участника: мозаика из питомцев, которые сейчас ищут дом, аватар,
 * город и переход к питомцам. Приют — квадратный аватар, волонтёр — круглый.
 * На телефоне мозаика скрыта: карточка становится компактной строкой.
 */
export function ShelterCard({ shelter, action }: ShelterCardProps) {
  const t = useTranslations();
  const isShelter = shelter.type === "shelter";
  const meta = [
    t("shelter.kind", { kind: shelter.type }),
    HAS_CITY_CHOICE && shelter.city && t(`cities.${shelter.city}`),
  ].filter(Boolean);
  const bold = (chunks: ReactNode) => <strong className="text-ink">{chunks}</strong>;

  return (
    <article className="group relative flex w-full flex-col overflow-hidden rounded-md border border-line bg-surface-raised transition-shadow focus-within:shadow-md hover:shadow-md">
      <CoverMosaic covers={shelter.preview_covers} />

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
        <div className="flex items-center gap-3">
          {/* Имя уже в заголовке — аватар скринридеру не озвучиваем */}
          <span aria-hidden className="flex shrink-0">
            <Avatar
              name={shelter.name}
              src={shelter.avatar_url}
              size="lg"
              tone={isShelter ? "accent" : "ink"}
              className={cn(isShelter && "rounded-md")}
            />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h2 className="flex min-w-0 items-center gap-1.5 font-display text-lg leading-snug font-semibold">
              <span className="truncate group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">
                <ShelterLink type={shelter.type} id={shelter.id}>
                  {t("shelter.name", { kind: shelter.type, name: shelter.name })}
                </ShelterLink>
              </span>
              {shelter.verified && (
                <BadgeCheck
                  role="img"
                  aria-label={t("shelter.verified")}
                  className="size-4 shrink-0 text-success"
                />
              )}
            </h2>
            <p className="truncate text-sm text-ink-muted">{meta.join(" · ")}</p>
            <p className="truncate text-sm text-ink-muted">
              {shelter.adopted_count > 0
                ? t.rich("shelters.adoptedStat", { count: shelter.adopted_count, b: bold })
                : t("shelter.since", { year: shelter.on_platform_since })}
            </p>
          </div>
        </div>

        <div className="mt-auto flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line pt-3 text-sm">
          {shelter.seeking_count > 0 ? (
            <PetsLink shelter={shelter}>
              {t("shelter.seeking", { count: shelter.seeking_count })}
            </PetsLink>
          ) : (
            <span className="text-ink-muted">{t("shelter.noneSeeking")}</span>
          )}
          {action && <div className="relative z-10">{action}</div>}
        </div>
      </div>
    </article>
  );
}

/** «8 питомцев ищут дом →». У волонтёра вся карточка и так ведёт в его каталог. */
function PetsLink({ shelter, children }: { shelter: ShelterListItem; children: ReactNode }) {
  const content = (
    <>
      {children}
      <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
    </>
  );
  const className = "flex items-center gap-1 font-semibold text-primary";

  if (shelter.type !== "shelter") return <span className={className}>{content}</span>;
  return (
    <Link
      href={`/pets?shelter_id=${shelter.id}`}
      className={cn(className, "relative z-10 hover:underline")}
    >
      {content}
    </Link>
  );
}

/** 1 фото — во всю ширину, 2 — пополам, 3 — большое слева и два справа. */
function CoverMosaic({ covers }: { covers: string[] }) {
  if (covers.length === 0) {
    return (
      <div
        aria-hidden
        className="hidden aspect-[2/1] items-center justify-center bg-surface-sunken sm:flex"
      >
        <PawPrint className="size-8 text-surface-raised" />
      </div>
    );
  }

  return (
    // Сетка лежит поверх блока с пропорцией: иначе высоту задают сами фото
    <div aria-hidden className="relative hidden aspect-[2/1] sm:block">
      <div
        className={cn(
          "absolute inset-0 grid gap-0.5 bg-surface-raised",
          covers.length === 2 && "grid-cols-2",
          covers.length >= 3 && "grid-cols-3 grid-rows-2",
        )}
      >
        {covers.map((src, i) => (
          <div
            key={src}
            className={cn(
              "overflow-hidden bg-surface-sunken",
              covers.length >= 3 && i === 0 && "col-span-2 row-span-2",
            )}
          >
            {/* Размеры нарезает бэкенд, оптимизация next/image не нужна */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              loading="lazy"
              className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04] motion-reduce:transition-none"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
