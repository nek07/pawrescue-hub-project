"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition, type ReactNode } from "react";
import { Link, usePathname } from "@/shared/i18n";
import { Button } from "@/shared/ui";
import { startConversation, type ChatTarget } from "../api/start-conversation";

type StartChatButtonProps = {
  target: ChatTarget;
  signedIn: boolean;
  children: ReactNode;
  variant?: "primary" | "secondary" | "link";
  size?: "sm" | "md";
  className?: string;
};

/** «Спросить куратора», «Написать приюту», «Откликнуться». Гость попадает на вход. */
export function StartChatButton({
  target,
  signedIn,
  children,
  variant = "primary",
  size = "md",
  className,
}: StartChatButtonProps) {
  const t = useTranslations("chat");
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const linkClass = "font-semibold text-primary hover:underline";

  if (!signedIn) {
    const href = { pathname: "/login", query: { next: pathname } };
    return variant === "link" ? (
      <Link href={href} className={className ? `${linkClass} ${className}` : linkClass}>
        {children}
      </Link>
    ) : (
      <Button asChild variant={variant} size={size} className={className}>
        <Link href={href}>{children}</Link>
      </Button>
    );
  }

  const start = () =>
    startTransition(async () => {
      const result = await startConversation(target);
      setError(result.error || undefined);
    });

  return (
    <>
      {variant === "link" ? (
        <button
          type="button"
          onClick={start}
          disabled={pending}
          aria-busy={pending || undefined}
          className={className ? `${linkClass} ${className}` : linkClass}
        >
          {children}
        </button>
      ) : (
        <Button
          variant={variant}
          size={size}
          loading={pending}
          onClick={start}
          className={className}
        >
          {children}
        </Button>
      )}
      {error && (
        <span role="alert" className="text-sm text-danger">
          {t(`startErrors.${error as "server_unavailable"}`)}
        </span>
      )}
    </>
  );
}
