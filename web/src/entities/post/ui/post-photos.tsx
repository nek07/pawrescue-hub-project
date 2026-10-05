import { useTranslations } from "next-intl";
import { cn } from "@/shared/lib";
import type { Post } from "../model/post";

/** Фото поста; у историй «до и после» подписи «До» и «Дома» — как в макете */
export function PostPhotos({ photos }: { photos: Post["photos"] }) {
  const t = useTranslations("feed.photo");
  if (photos.length === 0) return null;

  return (
    <ul
      className={cn(
        "grid gap-2",
        photos.length === 1 ? "grid-cols-1" : photos.length === 2 ? "grid-cols-2" : "grid-cols-3",
      )}
    >
      {photos.slice(0, 6).map((photo) => (
        <li
          key={photo.id}
          className="relative aspect-[4/3] overflow-hidden rounded-sm bg-surface-sunken"
        >
          {/* Размеры нарезает воркер: card_url — 600 px */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.card_url} alt={photo.caption ?? ""} className="size-full object-cover" />
          {(photo.label || photo.caption) && (
            <span className="absolute bottom-2 left-2 rounded-sm bg-surface-raised/90 px-2 py-0.5 text-xs font-semibold">
              {photo.caption ?? t(photo.label!)}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
