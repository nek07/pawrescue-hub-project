import type { Metadata } from "next";
import { MessageSquare } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getConversation, getConversations, getMessages } from "@/entities/conversation/server";
import { requireSession } from "@/entities/user";
import { Link, redirect, type Locale } from "@/shared/i18n";
import { cn, firstValues } from "@/shared/lib";
import { Button, EmptyState } from "@/shared/ui";
import {
  ChatSidePanel,
  ChatSocketProvider,
  ChatThread,
  ConversationList,
} from "@/widgets/chat-window";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("messages"))("metaTitle"), robots: { index: false } };
}

export default async function MessagesPage({
  params,
  searchParams,
}: PageProps<"/[locale]/messages/[[...id]]">) {
  const { locale, id: segments } = await params;
  setRequestLocale(locale as Locale);
  const activeId = segments?.[0];
  await requireSession(activeId ? `/messages/${activeId}` : "/messages");

  const [t, list] = await Promise.all([getTranslations("messages"), getConversations()]);

  // После заявки: беседу о питомце заводит воркер бэкенда — открываем её, если уже есть
  const { sent } = firstValues(await searchParams);
  if (!activeId && sent) {
    const about = list.items.find((c) => c.pet?.id === sent);
    if (about) redirect({ href: `/messages/${about.id}`, locale: locale as Locale });
  }

  const [conversation, messages] = activeId
    ? await Promise.all([getConversation(activeId), getMessages(activeId).catch(() => null)])
    : [null, null];
  if (activeId && (!conversation || !messages)) notFound();

  if (list.items.length === 0) {
    return (
      <div className="page-container flex flex-col gap-6 py-10">
        <h1 className="font-display text-4xl font-semibold">{t("title")}</h1>
        {sent && (
          <p role="status" className="rounded-sm bg-accent px-4 py-3 text-sm text-on-accent">
            {t("sentPending")}
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

  return (
    <ChatSocketProvider>
      <div className="page-container grid gap-4 py-6 lg:grid-cols-[300px_minmax(0,1fr)_260px]">
        {/* На телефоне — либо список, либо открытый диалог */}
        <div className={cn("flex flex-col gap-3", activeId && "hidden lg:flex")}>
          <h1 className="font-display text-3xl font-semibold">{t("title")}</h1>
          <ConversationList initial={list} activeId={activeId} />
        </div>
        {conversation && messages ? (
          <>
            <ChatThread
              key={conversation.id}
              conversation={conversation}
              initialMessages={messages}
            />
            <div className="hidden lg:block">
              <ChatSidePanel conversation={conversation} />
            </div>
          </>
        ) : (
          <p className="hidden self-center text-center text-ink-muted lg:col-span-2 lg:block">
            {t("select")}
          </p>
        )}
      </div>
    </ChatSocketProvider>
  );
}
