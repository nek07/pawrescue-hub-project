import type { ComponentProps } from "react";
import { cn } from "@/shared/lib";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("overflow-hidden rounded-sm border border-line bg-surface-raised", className)}
      {...props}
    />
  );
}
