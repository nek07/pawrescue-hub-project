import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import boundaries from "eslint-plugin-boundaries";

// Слои сверху вниз: каждый может импортировать только тех, кто ниже.
const layers = ["app", "widgets", "features", "entities", "shared"];

const allowBelow = (layer) => ({
  from: { element: { type: layer } },
  allow: {
    to: { element: { types: { anyOf: layers.slice(layers.indexOf(layer) + 1) } } },
  },
});

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { boundaries },
    settings: {
      "import/resolver": { typescript: { alwaysTryTypes: true } },
      "boundaries/elements": [
        { type: "app", pattern: "src/app" },
        { type: "widgets", pattern: "src/widgets/*", capture: ["slice"] },
        { type: "features", pattern: "src/features/*", capture: ["slice"] },
        { type: "entities", pattern: "src/entities/*", capture: ["slice"] },
        { type: "shared", pattern: "src/shared/*", capture: ["segment"] },
      ],
    },
    rules: {
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          policies: [
            ...layers.slice(0, -1).map(allowBelow),
            // Внутри app (стили, служебные файлы) и между сегментами shared — можно
            { from: { element: { type: "app" } }, allow: { to: { element: { type: "app" } } } },
            {
              from: { element: { type: "shared" } },
              allow: { to: { element: { type: "shared" } } },
            },
          ],
        },
      ],
      // Срез открывает наружу только свой index.ts
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              // Разрешён только второй вход среза — /server (серверные запросы с cookie)
              regex: "^@/(widgets|features|entities|shared)/[^/]+/(?!server$).+",
              message:
                "Импортируйте срез через index.ts (@/<слой>/<срез>) или его серверный вход @/<слой>/<срез>/server",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
