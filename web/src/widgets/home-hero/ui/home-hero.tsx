import { Check, PawPrint } from "lucide-react";
import { useTranslations } from "next-intl";
import { QuickSearchForm } from "@/features/filter-pets";

const TRUST = ["verified", "free", "support"] as const;

export function HomeHero() {
  const t = useTranslations("home");

  return (
    <section className="page-container grid items-center gap-10 py-12 md:grid-cols-[1.4fr_1fr] md:py-16">
      <div className="flex flex-col gap-5">
        <p className="text-xs font-semibold tracking-wider text-ink-muted uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="font-display text-4xl leading-tight font-semibold sm:text-5xl">
          {t("title")}
        </h1>
        <p className="max-w-xl text-lg text-ink-muted">{t("lead")}</p>
        <div className="max-w-xl">
          <QuickSearchForm />
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

      {/* Открытка «Тоша → домой» — декоративная иллюстрация из макета */}
      <div aria-hidden className="hidden md:block">
        <div className="relative rotate-2 rounded-sm border border-line bg-surface-raised p-4 shadow-lg">
          <div className="grid grid-cols-[1.3fr_1fr] gap-4">
            <div className="flex aspect-[3/4] -rotate-2 items-center justify-center rounded-sm bg-surface-sunken">
              <PawPrint className="size-8 text-surface-raised" />
            </div>
            <div className="flex flex-col justify-between">
              <div className="ml-auto flex size-16 items-center justify-center rounded-sm border-2 border-dashed border-accent bg-accent/60">
                <PawPrint className="size-6 text-primary" />
              </div>
              <p className="font-display text-lg font-semibold">{t("postcard")}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
