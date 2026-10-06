"use client";

import { FileText, Trash2, Upload } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { Button } from "@/shared/ui";
import { confirmDocument, deleteDocument, requestDocumentUpload } from "../api/actions";
import {
  DOCUMENT_TYPES,
  isDocumentType,
  MAX_DOCUMENT_BYTES,
  type DocumentKind,
  type OnboardingDocument,
} from "../model/steps";
import { useErrorText } from "./parts";

type Upload = { key: string; name: string; error?: string };

type DocumentUploaderProps = {
  kind: DocumentKind;
  title: string;
  hint: string;
  documents: OnboardingDocument[];
  max: number;
  /** Загрузили или удалили — родитель перечитывает заявку */
  onChanged: () => Promise<void>;
};

/**
 * Документы заявки: браузер грузит файл прямо в приватное хранилище по
 * presigned URL, API подтверждает, что файл дошёл. Видят их только модераторы.
 */
export function DocumentUploader({
  kind,
  title,
  hint,
  documents,
  max,
  onChanged,
}: DocumentUploaderProps) {
  const t = useTranslations("onboarding.documents");
  const format = useFormatter();
  const errorText = useErrorText();
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const fail = (key: string, code: string) => {
    setUploads((list) => list.map((u) => (u.key === key ? { ...u, error: code } : u)));
    return false;
  };

  /** Один файл: билет → PUT в хранилище → подтверждение */
  async function uploadOne(file: File, key: string): Promise<boolean> {
    if (!isDocumentType(kind, file.type)) return fail(key, "file_type");
    if (file.size === 0) return fail(key, "file_empty");
    if (file.size > MAX_DOCUMENT_BYTES) return fail(key, "file_too_large");

    const ticket = await requestDocumentUpload(kind, {
      name: file.name,
      type: file.type,
      size: file.size,
    });
    if (!ticket.ok) return fail(key, ticket.error);
    const put = await fetch(ticket.url, {
      method: "PUT",
      headers: ticket.headers,
      body: file,
    }).catch(() => null);
    if (!put?.ok) {
      // Билет без файла занимает место в лимите — убираем его
      await deleteDocument(ticket.documentId);
      return fail(key, "upload_failed");
    }
    const confirmed = await confirmDocument(ticket.documentId);
    if (!confirmed.ok) return fail(key, confirmed.error);
    setUploads((list) => list.filter((u) => u.key !== key));
    return true;
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(undefined);
    const free = Math.max(0, max - documents.length);
    const picked = Array.from(files);
    if (picked.length > free) setError("too_many_files");
    const batch = picked.slice(0, free).map((file, i) => ({ file, key: `${Date.now()}-${i}` }));
    if (input.current) input.current.value = "";
    if (!batch.length) return;

    setBusy(true);
    setUploads((list) => [
      ...list.filter((u) => !u.error),
      ...batch.map(({ file, key }) => ({ key, name: file.name })),
    ]);
    let added = false;
    for (const { file, key } of batch) added = (await uploadOne(file, key)) || added;
    if (added) await onChanged();
    setBusy(false);
  }

  async function remove(id: string) {
    setBusy(true);
    setError(undefined);
    const result = await deleteDocument(id);
    if (!result.ok) setError("server_unavailable");
    await onChanged();
    setBusy(false);
  }

  const full = documents.length >= max;

  return (
    <section aria-labelledby={`${inputId}-title`} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id={`${inputId}-title`} className="text-sm font-semibold">
            {title}
          </h3>
          <p className="text-sm text-ink-muted">{hint}</p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => input.current?.click()}
          disabled={busy || full}
        >
          <Upload aria-hidden className="size-4" />
          {t("add")}
        </Button>
        <input
          ref={input}
          id={inputId}
          type="file"
          accept={DOCUMENT_TYPES[kind].join(",")}
          multiple={max > 1}
          className="sr-only"
          // Фокус — на видимой кнопке выше, а не на скрытом поле выбора файла
          tabIndex={-1}
          aria-label={t("add")}
          onChange={(event) => void onFiles(event.target.files)}
        />
      </div>

      {(documents.length > 0 || uploads.length > 0) && (
        <ul className="flex flex-col gap-2">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center gap-3 rounded-sm border border-line px-3 py-2 text-sm"
            >
              <FileText aria-hidden className="size-4 shrink-0 text-ink-muted" />
              <span className="min-w-0 flex-1 truncate">{doc.filename}</span>
              <span className={doc.confirmed ? "text-ink-muted" : "text-danger"}>
                {doc.confirmed && doc.size !== null
                  ? format.number(doc.size / 1024 / 1024, { maximumFractionDigits: 1 }) +
                    " " +
                    t("mb")
                  : t("notUploaded")}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("delete", { name: doc.filename })}
                title={t("delete", { name: doc.filename })}
                onClick={() => void remove(doc.id)}
                disabled={busy}
              >
                <Trash2 aria-hidden className="size-4" />
              </Button>
            </li>
          ))}
          {uploads.map((upload) => (
            <li
              key={upload.key}
              className="flex items-center gap-3 rounded-sm border border-dashed border-line px-3 py-2 text-sm"
            >
              <FileText aria-hidden className="size-4 shrink-0 text-ink-muted" />
              <span className="min-w-0 flex-1 truncate text-ink-muted">{upload.name}</span>
              <span role="status" className={upload.error ? "text-danger" : undefined}>
                {upload.error ? errorText(upload.error) : t("uploading")}
              </span>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="text-sm text-danger">
          {errorText(error)}
        </p>
      )}
    </section>
  );
}
