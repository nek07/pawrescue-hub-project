import { useTranslations } from "next-intl";
import { Badge } from "@/shared/ui";
import type { PetSex } from "../model/pet";
import { PET_STATUSES, type PetStatus } from "../model/status";

export function StatusBadge({
  status,
  sex,
  className,
}: {
  status: PetStatus;
  sex: PetSex;
  className?: string;
}) {
  const t = useTranslations("pet.status");
  return (
    <Badge tone={PET_STATUSES[status].tone} className={className}>
      {t(status, { sex })}
    </Badge>
  );
}
