import type { ReactNode } from "react";
import { cn } from "@/shared/lib";

type EmptyStateProps = {
  /** Иконка или крупный код вроде «404» */
  visual?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Пустой экран всегда предлагает следующее действие */
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ visual, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-sm border border-line bg-surface-raised px-6 py-10 text-center",
        className,
      )}
    >
      {visual && <div className="mb-2 text-ink-muted">{visual}</div>}
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      {description && <p className="max-w-sm text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
