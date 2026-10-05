import { Check, PawPrint } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/shared/i18n";
import { Button } from "@/shared/ui";

const TRUST = ["verified", "free", "support"] as const;

export function HomeHero() {
  const t = useTranslations("home");

  return (
    <section className="page-container grid items-center gap-10 py-12 md:grid-cols-[1.35fr_1fr] md:py-16">
      <div className="flex flex-col gap-5">
        <p className="text-xs font-semibold tracking-wider text-ink-muted uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="font-display text-4xl leading-[1.08] font-semibold sm:text-6xl">
          {t("title")}
        </h1>
        <p className="max-w-lg text-lg text-ink-muted">{t("lead")}</p>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/pets">{t("findPet")}</Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href="/feed">{t("readStories")}</Link>
          </Button>
        </div>
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-muted">
          {TRUST.map((key) => (
            <li key={key} className="flex items-center gap-1.5">
              <Check aria-hidden className="size-4 text-success" />
              {t(`trust.${key}`)}
            </li>
          ))}
        </ul>
      </div>

      <Postcard caption={t("postcard")} />
    </section>
  );
}

/** Открытка «Кнопка → домой» — иллюстрация из макета: фото, марка и почтовый штемпель */
function Postcard({ caption }: { caption: string }) {
  return (
    <div aria-hidden className="mx-auto w-full max-w-sm md:max-w-none">
      <div className="rotate-2 rounded-sm border border-line bg-surface-raised p-4 shadow-xl">
        <div className="grid grid-cols-[1.25fr_1fr] gap-4">
          <div className="aspect-[4/5] overflow-hidden bg-surface-sunken">
            {/* Котёнок из демо-фото (knopka.jpg, CC0) — см. api/src/app/seed_assets/CREDITS.md */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/home/kitten.webp"
              alt=""
              width={533}
              height={666}
              fetchPriority="high"
              className="size-full object-cover"
            />
          </div>
          <div className="relative flex flex-col justify-between">
            <div className="ml-auto flex size-20 items-center justify-center border-2 border-dashed border-primary/30 bg-accent p-1">
              <PawPrint className="size-7 text-primary" />
            </div>
            <Postmark className="absolute top-12 right-8 size-24 text-primary" />
            <p className="font-display text-lg leading-tight font-semibold">{caption}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Postmark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" className={className}>
      <circle cx="44" cy="50" r="26" strokeWidth="2" />
      <circle cx="44" cy="50" r="20" strokeWidth="1" />
      <path
        d="M10 40c8-5 16 5 24 0s16-5 24 0 16 5 24 0 12-4 16-2M8 52c8-5 16 5 24 0s16-5 24 0 16 5 24 0 12-4 16-2M10 64c8-5 16 5 24 0s16-5 24 0 16 5 24 0 12-4 16-2"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}
