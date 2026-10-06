"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "@/shared/lib";
import {
  firstIncompleteStep,
  MISSING_STEP,
  STEPS,
  type Onboarding,
  type Step,
} from "../model/steps";
import { DocumentsStep } from "./documents-step";
import { ProfileStep } from "./profile-step";
import { ReviewStep } from "./review-step";
import { StatusScreen } from "./status-screen";
import { WhoStep } from "./who-step";

type OnboardingWizardProps = {
  /** Последняя заявка человека; null — ещё не подавал */
  initial: Onboarding | null;
};

/**
 * Подключение приюта или волонтёра: «Кто вы → Документы → Профиль → Проверка».
 * Каждый шаг сохраняется сразу — можно уйти и вернуться к черновику позже.
 */
export function OnboardingWizard({ initial }: OnboardingWizardProps) {
  const t = useTranslations("onboarding");
  const [request, setRequest] = useState(initial);
  const [restarting, setRestarting] = useState(false);
  const draft = request?.status === "draft" ? request : null;
  const [step, setStep] = useState<Step>(draft ? firstIncompleteStep(draft.missing) : "who");

  if (request && !draft && !restarting) {
    return (
      <StatusScreen
        request={request}
        onRestart={() => {
          setRestarting(true);
          setStep("who");
        }}
      />
    );
  }

  const go = (next: Step) => {
    setStep(next);
    window.scrollTo({ top: 0 });
  };

  const saved = (next: Step) => (updated: Onboarding) => {
    setRequest(updated);
    setRestarting(false);
    if (updated.status === "draft") go(next);
  };

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label={t("stepsLabel")}>
        <ol className="grid grid-cols-4 gap-2">
          {STEPS.map((s, index) => {
            const current = s === step;
            const incomplete = draft?.missing.some((m) => MISSING_STEP[m] === s);
            const done = Boolean(draft) && s !== "review" && !incomplete && !current;
            return (
              <li key={s}>
                <button
                  type="button"
                  // Пока заявки нет, дальше первого шага не пускаем
                  disabled={!draft}
                  aria-current={current ? "step" : undefined}
                  onClick={() => go(s)}
                  className={cn(
                    "flex w-full flex-col gap-2 text-left text-sm disabled:cursor-not-allowed",
                    current ? "text-ink" : "text-ink-muted",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn("h-1 rounded-full", current || done ? "bg-ink" : "bg-line")}
                  />
                  <span className="flex items-center gap-1">
                    {done ? (
                      <Check aria-hidden className="size-4 shrink-0 text-success" />
                    ) : (
                      <span aria-hidden>{index + 1}.</span>
                    )}
                    <span className={cn("truncate", current && "font-semibold")}>
                      {t(`steps.${s}`)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {(step === "who" || !draft) && (
        <WhoStep
          key={draft?.id ?? "new"}
          draft={draft}
          previous={restarting ? request : null}
          onSaved={saved("documents")}
        />
      )}
      {draft && step === "documents" && (
        <DocumentsStep draft={draft} onUpdate={setRequest} onSaved={saved("profile")} />
      )}
      {draft && step === "profile" && <ProfileStep draft={draft} onSaved={saved("review")} />}
      {draft && step === "review" && (
        <ReviewStep
          key={draft.missing.join()}
          draft={draft}
          onSaved={saved("review")}
          onEdit={go}
        />
      )}
    </div>
  );
}
