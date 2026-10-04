import type { ComponentProps } from "react";
import { cn } from "@/shared/lib";

export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      aria-hidden
      className={cn("rounded-sm bg-surface-sunken motion-safe:animate-pulse", className)}
      {...props}
    />
  );
}
