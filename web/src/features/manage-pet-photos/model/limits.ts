/** Совпадает с бэкендом (media.schemas): тип и размер проверяем ещё до загрузки */
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export type PhotoType = (typeof PHOTO_TYPES)[number];

export function isPhotoType(type: string): type is PhotoType {
  return (PHOTO_TYPES as readonly string[]).includes(type);
}

/** Новый порядок, где выбранное фото стоит на месте `to` */
export function movePhoto(ids: string[], id: string, to: number): string[] {
  const rest = ids.filter((x) => x !== id);
  const at = Math.max(0, Math.min(to, rest.length));
  return [...rest.slice(0, at), id, ...rest.slice(at)];
}
