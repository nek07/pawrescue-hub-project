import { PetCard, type Pet } from "@/entities/pet";
import { FavoriteButton } from "@/features/favorite-pet";
import { cn } from "@/shared/lib";

type PetGridProps = {
  pets: Pet[];
  /** Передан — на фото есть ♡; гостя сердечко отправляет на вход */
  signedIn?: boolean;
  /** 3 — для узкой колонки рядом с сайдбаром (профиль приюта) */
  columns?: 3 | 4;
};

/** Сетка карточек: каталог, главная, избранное и подборки «Тоже ищут дом». */
export function PetGrid({ pets, signedIn, columns = 4 }: PetGridProps) {
  return (
    <ul
      className={cn(
        "grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-5 md:grid-cols-3",
        columns === 4 && "lg:grid-cols-4",
      )}
    >
      {pets.map((pet) => (
        <li key={pet.id} className="flex">
          <PetCard
            pet={pet}
            favorite={
              signedIn !== undefined && (
                <FavoriteButton
                  petId={pet.id}
                  petName={pet.name}
                  favorite={pet.is_favorite}
                  signedIn={signedIn}
                  className="border-transparent bg-surface-raised/90 shadow-sm backdrop-blur-sm hover:border-transparent hover:bg-surface-raised"
                />
              )
            }
          />
        </li>
      ))}
    </ul>
  );
}
