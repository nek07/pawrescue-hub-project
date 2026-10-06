export const MOD_TABS = ["overview", "posts", "comments", "users"] as const;
export type ModTab = (typeof MOD_TABS)[number];

/** Состояние панели живёт в адресе: его можно обновить, переслать и вернуться назад */
export type ModQuery = {
  tab: ModTab;
  visibility?: string;
  q?: string;
  post?: string;
  author?: string;
  blocked?: string;
  cursor?: string;
};

export function modHref(query: Partial<ModQuery>): string {
  const params = new URLSearchParams(
    Object.entries(query).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
  if (params.get("tab") === "overview") params.delete("tab");
  const search = params.toString();
  return search ? `/moderation?${search}` : "/moderation";
}
