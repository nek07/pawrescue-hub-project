import { PawPrint } from "lucide-react";
import { useTranslations } from "next-intl";
import type { PetDetails } from "@/entities/pet";

export function PetGallery({ pet }: { pet: PetDetails }) {
  const t = useTranslations("petProfile");
  const [main, ...rest] = pet.photos;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative flex aspect-[4/3] flex-col items-center justify-center gap-2 overflow-hidden rounded-sm bg-surface-sunken text-sm text-ink-muted">
        {main ? (
          // Размеры нарезает воркер (1600 px для страницы, 600 px для превью)
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={main.url}
            alt={t("photo", { name: pet.name })}
            className="size-full object-cover"
          />
        ) : (
          <>
            <PawPrint aria-hidden className="size-10 text-surface-raised" />
            {t("photoPlaceholder")}
          </>
        )}
      </div>
      {rest.length > 0 && (
        <ul className="grid grid-cols-4 gap-3">
          {rest.slice(0, 4).map((photo) => (
            <li
              key={photo.id}
              className="aspect-[4/3] overflow-hidden rounded-sm bg-surface-sunken"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.card_url} alt="" className="size-full object-cover" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
