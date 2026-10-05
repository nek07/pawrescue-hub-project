import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Радиусы из tokens.css: без этого rounded-pill не перекрывает rounded-sm
const twMerge = extendTailwindMerge({
  extend: { theme: { radius: ["pill"] } },
});

/** Склеивает классы и убирает конфликтующие утилиты Tailwind. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
