import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Шрифты сайта для карточек превью (ImageResponse умеет только ttf/otf/woff).
 * Подмножества latin + cyrillic + cyrillic-ext. Файлы с одним именем и весом
 * Satori схлопывает в один, поэтому у каждого подмножества своё имя, а семейство
 * собирается списком в font-family (fontStack) — так рисуются и казахские буквы.
 * В standalone-сборку файлы попадают через outputFileTracingIncludes (next.config.ts).
 */
const DIR = join(process.cwd(), "src/shared/og/fonts");
const SUBSETS = ["latin", "cyrillic", "cyrillic-ext"] as const;

type Face = { family: string; file: string; name: string; weight: 400 | 600 };
const FACES: Face[] = [
  { family: "literata", file: "literata", name: "Literata", weight: 600 },
  { family: "plex", file: "ibm-plex-sans", name: "IBM Plex Sans", weight: 400 },
  { family: "plex", file: "ibm-plex-sans", name: "IBM Plex Sans", weight: 600 },
];

export const OG_FONTS = await Promise.all(
  FACES.flatMap((face) =>
    SUBSETS.map(async (subset) => ({
      name: `${face.name} ${subset}`,
      data: await readFile(join(DIR, `${face.file}-${subset}-${face.weight}.ttf`)),
      weight: face.weight,
      style: "normal" as const,
    })),
  ),
);

/** font-family для семейства: все его подмножества по очереди */
export const fontStack = (name: string) => SUBSETS.map((subset) => `${name} ${subset}`).join(", ");
