import type { ReactNode } from "react";
import { cn } from "@/shared/lib";

type SectionHeaderProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  /** Ссылка справа: «Все питомцы →» */
  action?: ReactNode;
  /** Уровень заголовка: h1 на страницах каталога, h2 в секциях главной */
  as?: "h1" | "h2";
  className?: string;
  children?: ReactNode;
};

export function SectionHeader({
  eyebrow,
  title,
  action,
  as: Heading = "h2",
  className,
  children,
}: SectionHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-2", className)}>
      <div className="flex max-w-3xl flex-col gap-2">
        {eyebrow && (
          <p className="text-xs font-semibold tracking-wider text-ink-muted uppercase">{eyebrow}</p>
        )}
        <Heading
          className={cn(
            "font-display leading-tight font-semibold",
            Heading === "h1" ? "text-3xl sm:text-5xl" : "text-3xl sm:text-4xl",
          )}
        >
          {title}
        </Heading>
        {children}
      </div>
      {action}
    </div>
  );
}
