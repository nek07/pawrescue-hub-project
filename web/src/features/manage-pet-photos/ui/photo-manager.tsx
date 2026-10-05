"use client";

import { ArrowLeft, ArrowRight, ImagePlus, Star, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useRef, useState, useTransition } from "react";
import type { PetDetails } from "@/entities/pet";
import { Badge, Button } from "@/shared/ui";
import {
  confirmPhotoUpload,
  deletePetPhoto,
  getPhotoUploadStatus,
  reorderPetPhotos,
  requestPhotoUpload,
  revalidatePetPhotos,
} from "../api/photos";
import { isPhotoType, MAX_PHOTO_BYTES, movePhoto } from "../model/limits";

type Photo = PetDetails["photos"][number];
type Upload = {
  key: string;
  name: string;
  state: "uploading" | "processing" | "failed";
  error?: string;
};

const POLL_MS = 1_000;
const POLL_TRIES = 60; // воркер обычно укладывается в секунду; минута — с запасом

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Фото анкеты: браузер грузит файл прямо в хранилище по presigned URL,
 * воркер делает WebP трёх размеров. Первое фото — обложка в каталоге.
 */
export function PhotoManager({ petId, photos }: { petId: string; photos: Photo[] }) {
  const t = useTranslations("cabinet.photos");
  const router = useRouter();
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const errorText = (code: string) =>
    t.has(`errors.${code}` as "errors.server_unavailable")
      ? t(`errors.${code}` as "errors.server_unavailable")
      : t("errors.server_unavailable");

  const patch = (key: string, next: Partial<Upload>) =>
    setUploads((list) => list.map((u) => (u.key === key ? { ...u, ...next } : u)));

  /** Один файл: билет → PUT в хранилище → подтверждение → ждём WebP */
  async function uploadOne(file: File, key: string): Promise<boolean> {
    const fail = (code: string) => {
      patch(key, { state: "failed", error: code });
      return false;
    };
    if (!isPhotoType(file.type)) return fail("file_type");
    if (file.size > MAX_PHOTO_BYTES) return fail("file_too_large");

    const ticket = await requestPhotoUpload(petId, file.type, file.size);
    if (!ticket.ok) return fail(ticket.error);
    const put = await fetch(ticket.url, {
      method: "PUT",
      headers: ticket.headers,
      body: file,
    }).catch(() => null);
    if (!put?.ok) return fail("upload_failed");

    patch(key, { state: "processing" });
    let status = await confirmPhotoUpload(ticket.uploadId);
    for (let i = 0; status.ok && status.status === "processing" && i < POLL_TRIES; i++) {
      await sleep(POLL_MS);
      status = await getPhotoUploadStatus(ticket.uploadId);
    }
    if (!status.ok) return fail(status.error);
    if (status.status !== "done") return fail(status.error ?? "processing_timeout");
    setUploads((list) => list.filter((u) => u.key !== key));
    return true;
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(undefined);
    const batch = Array.from(files).map((file, i) => ({ file, key: `${Date.now()}-${i}` }));
    setUploads((list) => [
      ...list.filter((u) => u.state !== "failed"),
      ...batch.map(({ file, key }) => ({ key, name: file.name, state: "uploading" as const })),
    ]);
    if (input.current) input.current.value = "";
    // По одному: порядок фото совпадает с порядком выбора
    let added = false;
    for (const { file, key } of batch) added = (await uploadOne(file, key)) || added;
    if (added) {
      await revalidatePetPhotos(petId);
      router.refresh();
    }
  }

  const reorder = (ids: string[]) =>
    startTransition(async () => {
      setError(undefined);
      const result = await reorderPetPhotos(petId, ids);
      if (!result.ok) setError("server_unavailable");
      router.refresh();
    });

  const remove = (photoId: string) => {
    if (!window.confirm(t("deleteConfirm"))) return;
    startTransition(async () => {
      setError(undefined);
      const result = await deletePetPhoto(petId, photoId);
      if (!result.ok) setError("server_unavailable");
      router.refresh();
    });
  };

  const ids = photos.map((p) => p.id);
  const busy = pending || uploads.some((u) => u.state !== "failed");

  return (
    <section
      aria-labelledby={`${inputId}-title`}
      className="flex flex-col gap-4 rounded-sm border border-line bg-surface-raised p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id={`${inputId}-title`} className="font-semibold">
            {t("title")}
          </h2>
          <p className="text-sm text-ink-muted">{t("hint")}</p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => input.current?.click()}
          disabled={busy}
        >
          <ImagePlus aria-hidden className="size-4" />
          {t("add")}
        </Button>
        <input
          ref={input}
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          // Фокус — на видимой кнопке выше, а не на скрытом поле выбора файла
          tabIndex={-1}
          aria-label={t("add")}
          onChange={(event) => void onFiles(event.target.files)}
        />
      </div>

      {photos.length === 0 && uploads.length === 0 && (
        <p className="rounded-sm border border-dashed border-line p-6 text-center text-sm text-ink-muted">
          {t("empty")}
        </p>
      )}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((photo, index) => (
          <li key={photo.id} className="flex flex-col gap-2">
            <div className="relative aspect-[4/5] overflow-hidden rounded-sm bg-surface-sunken">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.card_url}
                alt={t("photoAlt", { n: index + 1 })}
                className="size-full object-cover"
              />
              {index === 0 && (
                <Badge tone="accent" className="absolute top-2 left-2">
                  {t("cover")}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {index > 0 && (
                <IconButton
                  label={t("makeCover")}
                  onClick={() => reorder(movePhoto(ids, photo.id, 0))}
                  disabled={busy}
                >
                  <Star aria-hidden className="size-4" />
                </IconButton>
              )}
              {index > 0 && (
                <IconButton
                  label={t("moveLeft")}
                  onClick={() => reorder(movePhoto(ids, photo.id, index - 1))}
                  disabled={busy}
                >
                  <ArrowLeft aria-hidden className="size-4" />
                </IconButton>
              )}
              {index < photos.length - 1 && (
                <IconButton
                  label={t("moveRight")}
                  onClick={() => reorder(movePhoto(ids, photo.id, index + 1))}
                  disabled={busy}
                >
                  <ArrowRight aria-hidden className="size-4" />
                </IconButton>
              )}
              <IconButton label={t("delete")} onClick={() => remove(photo.id)} disabled={busy}>
                <Trash2 aria-hidden className="size-4" />
              </IconButton>
            </div>
          </li>
        ))}
        {uploads.map((upload) => (
          <li
            key={upload.key}
            className="flex aspect-[4/5] flex-col items-center justify-center gap-1 rounded-sm border border-dashed border-line p-3 text-center text-sm"
          >
            <span className="line-clamp-2 break-all text-ink-muted">{upload.name}</span>
            <span role="status" className={upload.state === "failed" ? "text-danger" : undefined}>
              {upload.state === "failed"
                ? errorText(upload.error ?? "server_unavailable")
                : t(upload.state)}
            </span>
          </li>
        ))}
      </ul>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {errorText(error)}
        </p>
      )}
    </section>
  );
}

function IconButton({
  label,
  children,
  ...props
}: React.ComponentProps<"button"> & { label: string }) {
  return (
    <Button type="button" variant="ghost" size="icon" aria-label={label} title={label} {...props}>
      {children}
    </Button>
  );
}
