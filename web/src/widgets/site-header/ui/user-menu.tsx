"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { FileText, Heart, Inbox, LogOut, MessageSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import type { User } from "@/entities/user";
import { logout } from "@/features/logout";
import { Link } from "@/shared/i18n";
import { Avatar } from "@/shared/ui";

const itemClass =
  "flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-sm outline-none data-highlighted:bg-surface-sunken";

/** Меню аватара: клавиатура и ARIA — из Radix. */
export function UserMenu({ user, isCurator }: { user: User; isCurator: boolean }) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={t("userMenu.label")}
        className="rounded-full"
        disabled={pending}
      >
        <Avatar name={user.name} src={user.avatar_url} tone="ink" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-48 rounded-sm border border-line bg-surface-raised p-1 shadow-lg"
        >
          <DropdownMenu.Label className="px-3 py-2 text-sm font-semibold">
            {user.name}
          </DropdownMenu.Label>
          <DropdownMenu.Item asChild className={itemClass}>
            <Link href="/applications">
              <FileText aria-hidden className="size-4" />
              {t("userMenu.myApplications")}
            </Link>
          </DropdownMenu.Item>
          {isCurator && (
            <DropdownMenu.Item asChild className={itemClass}>
              <Link href="/applications/incoming">
                <Inbox aria-hidden className="size-4" />
                {t("userMenu.incoming")}
              </Link>
            </DropdownMenu.Item>
          )}
          <DropdownMenu.Item asChild className={itemClass}>
            <Link href="/favorites">
              <Heart aria-hidden className="size-4" />
              {t("userMenu.favorites")}
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className={itemClass}>
            <Link href="/messages">
              <MessageSquare aria-hidden className="size-4" />
              {t("nav.messages")}
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item className={itemClass} onSelect={() => startTransition(() => logout())}>
            <LogOut aria-hidden className="size-4" />
            {t("userMenu.logout")}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
