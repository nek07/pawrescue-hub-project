"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useId, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { CITIES, type City } from "@/shared/config";
import { Link } from "@/shared/i18n";
import { cn } from "@/shared/lib";
import { Button, ErrorState, Field, Input, Select, Textarea } from "@/shared/ui";
import { submitApplication } from "../api/submit-application";
import {
  applySchema,
  HOUSEHOLD,
  HOUSING,
  type ApplyData,
  type ApplyField,
  type ApplyInput,
} from "../model/schema";

type ApplyFormProps = {
  petId: string;
  defaultName?: string;
  defaultCity?: City;
};

export function ApplyForm({ petId, defaultName = "", defaultCity }: ApplyFormProps) {
  const t = useTranslations("applyForPet");
  const tCity = useTranslations("cities");
  const [formError, setFormError] = useState<string>();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ApplyInput, unknown, ApplyData>({
    resolver: zodResolver(applySchema),
    mode: "onTouched",
    defaultValues: {
      petId,
      name: defaultName,
      phone: "",
      city: defaultCity,
      household: [],
      about: "",
    },
  });

  /** Код ошибки → текст; незнакомый код не показываем сырым */
  const errorText = (code?: string) =>
    code &&
    (t.has(`errors.${code}` as "errors.server_unavailable")
      ? t(`errors.${code}` as "errors.server_unavailable")
      : t("errors.server_unavailable"));

  const onSubmit = handleSubmit(async (data) => {
    setFormError(undefined);
    const result = await submitApplication(data);
    // Успех — это redirect в сообщения, сюда возвращаются только ошибки
    for (const [field, code] of Object.entries(result.fieldErrors ?? {})) {
      setError(field as ApplyField, { message: code }, { shouldFocus: true });
    }
    setFormError(result.formError);
  });

  return (
    // method="post": если нажать «Отправить» до загрузки JS, телефон не уйдёт в URL и логи
    <form method="post" onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <input type="hidden" {...register("petId")} />

      <Section legend={t("sections.about")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("fields.name")} error={errorText(errors.name?.message)}>
            <Input autoComplete="given-name" {...register("name")} />
          </Field>
          <Field
            label={t("fields.phone")}
            hint={t("fields.phoneHint")}
            error={errorText(errors.phone?.message)}
          >
            <Input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder={t("fields.phonePlaceholder")}
              {...register("phone")}
            />
          </Field>
        </div>
        <Field label={t("fields.city")} error={errorText(errors.city?.message)}>
          <Select {...register("city")}>
            <option value="">{t("fields.selectCity")}</option>
            {CITIES.map((city) => (
              <option key={city} value={city}>
                {tCity(city)}
              </option>
            ))}
          </Select>
        </Field>
      </Section>

      <Section legend={t("sections.home")}>
        <OptionGroup label={t("fields.housing")} error={errorText(errors.housing?.message)}>
          {HOUSING.map((value) => (
            <OptionCard key={value} type="radio" value={value} {...register("housing")}>
              {t(`fields.housingOption.${value}`)}
            </OptionCard>
          ))}
        </OptionGroup>
        <OptionGroup label={t("fields.household")}>
          {HOUSEHOLD.map((value) => (
            <OptionCard key={value} type="checkbox" value={value} {...register("household")}>
              {t(`fields.householdOption.${value}`)}
            </OptionCard>
          ))}
        </OptionGroup>
      </Section>

      <Section legend={t("sections.more")}>
        <Field
          label={t("fields.about")}
          hint={t("fields.aboutHint")}
          error={errorText(errors.about?.message)}
        >
          <Textarea rows={4} maxLength={1000} {...register("about")} />
        </Field>
      </Section>

      <div className="flex flex-col gap-1.5">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-5 shrink-0 accent-primary"
            aria-invalid={errors.consent ? true : undefined}
            aria-describedby={errors.consent ? "consent-error" : undefined}
            {...register("consent")}
          />
          <span>
            {t("fields.consent")}{" "}
            <Link href="/rules" className="text-primary underline">
              {t("fields.rules")}
            </Link>
          </span>
        </label>
        {errors.consent && (
          <p id="consent-error" className="ml-8 text-sm text-danger">
            {errorText(errors.consent.message)}
          </p>
        )}
      </div>

      {formError && <ErrorState title={errorText(formError)} />}

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" size="lg" loading={isSubmitting}>
          {isSubmitting ? t("submitting") : t("submit")}
        </Button>
        <Link href={`/pets/${petId}`} className="text-sm text-ink-muted underline">
          {t("cancel")}
        </Link>
      </div>
    </form>
  );
}

function Section({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4 rounded-sm border border-line bg-surface-raised p-5">
      <legend className="px-2 font-semibold">{legend}</legend>
      {children}
    </fieldset>
  );
}

function OptionGroup({
  label,
  error,
  children,
}: {
  label: string;
  error?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div
      role="group"
      aria-labelledby={`${id}-label`}
      aria-describedby={error ? `${id}-error` : undefined}
      className="flex flex-col gap-2"
    >
      <span id={`${id}-label`} className="text-sm font-semibold">
        {label}
      </span>
      <div className="grid gap-2 sm:grid-cols-3">{children}</div>
      {error && (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function OptionCard({
  children,
  className,
  ...props
}: React.ComponentProps<"input"> & { type: "radio" | "checkbox" }) {
  return (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-center gap-3 rounded-sm border border-line bg-surface-raised px-3 py-2 text-sm",
        "has-checked:border-ink has-checked:ring-1 has-checked:ring-ink has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink",
        className,
      )}
    >
      <input className="size-4 shrink-0 accent-primary focus-visible:outline-none" {...props} />
      {children}
    </label>
  );
}
