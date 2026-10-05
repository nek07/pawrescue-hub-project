export type PetAgeValue = { unit: "months" | "years"; count: number };

/** До года — в месяцах («7 месяцев»), дальше — в полных годах («4 года»). */
export function getPetAge(birthDate: string, now = new Date()): PetAgeValue {
  const birth = new Date(birthDate);
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) months -= 1;
  months = Math.max(months, 0);

  return months < 12
    ? { unit: "months", count: Math.max(months, 1) }
    : { unit: "years", count: Math.floor(months / 12) };
}
