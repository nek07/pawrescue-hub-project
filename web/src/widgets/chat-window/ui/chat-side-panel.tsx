import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { APPLICATION_STATUSES, isClosed, ApplicationStatusBadge } from "@/entities/application";
import type { Conversation } from "@/entities/conversation";
import { getPetAge } from "@/entities/pet";
import { Link } from "@/shared/i18n";
import { cn } from "@/shared/lib";
import { Card } from "@/shared/ui";
import { HAS_CITY_CHOICE } from "@/shared/config";

const STEPS = ["sent", "meeting", "approved", "completed"] as const;

/** Правая колонка: о каком питомце речь, где заявка и памятка о безопасности */
export function ChatSidePanel({ conversation }: { conversation: Conversation }) {
  const t = useTranslations();
  const { pet, application } = conversation;
  const curator = conversation.my_side === "curator";

  return (
    <aside className="flex flex-col gap-4">
      {pet && (
        <Card className="relative">
          <div className="aspect-[4/3] bg-surface-sunken">
            {pet.cover_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pet.cover_url} alt="" className="size-full object-cover" />
            )}
          </div>
          <div className="p-4">
            <Link
              href={`/pets/${pet.id}`}
              className="font-display text-lg font-semibold after:absolute after:inset-0"
            >
              {pet.name}
            </Link>
            <p className="text-sm text-ink-muted">
              {t("pet.kind", { kind: pet.kind, sex: pet.sex })} ·{" "}
              {t(`pet.age.${getPetAge(pet.birth_date).unit}`, {
                count: getPetAge(pet.birth_date).count,
              })}
              {HAS_CITY_CHOICE && ` · ${t(`cities.${pet.city}`)}`}
            </p>
          </div>
        </Card>
      )}

      {application && (
        <Card className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">
              {curator ? t("chat.incomingApplication") : t("chat.application")}
            </h2>
            <ApplicationStatusBadge status={application.status} />
          </div>
          {!isClosed(application.status) && (
            <ol className="flex flex-col gap-2 text-sm">
              {STEPS.map((step, index) => {
                const done = index <= APPLICATION_STATUSES[application.status].step;
                return (
                  <li
                    key={step}
                    className={cn("flex items-center gap-2", done ? "text-ink" : "text-ink-muted")}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "flex size-5 items-center justify-center rounded-full border",
                        done ? "border-success bg-success text-on-primary" : "border-line",
                      )}
                    >
                      {done && <Check className="size-3" />}
                    </span>
                    {t(`application.status.${step}`)}
                  </li>
                );
              })}
            </ol>
          )}
          <Link
            href={curator ? "/applications/incoming" : "/applications"}
            className="text-sm font-semibold text-primary hover:underline"
          >
            {curator ? t("userMenu.incoming") : t("userMenu.myApplications")} →
          </Link>
        </Card>
      )}

      <section className="rounded-sm bg-accent p-4 text-on-accent">
        <h2 className="font-semibold">{t("chat.safety.title")}</h2>
        <p className="mt-1 text-sm">{t("chat.safety.text")}</p>
      </section>
    </aside>
  );
}
