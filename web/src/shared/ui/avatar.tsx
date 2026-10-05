import { cva, type VariantProps } from "class-variance-authority";
import { PawPrint } from "lucide-react";
import { cn } from "@/shared/lib";

const avatarVariants = cva(
  "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold",
  {
    variants: {
      size: { sm: "size-8 text-sm", md: "size-10 text-base", lg: "size-14 text-xl" },
      tone: { ink: "bg-ink text-surface", accent: "bg-accent text-on-accent" },
    },
    defaultVariants: { size: "md", tone: "accent" },
  },
);

type AvatarProps = VariantProps<typeof avatarVariants> & {
  name: string;
  src?: string | null;
  className?: string;
};

/** Фото, иначе первая буква имени; без имени — лапка (аватар приюта по макету). */
export function Avatar({ name, src, size, tone, className }: AvatarProps) {
  const initial = name.trim().charAt(0).toUpperCase();

  return (
    <span className={cn(avatarVariants({ size, tone }), className)}>
      {src ? (
        // Размеры уже нарезает бэкенд (ресайз в arq), оптимизация next/image не нужна
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="size-full object-cover" />
      ) : initial ? (
        <span aria-label={name} role="img">
          {initial}
        </span>
      ) : (
        <PawPrint aria-hidden className="size-1/2" />
      )}
    </span>
  );
}
