import { PawPrint } from "lucide-react";
import { cn } from "@/shared/lib";

/** Название сайта: в шапке, футере и заголовках страниц. */
export const SITE_NAME = "Pana";

/** Логотип: лапка и «Pana». */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-display font-semibold whitespace-nowrap",
        className,
      )}
    >
      <PawPrint aria-hidden className="size-[1em] text-primary" />
      {SITE_NAME}
    </span>
  );
}
