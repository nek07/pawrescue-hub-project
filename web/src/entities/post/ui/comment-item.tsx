"use client";

import type { ReactNode } from "react";
import type { PostComment } from "../model/post";
import { AuthorLine } from "./author-line";

/** Комментарий; ответы — один уровень вложенности, как на бэкенде */
export function CommentItem({
  comment,
  actions,
  children,
}: {
  comment: PostComment;
  actions?: ReactNode;
  /** Ответы и форма ответа */
  children?: ReactNode;
}) {
  return (
    <li className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 rounded-sm bg-surface p-3">
        <AuthorLine author={comment.author} createdAt={comment.created_at} size="sm" />
        <p className="text-sm whitespace-pre-line">{comment.body}</p>
      </div>
      {actions && <div className="flex items-center gap-4 pl-3 text-xs">{actions}</div>}
      {children && <div className="ml-6 flex flex-col gap-2">{children}</div>}
    </li>
  );
}
