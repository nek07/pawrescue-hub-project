import { Check } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/shared/lib";

type ChipProps = Omit<ComponentProps<"button">, "aria-pressed"> & { pressed?: boolean };

/** Переключатель фильтра. Текст переносится: казахские подписи длиннее русских. */
export function Chip({
  pressed = false,
  className,
  children,
  type = "button",
  ...props
}: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={pressed}
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-pill border px-4 py-1.5 text-sm transition-colors",
        pressed
          ? "border-ink bg-ink text-surface"
          : "border-line bg-surface-raised text-ink hover:border-ink",
        className,
      )}
      {...props}
    >
      {pressed && <Check aria-hidden className="size-3.5" />}
      {children}
    </button>
  );
}
