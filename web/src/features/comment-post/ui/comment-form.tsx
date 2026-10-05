"use client";

import { SendHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import type { PostComment } from "@/entities/post";
import { Link, usePathname } from "@/shared/i18n";
import { Button, Textarea } from "@/shared/ui";
import { addComment } from "../api/add-comment";

type CommentFormProps = {
  postId: string;
  parentId?: string;
  signedIn: boolean;
  onAdded: (comment: PostComment) => void;
  onCancel?: () => void;
};

export function CommentForm({ postId, parentId, signedIn, onAdded, onCancel }: CommentFormProps) {
  const t = useTranslations("feed");
  const pathname = usePathname();
  const id = useId();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  if (!signedIn) {
    return (
      <p className="rounded-pill border border-line px-4 py-2 text-sm text-ink-muted">
        {t.rich("loginToComment", {
          link: (chunks) => (
            <Link
              href={{ pathname: "/login", query: { next: pathname } }}
              className="font-semibold text-primary underline"
            >
              {chunks}
            </Link>
          ),
        })}
      </p>
    );
  }

  const submit = () =>
    startTransition(async () => {
      setError(undefined);
      const result = await addComment(postId, body, parentId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setBody("");
      onAdded(result.comment);
    });

  return (
    <form
      method="post"
      className="flex flex-col gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <label htmlFor={id} className="sr-only">
        {t("commentLabel")}
      </label>
      <div className="flex items-end gap-2">
        <Textarea
          id={id}
          rows={1}
          value={body}
          maxLength={2000}
          placeholder={parentId ? t("replyPlaceholder") : t("commentPlaceholder")}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          autoFocus={Boolean(parentId)}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            // Enter — отправить, Shift+Enter — новая строка
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              if (body.trim()) submit();
            }
          }}
          className="min-h-10 resize-none rounded-[20px] py-2"
        />
        <Button
          type="submit"
          size="icon"
          loading={pending}
          disabled={!body.trim()}
          aria-label={t("send")}
        >
          {!pending && <SendHorizontal aria-hidden className="size-4" />}
        </Button>
      </div>
      {error && (
        <p id={`${id}-error`} className="text-sm text-danger">
          {t(`errors.${error as "server_unavailable"}`)}
        </p>
      )}
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="self-start text-xs text-ink-muted underline"
        >
          {t("cancel")}
        </button>
      )}
    </form>
  );
}
