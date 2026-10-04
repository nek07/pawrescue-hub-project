import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/shared/lib";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-pill text-center font-semibold transition-colors disabled:pointer-events-none aria-busy:cursor-progress",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-on-primary hover:bg-primary-hover disabled:bg-surface-sunken disabled:text-ink-muted aria-busy:disabled:bg-primary aria-busy:disabled:text-on-primary",
        secondary:
          "border border-line bg-surface-raised text-ink hover:border-ink disabled:text-ink-muted",
        ghost: "text-ink hover:bg-surface-sunken disabled:text-ink-muted",
      },
      size: {
        sm: "min-h-8 px-3 text-sm",
        md: "min-h-10 px-5 text-sm",
        lg: "min-h-12 px-6 text-base",
        icon: "size-10 shrink-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Отрисовать единственный дочерний элемент (например, ссылку) со стилями кнопки */
    asChild?: boolean;
    /** Показать спиннер и заблокировать повторное нажатие */
    loading?: boolean;
  };

export function Button({
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className);

  if (asChild) {
    return (
      <Slot className={classes} {...props}>
        {children}
      </Slot>
    );
  }

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <LoaderCircle aria-hidden className="size-4 motion-safe:animate-spin" />}
      {children}
    </button>
  );
}

export { buttonVariants };
