import { useTranslations } from "next-intl";

const STEPS = ["choose", "apply", "home"] as const;

export function HowItWorks() {
  const t = useTranslations("home.steps");

  return (
    <section id="how-it-works" className="bg-surface-inverse text-on-inverse">
      <div className="page-container py-14 sm:py-16">
        <p className="text-xs font-semibold tracking-wider uppercase opacity-80">{t("eyebrow")}</p>
        <h2 className="mt-2 font-display text-3xl leading-tight font-semibold sm:text-4xl">
          {t("title")}
        </h2>
        <ol className="mt-10 grid gap-8 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step} className="border-t border-on-inverse/20 pt-6">
              <span aria-hidden className="font-display text-4xl text-accent">
                {index + 1}
              </span>
              <h3 className="mt-3 font-semibold">{t(`items.${step}.title`)}</h3>
              <p className="mt-2 text-sm opacity-80">{t(`items.${step}.text`)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
