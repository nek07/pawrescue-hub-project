import type { Metadata } from "next";
import { MessageSquare } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getPet } from "@/entities/pet";
import { requireSession } from "@/entities/user";
import { Link, type Locale } from "@/shared/i18n";
import { firstValues } from "@/shared/lib";
import { Button, EmptyState } from "@/shared/ui";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("messages"))("metaTitle"), robots: { index: false } };
}

// Заглушка до этапа 5 (чат на WebSocket): подтверждает отправку заявки
export default async function MessagesPage({
  params,
  searchParams,
}: PageProps<"/[locale]/messages/[[...id]]">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  await requireSession("/messages");
  const { sent } = firstValues(await searchParams);
  const [t, pet] = await Promise.all([getTranslations("messages"), sent ? getPet(sent) : null]);

  return (
    <div className="page-container flex flex-col gap-6 py-10">
      <h1 className="font-display text-4xl font-semibold">{t("title")}</h1>
      {pet && (
        <p role="status" className="rounded-sm bg-accent px-4 py-3 text-sm text-on-accent">
          {t("sent", { name: pet.name })}
        </p>
      )}
      <EmptyState
        visual={<MessageSquare aria-hidden className="size-8" />}
        title={t("empty.title")}
        description={t("empty.description")}
        action={
          <Button asChild variant="secondary">
            <Link href="/pets">{t("empty.action")}</Link>
          </Button>
        }
      />
    </div>
  );
}
