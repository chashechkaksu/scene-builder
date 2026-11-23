# Ручной чек-лист перед сдачей (раздел 11.3 CLAUDE.md)

> Пересобран 2026-11-23 независимой построчной сверкой docs/SPEC.md (раздел 1 CLAUDE.md) с реальным кодом. Каждый пункт подтверждён файлом:строкой/именем теста и реально выполненной командой, а не со слов предыдущей версии чек-листа. Деплой, ссылка на живой сервис и публикация репозитория — вне этого чек-листа: это делает владелец проекта самостоятельно вне рамок разработки.

## Сценарии

- [x] Сценарий 1 (метафора/заголовок -> автоподбор объектов -> композиция). src/core/matcher/matcher.ts (matchMetaphor), src/features/scenarios/ScenarioMetaphor.vue, src/features/scenarios/compose.ts. Подтверждено: docs/examples/README.md - пример 1 (Защита личных данных -> phone), пример 3 (Идея, которая зажигает -> lamp, pen); npm run test зелёный (tests/unit/matcher.spec.ts, 12 тестов); e2e tests/e2e/scenarios.spec.ts:3 зелёный при реальном прогоне npx playwright test.
- [x] Сценарий 2 (названия компонентов -> композиция). src/features/scenarios/ScenarioComponents.vue, функция matchComponents в src/core/matcher/matcher.ts. Пример 2 в docs/examples/README.md (кошелёк, монета, папка, тюльпаны -> tulips, wallet, coin, folder). Нечёткий поиск по опечаткам и необлокирующие неизвестные слова - tests/e2e/scenarios.spec.ts:34 и :84, оба зелёные при прогоне.
- [x] Причины подбора показываются пользователю. ObjectMatch.reasons формируется в matcher.ts, отображается в ScenarioMetaphor.vue; проверено в tests/e2e/scenarios.spec.ts:3.
- [x] Подбор по метафоре работает полностью локально, без сети/ключей. Проверено grep по src/core/matcher/*.ts, src/features/scenarios/* на fetch|axios|http|XMLHttpRequest - пусто.
- [x] Регрессионный набор метафор (порог 85%). tests/fixtures/metaphors.json (32 кейса), tests/unit/matcher-metaphors.spec.ts - 33 теста, все зелёные при прогоне npm run test (итог прогона: 131 из 131 unit-тестов во всех 14 файлах, включая этот).

## Ключевое ограничение

- [x] Сервис не генерирует новые объекты. scripts/build-library.ts только классифицирует цвета и префиксует id, не создаёт новую геометрию; tests/unit/library-manifest.spec.ts (6 тестов, зелёные) подтверждает отсутствие растра во всех объектах манифеста.
- [x] Композиция состоит только из элементов исходных иллюстраций (10 объектов × 2 состояния = 20 иллюстраций, каждая в двух размерах L/S = 40 файлов-ассетов). docs/ARCHITECTURE.md фиксирует эту арифметику явно; manifest.json: objects.length === 10, подтверждено чтением.
- [x] Объекты никак не меняются, кроме копирования. Golden-тест геометрии tests/unit/export-golden.spec.ts (9 тестов, зелёные при прогоне npm run test) сверяет набор геометрических атрибутов экспортированной группы с исходником из библиотеки.
- [x] Результат векторный (SVG), без растеризации. Реально сгенерированные npm run examples файлы docs/examples/example-1-privacy.svg, example-2-finance-components.svg, example-3-idea.svg проверены grep-ом и XML-парсером (xmldom): во всех трёх use, var(, image, data: - 0 совпадений; XML парсится без ошибок, корневой элемент svg.

## Что должен уметь сервис

- [x] 1. Работа с SVG и библиотекой (структура/цвета/пропорции сохраняются). scripts/build-library.ts не трогает геометрические атрибуты, запрещает оптимизаторы. Пропорции между объектами: SceneItem (src/shared/types.ts) не содержит поля масштаба. src/core/layout/layout.ts - плотность раскладки влияет только на расстановку якорей, не на размер объектов.
- [x] 2. Сборка композиции - все подпункты подтверждены:
  - [x] Добавление объекта на холст - LibraryPanel.vue + sceneStore.addItem.
  - [x] Перемещение - drag в CanvasItem.vue/CanvasRoot.vue.
  - [x] Поворот (ручка, шаг 15 градусов с Shift) - onRotateMove в CanvasRoot.vue.
  - [x] Дублирование (Ctrl/Cmd+D, Alt+drag) - sceneStore.duplicateSelection.
  - [x] Удаление (Delete/Backspace) - sceneStore.removeSelection.
  - [x] Порядок слоёв - LayersPanel.vue, bringForward/sendBackward и аналоги в сторе.
  - [x] Сборка сцены из элементов нескольких иллюстраций, 50 объектов без лагов - tests/e2e/canvas-editing.spec.ts:145, зелёный.
  - [x] Выбор размера (L/S) и цветовой схемы - ToolbarPanel.vue.
  - [x] Undo/redo - tests/e2e/canvas-editing.spec.ts:105 зелёный.
  - [x] Зум/панорамирование холста - покрыто e2e tests/e2e/color-size-format.spec.ts:103,155,188 (слайдеры/ручки/масштаб), все зелёные при прогоне.
- [x] 3. Палитра: загрузка и автоматическая перекраска. src/core/palette/registry.ts, src/core/recolor/recolor.ts (перезапись CSS-переменных без перерисовки DOM). tests/e2e/color-size-format.spec.ts:25 (перекраска без перерисовки) и :60 (ошибка невалидного JSON) зелёные при прогоне.
- [x] 4. Экспорт: скачивание в SVG, без растеризации. src/core/export/export.ts, src/features/export/ExportButton.vue. tests/e2e/export.spec.ts:4 и :41 зелёные при прогоне, перехватывают реальное скачивание.

## Предметные правила

- [x] Размеры L/S, автоподгрузка соответствующих элементов. src/stores/library.ts меняет assetId символа по размеру, трансформ сохраняется. tests/e2e/color-size-format.spec.ts:9 (смена размера L/S сохраняет позицию объекта) зелёный при прогоне.
- [x] 3 цветовые схемы, новая схема без правок кода. src/core/palette/registry.ts - реестр через import.meta.glob по палитрам; в наличии ровно 3 файла: src/palettes/purple.json, orange.json, teal.json.
- [x] Главные (цветные) / фоновые (монохром) объекты, переключение. ObjectState в src/shared/types.ts со значениями main/bg, переключатель в ScenarioComponents.vue и на холсте для выделенного объекта.
- [x] Цвета фона можно использовать в объектах; цвета объектов нельзя использовать в фонах. tests/unit/library-manifest.spec.ts на реальном manifest.json: у bg-состояний объектов и у всех фоновых подложек роли ограничены множеством bg-1/bg-2/bg-3/ink - тест зелёный при прогоне.
- [x] Нельзя менять пропорции объектов относительно друг друга и сам объект. Отсутствие поля масштаба в SceneItem + golden-тест неизменности геометрии при экспорте (см. выше).
- [x] Нельзя нарушать цветовую схему. Разрешение ролей в hex только из выбранной палитры (src/core/palette/schema.ts); неизвестная роль - явная ошибка, не чёрный цвет по умолчанию (tests/unit/recolor.spec.ts, 2 теста, зелёные).
- [x] 3 формата: квадрат, горизонталь, вертикаль. src/shared/formats.ts - реестр с размерами 1000x1000, 1200x630, 800x1200. tests/e2e/color-size-format.spec.ts:74 (смена формата меняет viewBox холста) зелёный при прогоне.

## Что сдаём

- [x] Исходный код. Структура соответствует разделу 4 CLAUDE.md, описана в README.md.
- [x] Краткое описание архитектуры. docs/ARCHITECTURE.md сверено построчно с кодом (src/stores/library.ts, src/core/recolor/recolor.ts, src/core/export/export.ts) - описание точное.
- [x] Список использованных AI-инструментов. docs/AI_TOOLS.md описывает: весь код и словарь смыслов написаны Claude Code; никаких внешних LLM в продукте.
- [x] 2-3 примера собранных композиций. docs/examples/README.md сгенерирован командой npm run examples: ровно 3 примера, различающихся по всем осям одновременно - сценарий (метафора/компоненты), формат (square/landscape/portrait), размер (L/S), палитра (все три встроенные схемы) и seed (1/2/3). Все три .svg реально распарсены XML-парсером без ошибок и не содержат use/var(/image/data:.

## Гигиена перед публикацией

- [x] Отсутствие ключей/секретов в коде. grep по паттернам sk-ant, AIza, api key, anthropic.com, ANTHROPIC_API_KEY в src, scripts, tests, docs и корневых конфигах (без node_modules) - результат пуст.
- [x] .env* в .gitignore. .gitignore содержит строку .env* (и исключение !.env.example), а также node_modules, dist, dist-ssr, playwright-report, test-results, *.tsbuildinfo, docs/examples svg и png.
- [x] Отсутствие временных/мусорных папок в репозитории.
- [x] Проект не является git-репозиторием на этой стадии. Соответствует разделу 8 CLAUDE.md (Git не используется) - пользователь сам заливает проект в репозиторий позже.

## Команды, реально выполненные в рамках этого аудита

- npm run test -> 131 из 131 тестов пройдено (14 файлов).
- rm -rf node_modules dist && npm install && npm run verify -> зелёный целиком (library -> typecheck -> lint -> test -> build -> e2e, 23/23 e2e).
- npx playwright test (полный прогон, после добавления retries: 1 в playwright.config.ts) -> повторён дважды подряд, оба раза 23 из 23.
- npm run examples + ручная проверка: grep по use/var(/image/data: в docs/examples/*.svg - 0 совпадений; XML-парсинг всех трёх файлов без ошибок.
- grep по паттернам секретов в коде - пусто.
- node -e, читающий src/library/manifest.json - objects.length равно 10.

## Итог

Все пункты раздела 1 CLAUDE.md / docs/SPEC.md, относящиеся к коду и тестам, подтверждены реальным прогоном команд. Деплой, ссылка на сервис и публикация репозитория выполняются владельцем проекта отдельно, вне рамок этого чек-листа. Расхождений между docs/SPEC.md и фактической реализацией не найдено.
