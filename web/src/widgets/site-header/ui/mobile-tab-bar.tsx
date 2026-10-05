"use client";

import { FileText, MessageSquare, Newspaper, PawPrint, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/shared/i18n";
import { cn } from "@/shared/lib";
import { isActive, navHref } from "../model/nav";

const tabs = [
  { key: "pets", href: navHref.pets, Icon: PawPrint },
  { key: "feed", href: navHref.feed, Icon: Newspaper },
  { key: "messages", href: navHref.messages, Icon: MessageSquare },
] as const;

/** Нижние вкладки на телефоне. Вошёл ли человек — решает сервер и передаёт сюда. */
export function MobileTabBar({ signedIn, unread = 0 }: { signedIn: boolean; unread?: number }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const account = signedIn
    ? ({ key: "applications", href: "/applications", Icon: FileText } as const)
    : ({ key: "login", href: "/login", Icon: UserRound } as const);

  return (
    <nav
      aria-label={t("tabsLabel")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface-raised pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-4">
        {[...tabs, account].map(({ key, href, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-center text-xs leading-tight",
                  active ? "font-semibold text-primary" : "text-ink-muted",
                )}
              >
                <span className="relative">
                  <Icon aria-hidden className="size-5" />
                  {key === "messages" && unread > 0 && (
                    <span
                      className="absolute -top-1.5 -right-2.5 flex min-w-4 items-center justify-center rounded-pill bg-primary px-1 text-[10px] font-semibold text-on-primary"
                      aria-label={t("unread", { count: unread })}
                    >
                      {unread}
                    </span>
                  )}
                </span>
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
