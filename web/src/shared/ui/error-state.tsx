import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/shared/lib";

type ErrorStateProps = {
  title: ReactNode;
  description?: ReactNode;
  /** Ошибку показываем всегда с действием: «Повторить», «К каталогу» */
  action?: ReactNode;
  className?: string;
};

/** Ошибка рядом с местом, где она случилась. Объявляется скринридером сразу. */
export function ErrorState({ title, description, action, className }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn("flex gap-3 rounded-sm bg-danger-surface p-4 text-danger", className)}
    >
      <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
      <div className="flex flex-col gap-1 text-sm">
        <p className="font-semibold">{title}</p>
        {description && <p>{description}</p>}
        {action && <div className="mt-1">{action}</div>}
      </div>
    </div>
  );
}
