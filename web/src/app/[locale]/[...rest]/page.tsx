import { notFound } from "next/navigation";

// Любой неизвестный адрес внутри локали показывает локализованную 404
export default function CatchAll() {
  notFound();
}
