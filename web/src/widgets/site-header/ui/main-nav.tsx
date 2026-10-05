"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/shared/i18n";
import { cn } from "@/shared/lib";
import { isActive, navHref, type NavKey } from "../model/nav";

export function MainNav({ items, className }: { items: NavKey[]; className?: string }) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <nav aria-label={t("label")} className={className}>
      <ul className="flex items-center gap-6">
        {items.map((key) => {
          const active = isActive(pathname, navHref[key]);
          return (
            <li key={key}>
              <Link
                href={navHref[key]}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative py-5 text-sm whitespace-nowrap text-ink-muted transition-colors hover:text-ink",
                  "after:absolute after:inset-x-0 after:bottom-3 after:h-0.5 after:rounded-pill",
                  active && "font-semibold text-ink after:bg-primary",
                )}
              >
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
