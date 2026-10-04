import { IBM_Plex_Sans, Literata } from "next/font/google";

// cyrillic-ext нужен для казахских букв: ә, ғ, қ, ң, ө, ұ, ү, һ, і.
// Опции next/font должны быть литералами — компилятор читает их статически.
const literata = Literata({
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  variable: "--font-literata",
  display: "swap",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
  display: "swap",
});

export const fontVariables = `${literata.variable} ${plexSans.variable}`;
