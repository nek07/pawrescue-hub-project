// Модуль только для сервера: из клиентских компонентов импортируйте лишь типы
export { getSession } from "./api/get-session";
export { isCurator } from "./api/is-curator";
export { requireSession } from "./api/require-session";
export type { User, UserRole } from "./model/user";
