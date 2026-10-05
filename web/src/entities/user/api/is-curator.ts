import "server-only";
import { cache } from "react";
import type { User } from "../model/user";
import { getCurating } from "./get-curating";

/**
 * Ведёт ли человек питомцев: проверенный волонтёр или сотрудник проверенного
 * приюта. Тогда ему нужны кабинет куратора и «Входящие заявки».
 */
export const isCurator = cache(async (user: User | null): Promise<boolean> => {
  const curating = await getCurating(user);
  return curating.volunteer || curating.shelters.length > 0;
});
