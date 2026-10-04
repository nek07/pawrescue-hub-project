"use client";

import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/shared/lib";
import { useFieldControl } from "./field";

const controlClasses =
  "w-full rounded-sm border border-line bg-surface-raised px-3 text-base text-ink placeholder:text-ink-muted transition-colors hover:border-ink-muted aria-invalid:border-danger aria-invalid:ring-1 aria-invalid:ring-danger disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-muted";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      {...useFieldControl()}
      className={cn(controlClasses, "min-h-11", className)}
      {...props}
    />
  );
}

export function Textarea({ className, rows = 4, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      {...useFieldControl()}
      rows={rows}
      className={cn(controlClasses, "py-2.5", className)}
      {...props}
    />
  );
}

/** Нативный select: доступен с клавиатуры и удобен на телефоне без дополнительного кода. */
export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        {...useFieldControl()}
        className={cn(controlClasses, "min-h-11 appearance-none pr-9", className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-muted"
      />
    </div>
  );
}
