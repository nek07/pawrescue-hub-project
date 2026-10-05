import type { ReactNode } from "react";
import { ApplicationCard, type Application } from "@/entities/application";
import { StatusActions } from "@/features/change-application-status";

/** Список заявок; пустое состояние передаёт страница — у заявителя и куратора оно разное. */
export function ApplicationList({
  applications,
  empty,
}: {
  applications: Application[];
  empty: ReactNode;
}) {
  if (applications.length === 0) return <>{empty}</>;

  return (
    <ul className="flex flex-col gap-4">
      {applications.map((application) => (
        <li key={application.id}>
          <ApplicationCard
            application={application}
            actions={<StatusActions application={application} />}
          />
        </li>
      ))}
    </ul>
  );
}
