import { useTranslations } from "next-intl";
import { Button } from "@/shared/ui";

/**
 * Обычная ссылка, не next/link: уходим на бэкенд, он ведёт на Google
 * (OIDC + PKCE) и возвращает на `next` с уже установленной cookie.
 */
export function GoogleLoginButton({ next }: { next: string }) {
  const t = useTranslations("login");
  const href = `/api/v1/auth/google/login?${new URLSearchParams({ next })}`;

  return (
    <Button asChild variant="secondary" size="lg" className="w-full">
      <a href={href}>
        <GoogleMark />
        {t("google")}
      </a>
    </Button>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 12h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
