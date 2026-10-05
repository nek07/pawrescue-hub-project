import { PetCard, type Pet } from "@/entities/pet";
import { cn } from "@/shared/lib";

type PetGridProps = {
  pets: Pet[];
  showCity?: boolean;
  /** 3 — для узкой колонки рядом с сайдбаром (профиль приюта) */
  columns?: 3 | 4;
};

/** Простая сетка карточек — для главной и подборок «Тоже ищут дом». */
export function PetGrid({ pets, showCity = false, columns = 4 }: PetGridProps) {
  return (
    <ul
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2",
        columns === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3",
      )}
    >
      {pets.map((pet) => (
        <li key={pet.id} className="flex">
          <PetCard pet={pet} showCity={showCity} />
        </li>
      ))}
    </ul>
  );
}
