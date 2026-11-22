# Конструктор векторных композиций

Веб-сервис, который собирает иллюстративные композиции из библиотеки готовых SVG-объектов — по метафоре/заголовку или по явному списку компонентов — без генерации новых объектов. Результат остаётся полностью векторным и редактируемым.

Полное техническое задание — [`docs/SPEC.md`](docs/SPEC.md). Архитектура (хранение/извлечение/переиспользование SVG) — [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Использованные AI-инструменты — [`docs/AI_TOOLS.md`](docs/AI_TOOLS.md). Ход работы по этапам — [`docs/PROGRESS.md`](docs/PROGRESS.md). Чек-лист сдачи — [`docs/CHECKLIST.md`](docs/CHECKLIST.md).

## Возможности

- **Два сценария сборки композиции:** по метафоре/заголовку (локальный подбор объектов по словарю смыслов, без сети и без ключей) и по явному списку компонентов (чипы с нечётким поиском по опечаткам).
- **Редактор холста:** добавление объектов из библиотеки, выделение (клик/Shift/рамка), перемещение, поворот (ручка, шаг 15° с Shift), дублирование, удаление, порядок слоёв, undo/redo, зум и панорамирование.
- **Главные/фоновые состояния** объектов и переключение между ними прямо на холсте.
- **Палитра:** 3 встроенные цветовые схемы, загрузка своей палитры (.json) с валидацией, встроенный редактор 8 ролей цвета. Перекраска — мгновенная подмена CSS-переменных, без перерисовки DOM.
- **Размер детализации L/S** и 3 формата (квадрат/горизонталь/вертикаль) + свободный размер холста поверх пресетов.
- **Экспорт в SVG:** самостоятельный файл с инлайн-геометрией (без `<use>`), без растра, редактируемый в Figma/Illustrator — пропорции и форма объектов не меняются (золотой тест геометрии).
- **Модалка горячих клавиш** — `Shift + /` (физическая клавиша рядом с правым Shift, не зависит от раскладки).

## Запуск

```bash
npm install
npm run library   # собрать src/library/* из assets-src/ (обязательно перед первым npm run dev)
npm run dev
```

## Сборка в статику

```bash
npm run build      # dist/
npm run preview    # локальный просмотр собранной статики
```

Деплой статический: результат — папка `dist/`, бэкенда нет. Базовый путь по умолчанию `/`; для деплоя в подпуть задайте `VITE_BASE` на этапе сборки:

```bash
VITE_BASE=/my-sub-path/ npm run build
```

## Скрипты

| Скрипт | Назначение |
|---|---|
| `npm run dev` / `build` / `preview` | Разработка / сборка / просмотр сборки |
| `npm run library` | Собрать манифест библиотеки из `assets-src/` |
| `npm run typecheck` | `vue-tsc` (строгая проверка типов по project references) |
| `npm run lint` / `lint:fix` | ESLint |
| `npm run format` | Prettier |
| `npm run test` | Vitest (unit) |
| `npm run e2e` | Playwright (e2e) |
| `npm run snapshot` | Рендер 18 сцен (3 формата × 3 палитры × 2 размера) в PNG для визуальной проверки стиля — `docs/examples/snapshots/` |
| `npm run examples` | Реальный прогон обоих сценариев (метафора и компоненты) через полный пайплайн подбор→раскладка→экспорт, сохраняет `.svg`+`.png` и `docs/examples/README.md` |
| `npm run verify` | Полная цепочка: library → typecheck → lint → test → build → e2e |

## Примеры композиций

`npm run examples` генерирует 3 композиции в `docs/examples/` через полный пайплайн сервиса (`core/matcher` → `core/layout` → `core/export`), по одной на каждый формат/палитру и с разным размером детализации (L/S), одна — по метафоре, другая — по явному списку компонентов. Каждая сохраняется в двух файлах: `.svg` (результат сервиса, векторный, без растра) и `.png` (растровое превью для просмотра). Таблица с вводом/форматом/палитрой/seed — в сгенерированном [`docs/examples/README.md`](docs/examples/README.md). Готовые примеры лежат в репозитории: [`docs/examples/`](docs/examples/). Перегенерировать их по сидам можно командой `npm run examples`.

## Структура

```
assets-src/     исходные SVG из Figma (не редактируются руками)
scripts/        build-library.ts, snapshot.ts, examples.ts
src/
  library/      СГЕНЕРИРОВАНО (+ ручной src/library/semantics.ts)
  core/         чистая логика: palette, recolor, layout, matcher, export, geometry
  features/     canvas, library-panel, scenarios, palette, layers, export, toolbar
  stores/       Pinia: scene, library, palette
  shared/       строки интерфейса, типы, форматы
tests/          unit (Vitest), e2e (Playwright), фикстуры
docs/           SPEC.md, ARCHITECTURE.md, AI_TOOLS.md, PROGRESS.md, CHECKLIST.md, examples/ (README.md + .svg/.png генерируются)
```

## Стек

Vue 3 (Composition API, `<script setup lang="ts">`) + TypeScript (strict) + Vite + Pinia. Без бэкенда — статическое SPA.
