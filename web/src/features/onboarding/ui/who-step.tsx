"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { CITIES, HAS_CITY_CHOICE } from "@/shared/config";
import { Button, ErrorState, Field, Input, Select } from "@/shared/ui";
import { saveWho } from "../api/actions";
import {
  ONBOARDING_TYPES,
  whoSchema,
  type Onboarding,
  type WhoData,
  type WhoInput,
} from "../model/steps";
import { OptionCard, OptionGroup, Section, useErrorText } from "./parts";

type WhoStepProps = {
  /** Черновик, который правим; null — заявку только создаём */
  draft: Onboarding | null;
  /** Отклонённая заявка: подставляем её данные в новую */
  previous: Onboarding | null;
  onSaved: (request: Onboarding) => void;
};

export function WhoStep({ draft, previous, onSaved }: WhoStepProps) {
  const t = useTranslations("onboarding");
  const tCity = useTranslations("cities");
  const errorText = useErrorText();
  const [formError, setFormError] = useState<string>();
  const source = draft ?? previous;

  const {
    register,
    handleSubmit,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<WhoInput, unknown, WhoData>({
    resolver: zodResolver(whoSchema),
    mode: "onTouched",
    defaultValues: {
      type: source?.type,
      name: source?.name ?? "",
      city: CITIES.find((c) => c === source?.city) ?? (HAS_CITY_CHOICE ? undefined : CITIES[0]),
      phone: source?.contact_phone ?? "",
    },
  });

  const onSubmit = handleSubmit(async () => {
    setFormError(undefined);
    const result = await saveWho(getValues(), {
      create: !draft,
      // Тексты отклонённой заявки переносим — документы придётся загрузить заново
      carryOver:
        !draft && previous
          ? {
              recommender: previous.recommender,
              about: previous.about,
              address: previous.address,
              visit_hours: previous.visit_hours,
            }
          : undefined,
    });
    if (result.ok) return onSaved(result.request);
    for (const [field, code] of Object.entries(result.fieldErrors ?? {})) {
      if (field in whoSchema.shape) {
        setError(field as keyof WhoInput, { message: code }, { shouldFocus: true });
      }
    }
    setFormError(result.formError);
  });

  return (
    <form method="post" onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <Section legend={t("who.title")} hint={t("who.lead")}>
        <OptionGroup label={t("who.type")} error={errorText(errors.type?.message)}>
          {ONBOARDING_TYPES.map((type) => (
            <OptionCard
              key={type}
              value={type}
              // Тип задаётся при создании заявки и дальше не меняется
              disabled={Boolean(draft)}
              title={t(`type.${type}`)}
              description={t(`who.typeHint.${type}`)}
              {...register("type")}
            />
          ))}
        </OptionGroup>
        {draft && <p className="-mt-2 text-sm text-ink-muted">{t("who.typeLocked")}</p>}

        <Field
          label={t("who.name")}
          hint={t("who.nameHint")}
          error={errorText(errors.name?.message)}
        >
          <Input autoComplete="organization" maxLength={120} {...register("name")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t("who.phone")}
            hint={t("who.phoneHint")}
            error={errorText(errors.phone?.message)}
          >
            <Input
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              placeholder="+7 701 234 56 78"
              {...register("phone")}
            />
          </Field>
          {HAS_CITY_CHOICE && (
            <Field label={t("who.city")} error={errorText(errors.city?.message)}>
              <Select {...register("city")}>
                {CITIES.map((city) => (
                  <option key={city} value={city}>
                    {tCity(city)}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
      </Section>

      {formError && <ErrorState title={errorText(formError)} />}

      <div>
        <Button type="submit" size="lg" loading={isSubmitting}>
          {isSubmitting ? t("saving") : t("next")}
        </Button>
      </div>
    </form>
  );
}
