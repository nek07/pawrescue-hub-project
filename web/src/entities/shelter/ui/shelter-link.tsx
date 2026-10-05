import type { ReactNode } from "react";
import { Link } from "@/shared/i18n";
import type { ShelterKind } from "../model/shelter";

const stretched =
  "after:absolute after:inset-0 after:rounded-sm focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-ink";

/**
 * Профиль есть только у приюта. У волонтёра своей страницы пока нет —
 * ведём в каталог его питомцев.
 */
export function curatorHref(type: ShelterKind, id: string) {
  return type === "shelter" ? `/shelters/${id}` : `/pets?volunteer_id=${id}`;
}

export function ShelterLink({
  type,
  id,
  children,
}: {
  type: ShelterKind;
  id: string;
  children: ReactNode;
}) {
  return (
    <Link href={curatorHref(type, id)} className={stretched}>
      {children}
    </Link>
  );
}
