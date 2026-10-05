import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

/**
 * Фото для карточки превью. Satori (внутри ImageResponse) не читает WebP,
 * а фото питомцев хранятся в WebP — перекодируем в JPEG нужного размера
 * и отдаём data URI. Нет фото или хранилище не ответило — null (карточка без фото).
 */
export async function photoDataUri(
  source: string | null | undefined,
  { width, height }: { width: number; height: number },
): Promise<string | null> {
  if (!source) return null;
  try {
    const input = source.startsWith("/")
      ? await readFile(join(process.cwd(), "public", source)) // файл из public/
      : await download(source);
    const jpeg = await sharp(input)
      .resize(width, height, { fit: "cover" })
      .jpeg({ quality: 82 })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    return null;
  }
}

async function download(url: string): Promise<Buffer> {
  const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
