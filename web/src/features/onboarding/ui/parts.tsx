"use client";

import { useTranslations } from "next-intl";
import { useId, type ReactNode } from "react";
import { cn } from "@/shared/lib";

/** Код ошибки → текст; незнакомый код не показываем сырым */
export function useErrorText() {
  const t = useTranslations("onboarding.errors");
  return (code?: string) =>
    code &&
    (t.has(code as "server_unavailable")
      ? t(code as "server_unavailable")
      : t("server_unavailable"));
}

export function Section({
  legend,
  hint,
  children,
}: {
  legend: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-4 rounded-sm border border-line bg-surface-raised p-5">
      <legend className="px-2 font-semibold">{legend}</legend>
      {hint && <p className="-mt-2 text-sm text-ink-muted">{hint}</p>}
      {children}
    </fieldset>
  );
}

export function OptionGroup({
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
      role="radiogroup"
      aria-labelledby={`${id}-label`}
      aria-describedby={error ? `${id}-error` : undefined}
      className="flex flex-col gap-2"
    >
      <span id={`${id}-label`} className="text-sm font-semibold">
        {label}
      </span>
      <div className="grid gap-2 sm:grid-cols-2">{children}</div>
      {error && (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function OptionCard({
  title,
  description,
  className,
  ...props
}: React.ComponentProps<"input"> & { title: string; description: string }) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-sm border border-line bg-surface-raised p-4 text-sm",
        "has-checked:border-ink has-checked:ring-1 has-checked:ring-ink has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink",
        "has-disabled:cursor-not-allowed has-disabled:opacity-60",
        className,
      )}
    >
      <input
        type="radio"
        className="mt-0.5 size-4 shrink-0 accent-primary focus-visible:outline-none"
        {...props}
      />
      <span className="flex flex-col gap-1">
        <span className="font-semibold">{title}</span>
        <span className="text-ink-muted">{description}</span>
      </span>
    </label>
  );
}
