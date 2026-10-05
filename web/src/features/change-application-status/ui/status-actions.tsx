"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import type { Application, ApplicationStatus } from "@/entities/application";
import { Button, ErrorState } from "@/shared/ui";
import { changeApplicationStatus } from "../api/change-status";

/** Кнопки строятся из allowed_transitions — фронт не дублирует правила бэкенда. */
const DESTRUCTIVE = new Set<ApplicationStatus>(["rejected", "withdrawn"]);

export function StatusActions({ application }: { application: Application }) {
  const t = useTranslations("application");
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState<ApplicationStatus>();
  const [error, setError] = useState<string>();

  if (application.allowed_transitions.length === 0) return null;

  // Бэкенд отдаёт переходы по алфавиту; показываем по пути заявки, отказ — последним
  const transitions = application.allowed_transitions.toSorted((a, b) => order(a) - order(b));

  const change = (status: ApplicationStatus) => {
    if (DESTRUCTIVE.has(status) && !window.confirm(t(`confirm.${status as "rejected"}`))) return;
    setTarget(status);
    setError(undefined);
    startTransition(async () => {
      const result = await changeApplicationStatus(application.id, status);
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <div className="flex flex-col gap-2 border-t border-line pt-3">
      <div className="flex flex-wrap gap-2">
        {transitions.map((status) => (
          <Button
            key={status}
            size="sm"
            variant={DESTRUCTIVE.has(status) ? "ghost" : "primary"}
            className={DESTRUCTIVE.has(status) ? "border border-line" : undefined}
            disabled={pending}
            loading={pending && target === status}
            onClick={() => change(status)}
          >
            {t(`action.${status}`)}
          </Button>
        ))}
      </div>
      {error && <ErrorState title={t(`errors.${error as "server_unavailable"}`)} />}
    </div>
  );
}

// Порядок кнопок — путь заявки, отказ и отзыв — последними
const ORDER: ApplicationStatus[] = [
  "meeting",
  "approved",
  "completed",
  "sent",
  "rejected",
  "withdrawn",
];
const order = (status: ApplicationStatus) => ORDER.indexOf(status);
