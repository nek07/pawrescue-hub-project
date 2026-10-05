import { Check } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { ShelterDetails } from "@/entities/shelter";
import { StartChatButton } from "@/features/start-conversation";
import { SubscribeButton } from "@/features/subscribe-shelter";
import { Avatar } from "@/shared/ui";
import { HAS_CITY_CHOICE } from "@/shared/config";

export function ShelterHeader({
  shelter,
  signedIn,
}: {
  shelter: ShelterDetails;
  signedIn: boolean;
}) {
  const t = useTranslations();
  const format = useFormatter();
  const name = t("shelter.name", { kind: "shelter", name: shelter.name });

  const stats = [
    { label: t("shelterProfile.stats.seeking"), value: format.number(shelter.seeking_count) },
    { label: t("shelterProfile.stats.adopted"), value: format.number(shelter.adopted_count) },
    { label: t("shelterProfile.stats.followers"), value: format.number(shelter.subscribers_count) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="h-36 overflow-hidden rounded-sm bg-surface-sunken sm:h-52">
        {shelter.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shelter.cover_url}
            alt={t("shelterProfile.cover", { name })}
            className="size-full object-cover"
          />
        )}
      </div>

      <div className="flex flex-col gap-4 px-2 sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Avatar
            name=""
            src={shelter.avatar_url}
            className="-mt-14 size-24 ring-4 ring-surface sm:-mt-16"
          />
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold tracking-wider text-ink-muted uppercase">
              {HAS_CITY_CHOICE
                ? t("shelterProfile.meta", { kind: "shelter", city: t(`cities.${shelter.city}`) })
                : t("shelter.kind", { kind: "shelter" })}
            </p>
            <h1 className="font-display text-3xl font-semibold sm:text-4xl">{name}</h1>
            {shelter.verified && (
              <p className="flex items-center gap-1.5 text-sm font-semibold text-success">
                <Check aria-hidden className="size-4" />
                {t("shelterProfile.verifiedSince", { year: shelter.on_platform_since })}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <StartChatButton target={{ shelter_id: shelter.id }} signedIn={signedIn}>
            {t("shelterProfile.write")}
          </StartChatButton>
          <SubscribeButton
            shelterId={shelter.id}
            subscribed={shelter.subscribed}
            signedIn={signedIn}
          />
        </div>
      </div>

      <dl
        aria-label={t("shelterProfile.stats.label")}
        className="grid grid-cols-2 gap-4 rounded-sm border border-line bg-surface-raised p-5 sm:flex sm:gap-12"
      >
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col-reverse gap-1">
            <dd className="font-display text-2xl font-semibold">{stat.value}</dd>
            <dt className="text-xs text-ink-muted">{stat.label}</dt>
          </div>
        ))}
      </dl>
    </div>
  );
}
