# Paw Rescue Hub — веб

Next.js (App Router) + упрощённый Feature-Sliced Design. Правила — в «Гайде по фронтенду».

```
src/
  app/        маршруты: только сборка блоков и загрузка данных
  widgets/    крупные блоки страниц
  features/   действия пользователя
  entities/   сущности предметной области
  shared/     api, ui, styles, i18n — без предметной области
messages/     ru.json, kk.json
e2e/          сценарии Playwright
```

Импорты идут только вниз по слоям, срез импортируется через свой `index.ts` — это проверяет `npm run lint`.

## Команды

| Команда                               | Что делает                                                                              |
| ------------------------------------- | --------------------------------------------------------------------------------------- |
| `npm run dev`                         | dev-сервер на http://localhost:3000 (`/ru`, `/kk`)                                      |
| `npm run gen:api`                     | типы из OpenAPI FastAPI → `src/shared/api/schema.d.ts` (адрес схемы — `API_SCHEMA_URL`) |
| `npm run lint` / `typecheck` / `test` | ESLint с границами слоёв, TypeScript, Vitest                                            |
| `npm run e2e`                         | Playwright на десктопе и 390px + проверка axe                                           |

## Запуск с бэкендом

```bash
cd ../api && docker compose up -d && docker compose exec api python -m app.seed
cd ../web && cp .env.example .env.local && npm run dev
```

Вход локально — формой «Войти для разработки» на `/login` (Google и Telegram требуют ключей). Если браузеры Playwright не скачиваются, запускайте e2e в установленном Chrome: `PW_CHANNEL=chrome npm run e2e`.
