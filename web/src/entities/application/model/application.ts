import type { components } from "@/shared/api";

type Schemas = components["schemas"];

export type Application = Schemas["ApplicationOut"];
export type ApplicationPage = Schemas["Page_ApplicationOut_"];
export type ApplicationStatus = Schemas["ApplicationStatus"];

/**
 * Статусы заявки одним списком, как на бэкенде. Порядок — путь заявки:
 * отправлена → знакомство → одобрена → завершена; отклонить или отозвать — на любом шаге.
 */
export const APPLICATION_STATUSES = {
  sent: { tone: "accent", step: 0 },
  meeting: { tone: "accent", step: 1 },
  approved: { tone: "success", step: 2 },
  completed: { tone: "success", step: 3 },
  rejected: { tone: "neutral", step: -1 },
  withdrawn: { tone: "neutral", step: -1 },
} as const satisfies Record<
  ApplicationStatus,
  { tone: "accent" | "success" | "neutral"; step: number }
>;

export const APPLICATION_STATUS_LIST = Object.keys(APPLICATION_STATUSES) as ApplicationStatus[];

/** Закрытая заявка: отклонена или отозвана — шаги пути больше не показываем */
export function isClosed(status: ApplicationStatus) {
  return APPLICATION_STATUSES[status].step < 0;
}
