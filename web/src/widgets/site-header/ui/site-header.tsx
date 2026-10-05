import { useTranslations } from "next-intl";
import type { User } from "@/entities/user";
import { Link } from "@/shared/i18n";
import { Button, Logo } from "@/shared/ui";
import type { NavKey } from "../model/nav";
import { LocaleSwitcher } from "./locale-switcher";
import { MainNav } from "./main-nav";
import { UserMenu } from "./user-menu";

const guestNav: NavKey[] = ["pets", "shelters", "feed", "howItWorks"];
const userNav: NavKey[] = [...guestNav, "messages"];

/** Два состояния: гость видит «Войти», вошедший — «Сообщения» и аватар. */
export function SiteHeader({
  user,
  isCurator = false,
  unread = 0,
}: {
  user: User | null;
  isCurator?: boolean;
  unread?: number;
}) {
  const t = useTranslations();

  return (
    <header className="border-b border-line bg-surface">
      <div className="page-container flex min-h-16 items-center gap-4 md:gap-8">
        <Link
          href="/"
          aria-label={t("layout.home")}
          className="text-xl leading-none whitespace-nowrap"
        >
          <Logo />
        </Link>

        <MainNav
          items={user ? userNav : guestNav}
          unread={unread}
          className="ml-auto hidden md:block"
        />

        <div className="ml-auto flex items-center gap-4 md:ml-0">
          <LocaleSwitcher />
          {user ? (
            <div className="hidden md:block">
              <UserMenu user={user} isCurator={isCurator} />
            </div>
          ) : (
            <Button asChild size="sm" className="hidden md:inline-flex">
              <Link href="/login">{t("nav.login")}</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
