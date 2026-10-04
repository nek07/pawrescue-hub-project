export type NavKey = "pets" | "shelters" | "feed" | "howItWorks" | "messages";

export const navHref: Record<NavKey, string> = {
  pets: "/pets",
  shelters: "/shelters",
  feed: "/feed",
  howItWorks: "/#how-it-works",
  messages: "/messages",
};

/** Раздел подсвечен и на вложенных страницах: /pets/42 — это «Питомцы». */
export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
