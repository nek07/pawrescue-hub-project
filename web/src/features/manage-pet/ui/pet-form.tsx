"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useId, useState, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { Curating } from "@/entities/user";
import { PET_CHIPS, PET_KINDS, PET_SEXES, PET_TRAITS } from "@/entities/pet";
import { CITIES, HAS_CITY_CHOICE } from "@/shared/config";
import { cn } from "@/shared/lib";
import { Button, ErrorState, Field, Input, Select, Textarea } from "@/shared/ui";
import { createPet, updatePet } from "../api/save-pet";
import {
  petFormSchema,
  type PetFormData,
  type PetFormField,
  type PetFormInput,
} from "../model/schema";

type PetFormProps =
  | { mode: "create"; curating: Curating; petId?: never; defaults?: never }
  | { mode: "edit"; petId: string; defaults: PetFormInput; curating?: never };

const EMPTY: PetFormInput = {
  shelterId: "",
  name: "",
  kind: undefined as never,
  sex: undefined as never,
  birthDate: "",
  breed: "",
  weightKg: "",
  sterilized: false,
  vaccinatedAt: "",
  chip: "none",
  litterTrained: "",
  traits: [],
  storyTitle: "",
  story: "",
};

/** Анкета питомца: создание черновика и правка в кабинете куратора. */
export function PetForm(props: PetFormProps) {
  const t = useTranslations("petForm");
  const tPet = useTranslations("pet");
  const tCity = useTranslations("cities");
  const [formError, setFormError] = useState<string>();
  const [saved, setSaved] = useState(false);

  // От чьего имени: приюты, где человек сотрудник, и «от себя» для волонтёра
  const owners =
    props.mode === "create"
      ? [
          ...props.curating.shelters.map((s) => ({ value: s.id, label: s.name })),
          ...(props.curating.volunteer ? [{ value: "", label: t("fields.ownerSelf") }] : []),
        ]
      : [];

  const {
    register,
    handleSubmit,
    setError,
    control,
    getValues,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<PetFormInput, unknown, PetFormData>({
    resolver: zodResolver(petFormSchema),
    mode: "onTouched",
    defaultValues:
      props.mode === "edit"
        ? props.defaults
        : {
            ...EMPTY,
            shelterId: owners[0]?.value ?? "",
            city: HAS_CITY_CHOICE ? undefined : CITIES[0],
          },
  });
  // Подписи черт зависят от пола: «ласковая» / «ласковый»
  const sex = useWatch({ control, name: "sex" }) ?? "female";

  const errorText = (code?: string) =>
    code &&
    (t.has(`errors.${code}` as "errors.server_unavailable")
      ? t(`errors.${code}` as "errors.server_unavailable")
      : t("errors.server_unavailable"));

  const onSubmit = handleSubmit(async () => {
    setFormError(undefined);
    setSaved(false);
    // Отправляем исходные строки полей: сервер ещё раз проверит их той же схемой
    const input = getValues();
    const result =
      props.mode === "create" ? await createPet(input) : await updatePet(props.petId, input);
    if (result.ok) {
      setSaved(true);
      reset(input); // форма снова «чистая» — кнопка «Сохранить» гаснет
      return;
    }
    for (const [field, code] of Object.entries(result.fieldErrors ?? {})) {
      setError(field as PetFormField, { message: code }, { shouldFocus: true });
    }
    setFormError(result.formError);
  });

  return (
    <form method="post" onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {owners.length > 1 && (
        <Section legend={t("sections.owner")}>
          <OptionGroup label={t("fields.owner")}>
            {owners.map((owner) => (
              <OptionCard
                key={owner.value}
                type="radio"
                value={owner.value}
                {...register("shelterId")}
              >
                {owner.label}
              </OptionCard>
            ))}
          </OptionGroup>
        </Section>
      )}

      <Section legend={t("sections.main")}>
        <Field label={t("fields.name")} error={errorText(errors.name?.message)}>
          <Input autoComplete="off" maxLength={60} {...register("name")} />
        </Field>
        <OptionGroup label={t("fields.kind")} error={errorText(errors.kind?.message)}>
          {PET_KINDS.map((kind) => (
            <OptionCard key={kind} type="radio" value={kind} {...register("kind")}>
              {tPet("kind", { kind, sex: "male" })} / {tPet("kind", { kind, sex: "female" })}
            </OptionCard>
          ))}
        </OptionGroup>
        <OptionGroup label={t("fields.sex")} error={errorText(errors.sex?.message)}>
          {PET_SEXES.map((value) => (
            <OptionCard key={value} type="radio" value={value} {...register("sex")}>
              {tPet("sex", { sex: value })}
            </OptionCard>
          ))}
        </OptionGroup>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label={t("fields.birthDate")}
            hint={t("fields.birthDateHint")}
            error={errorText(errors.birthDate?.message)}
          >
            <Input type="date" {...register("birthDate")} />
          </Field>
          <Field label={t("fields.breed")} error={errorText(errors.breed?.message)}>
            <Input
              maxLength={80}
              placeholder={t("fields.breedPlaceholder")}
              {...register("breed")}
            />
          </Field>
          <Field label={t("fields.weight")} error={errorText(errors.weightKg?.message)}>
            <Input inputMode="decimal" placeholder="3,8" {...register("weightKg")} />
          </Field>
        </div>
        {HAS_CITY_CHOICE && (
          <Field label={t("fields.city")} error={errorText(errors.city?.message)}>
            <Select {...register("city")}>
              {CITIES.map((city) => (
                <option key={city} value={city}>
                  {tCity(city)}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </Section>

      <Section legend={t("sections.health")}>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" className="size-5 accent-primary" {...register("sterilized")} />
          {t("fields.sterilized")}
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label={t("fields.vaccinatedAt")}
            hint={t("fields.vaccinatedAtHint")}
            error={errorText(errors.vaccinatedAt?.message)}
          >
            <Input type="date" {...register("vaccinatedAt")} />
          </Field>
          <Field label={t("fields.chip")}>
            <Select {...register("chip")}>
              {PET_CHIPS.map((chip) => (
                <option key={chip} value={chip}>
                  {t(`fields.chipOption.${chip}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("fields.litter")}>
            <Select {...register("litterTrained")}>
              <option value="">{t("fields.litterOption.unknown")}</option>
              <option value="yes">{t("fields.litterOption.yes")}</option>
              <option value="no">{t("fields.litterOption.no")}</option>
            </Select>
          </Field>
        </div>
      </Section>

      <Section legend={t("sections.character")}>
        <OptionGroup label={t("fields.traits")} columns="auto">
          {PET_TRAITS.map((trait) => (
            <OptionCard key={trait} type="checkbox" value={trait} {...register("traits")}>
              {tPet(`trait.${trait}`, { sex })}
            </OptionCard>
          ))}
        </OptionGroup>
      </Section>

      <Section legend={t("sections.story")}>
        <Field
          label={t("fields.storyTitle")}
          hint={t("fields.storyTitleHint")}
          error={errorText(errors.storyTitle?.message)}
        >
          <Input maxLength={160} {...register("storyTitle")} />
        </Field>
        <Field
          label={t("fields.story")}
          hint={t("fields.storyHint")}
          error={errorText(errors.story?.message)}
        >
          <Textarea rows={6} maxLength={5000} {...register("story")} />
        </Field>
      </Section>

      {formError && <ErrorState title={errorText(formError)} />}

      <div className="flex flex-wrap items-center gap-4">
        <Button
          type="submit"
          size="lg"
          loading={isSubmitting}
          disabled={props.mode === "edit" && !isDirty}
        >
          {isSubmitting ? t("saving") : props.mode === "create" ? t("create") : t("save")}
        </Button>
        <p role="status" className="text-sm text-success">
          {saved && !isDirty ? t("saved") : null}
        </p>
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
  columns = "fixed",
  children,
}: {
  label: string;
  error?: ReactNode;
  columns?: "fixed" | "auto";
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
      <div
        className={cn(columns === "fixed" ? "grid gap-2 sm:grid-cols-3" : "flex flex-wrap gap-2")}
      >
        {children}
      </div>
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
