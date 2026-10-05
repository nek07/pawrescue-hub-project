import { useTranslations } from "next-intl";
import { Link } from "@/shared/i18n";
import { Logo } from "@/shared/ui";

export function SiteFooter() {
  const t = useTranslations();

  const columns = [
    {
      title: t("footer.sections"),
      links: [
        { href: "/pets", label: t("nav.pets") },
        { href: "/shelters", label: t("nav.shelters") },
        { href: "/feed", label: t("nav.feed") },
      ],
    },
    {
      title: t("footer.about"),
      links: [
        { href: "/verification", label: t("footer.verification") },
        { href: "/rules", label: t("footer.rules") },
        { href: "/contacts", label: t("footer.contacts") },
      ],
    },
  ];

  return (
    <footer className="mt-auto border-t border-line">
      <div className="page-container flex flex-col gap-8 py-10 md:flex-row md:justify-between">
        <div className="max-w-sm">
          <Logo className="text-lg" />
          <p className="mt-2 text-sm text-ink-muted">{t("footer.tagline")}</p>
          <p className="text-sm text-ink-muted">{t("footer.cities")}</p>
        </div>
        <div className="flex flex-wrap gap-x-16 gap-y-6">
          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <ul className="flex flex-col gap-2 text-sm">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-ink-muted hover:text-ink">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>
    </footer>
  );
}
