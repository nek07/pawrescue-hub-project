import { useTranslations } from "next-intl";
import { Badge } from "@/shared/ui";
import { APPLICATION_STATUSES, type ApplicationStatus } from "../model/application";

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  const t = useTranslations("application.status");
  return <Badge tone={APPLICATION_STATUSES[status].tone}>{t(status)}</Badge>;
}
