import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/shared/lib";

const badgeVariants = cva("inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-semibold", {
  variants: {
    tone: {
      accent: "bg-accent text-on-accent",
      success: "bg-success-surface text-success",
      inverse: "bg-surface-inverse text-on-inverse",
      neutral: "border border-line bg-surface-raised text-ink-muted",
    },
  },
  defaultVariants: { tone: "accent" },
});

/** Нейтральная плашка. Статусы питомца подбирают тон в entities/pet (StatusBadge). */
export function Badge({
  tone,
  className,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
