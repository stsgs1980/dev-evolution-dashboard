# План: dev-evolution-dashboard

> **Статус**: DRAFT, согласуется с владельцем
> **Спека**: `docs/superpowers/specs/dev-evolution-dashboard.spec.md`
> **Правило**: одна фаза = один промт = один коммит (или серия атомарных коммитов).

## Принципы плана

1. **Данные раньше UI.** Ни одна компонента не пишется, пока нет снапшота и метрик:
   иначе UI проектируется под выдуманные данные.
2. **Метрики раньше дизайна.** Вёрстка подстраивается под реальные числа, не наоборот.
3. **Каждая фаза оставляет репозиторий зелёным.** Незаконченная фаза не пушится.
4. **Зависимости строго вниз по таблице.** Фаза N+1 не начинается без DoD фазы N.
5. **Все файлы <= 250 строк.** Разбиение закладывается сразу: `features/<screen>/`
   держит `components/`, `hooks/`, `<screen>.tsx` как композицию.

## Карта фаз

| #   | Фаза                      | Выход                                       | Ключевые пакеты                |
| --- | ------------------------- | ------------------------------------------- | ------------------------------ |
| 0   | Kickoff и согласование    | Подтверждённые ответы, обновлённый BRIEF    | —                              |
| 1   | Фундамент шаблона         | Next.js + Tailwind v4 + Untitled UI, гейты  | next, tailwindcss, untitledui  |
| 2   | Сбор данных               | `data/snapshot/latest.json` + валидатор     | octokit, zod, tsx              |
| 3   | Слой метрик               | `shared/metrics/*` + тесты                  | vitest (есть)                  |
| 4   | Модели: эры, DMI, инсайты | `shared/models/*` + снапшот-тесты           | —                              |
| 5   | Дизайн-система и шелл     | Токены Untitled UI, шелл, сайдбар, Cmd+K    | untitledui, react-aria         |
| 6   | Управление состоянием     | Фильтры в URL, контекст, провайдеры         | nuqs, react-hook-form          |
| 7   | Графики                   | Chart-обёртки Tremor + a11y                 | @tremor/react или tremor raw   |
| 8   | Экраны                    | 8 маршрутов, реальные данные                | untitledui, tremor, react-aria |
| 9   | Motion и dnd-kit          | Анимации, реордер виджетов, скраббер        | motion, dnd-kit, magicui       |
| 10  | Инсайты и методология     | Карточки с доказательствами, `/methodology` | next-mdx-remote                |
| 11  | Полировка и релиз         | A11y, перф, доки, CHANGELOG, тэг v1.0.0     | —                              |

## Фаза 0: Kickoff и согласование

**Задачи.** Прочитать BRIEF, спеку и план. Задать уточняющие вопросы одним блоком.
Снять открытые вопросы из `README.md` (username, приватные репо, таймзона, деплой, LLM).

**DoD.** Владелец ответил на все вопросы; ответы внесены в `BRIEF.md`; кода нет.

**Коммит.** `docs: resolve brief open questions`

## Фаза 1: Фундамент шаблона

**Задачи.**

1. Step 1-5 из `docs/getting-started.md`: имя проекта, README, сброс CHANGELOG.
2. Установить Next.js, Tailwind v4, Untitled UI через CLI (`untitledui init --nextjs`),
   базовый набор компонентов. shadcn/ui не ставить: он тянет Base UI.
3. Настроить `next.config.ts`, `src/app/layout.tsx`, `globals.css` с токенами.
4. Структура `src/`: `app/`, `features/`, `shared/`, `data/`.
5. Добавить скрипты `dev`, `build`, `start`; ESLint-конфиг Next.

**DoD.** `npm run dev` открывает заглушку `/`; все 8 гейтов шаблона зелёные;
`check:docs` не ругается на новые упоминания путей; в `package.json` нет `@radix-ui/*`,
`@base-ui-components/*` и `shadcn`, есть `react-aria-components` и `@untitledui/icons`;
`docs/ui-components.md` заполнен, все записи со статусом free.

**Коммиты.** `feat(next): bootstrap app router`, `feat(ui): add untitled ui and tailwind tokens`

## Фаза 2: Сбор данных

**Задачи.**

1. `scripts/collect-github.ts` + модули: `fetch/`, `git/`, `parse/`, `normalize/`.
2. Валидатор схемы снапшота на zod, `npm run data:validate`.
3. `.env.example` с `GITHUB_TOKEN`, `.env.local` в `.gitignore`.
4. Резюме-логи и `notes` для деградаций; детерминированный порядок ключей.
5. Снапшот целевого аккаунта в `data/snapshot/latest.json`.

**DoD.** `npm run data:collect -- --user <u>` создаёт снапшот, проходящий валидатор,
при отсутствии токена показывает понятную ошибку; повторный запуск идемпотентен.

**Коммиты.** `feat(data): add github collector`, `feat(data): add snapshot schema validation`

## Фаза 3: Слой метрик

**Задачи.** Реализовать разделы 4.1-4.6 спеки как чистые функции в `shared/metrics/`,
по одному файлу на группу. Тесты на фикстурах: нормальный снапшот, пустой, с `null`.

**DoD.** Покрытие `shared/metrics` >= 80%; ни одной функции длиннее 50 строк;
`MetricResult` везде возвращает `confidence` и `basis`.

**Коммиты.** `feat(metrics): activity and churn`, `feat(metrics): craft and stack`,
`test(metrics): edge cases and nulls`

## Фаза 4: Модели

**Задачи.** Эры (4.8), DMI (4.7), правила инсайтов (4.9). Вынести веса в отдельный файл.
Снапшот-тесты детерминизма: два прогона -> идентичный JSON.

**DoD.** Сегментация стабильна, `k` в диапазоне 3-6, DMI в 0..100 на всех фикстурах,
каждое правило имеет тест "срабатывает / не срабатывает".

**Коммиты.** `feat(models): era segmentation`, `feat(models): dmi scoring`,
`feat(models): insight rules`

## Фаза 5: Дизайн-система и шелл

**Задачи.** Проверить и расширить семантические токены Untitled UI (цвет, типографика,
spacing, радиусы), светлая и тёмная темы; добавить только `chart-1..chart-6`.
`DashboardShell`: сайдбар, шапка, хлебные крошки, командная палитра Cmd+K на React Aria.
Базовые UI-примитивы: Card, Badge, Stat, Table, Tabs, Tooltip, Sheet, Skeleton, EmptyState.

**DoD.** Шелл рендерится на всех маршрутах-заглушках; фокус-стили видимы;
`prefers-reduced-motion` уважается; клавиатурой доступны все пункты навигации.

**Коммиты.** `feat(design): tokens and themes`, `feat(shell): dashboard layout and command palette`

## Фаза 6: Состояние и фильтры

**Задачи.** Глобальный фильтр: период (пресеты + кастом), репозитории, языки.
Состояние в URL через `nuqs`, контекст-провайдер с мемоизированными селекторами.
Хук `useFilteredSnapshot`. Сохранение раскладки виджетов в localStorage.

**DoD.** Ссылка с фильтрами воспроизводима в новой вкладке; смена фильтра не вызывает
ноль сетевых запросов; селекторы покрыты тестами.

**Коммиты.** `feat(state): url-driven filters`, `feat(state): filtered snapshot hook`

## Фаза 7: Графики

**Задачи.** Обёртки над Tremor: AreaChart, BarChart, LineChart, DonutChart, RadarChart,
Tracker, Sparkline, ProgressBar. Единая тема графиков из токенов.
Каждый график: заголовок, unit, источник, empty state, обработка `null`.

**DoD.** Ни один график не падает на пустых данных; подписи читаемы в тёмной теме;
CLS < 0.05 (фиксированная высота контейнера); графики грузятся динамически.

**Коммиты.** `feat(charts): tremor wrappers and theme`, `feat(charts): empty and null states`

## Фаза 8: Экраны

**Задачи.** Собрать 8 маршрутов из раздела 5 спеки на реальных данных.
PRO не куплен, готовых страниц нет: шелл и экраны компонуются из бесплатных блоков
Untitled UI (page header, metrics, filter bar, table, charts, sidebar navigation).
`/repos` — таблица с сортировкой и фильтрами; `/repos/[name]` — детальный разбор.
Адаптировать блоки shadcnblocks, shadcnstudio, shadcndeck как паттерны композиции.

**DoD.** Каждый экран: данные, пустое состояние, состояние ошибки, ссылки на методологию.
Ни одного `TODO` в UI. Скриншот каждого экрана приложен к PR.

**Коммиты.** по экрану: `feat(overview): dashboard page`, `feat(timeline): eras page`, и т.д.

## Фаза 9: Motion и dnd-kit

**Задачи.** `LazyMotion` + `domAnimation`, `MotionConfig reducedMotion="user"`.
Счётчики KPI через NumberTicker, reveal графиков при появлении.
Реордер виджетов на `/` через dnd-kit с сохранением и сбросом.
Скраббер периода на `/timeline`: перетаскивание по шкале меняет выбранный диапазон.
Не более 3 декоративных эффектов (BorderBeam, AnimatedBeam, Meteors) на весь продукт.

**DoD.** При `prefers-reduced-motion: reduce` анимаций нет вообще;
drag доступен с клавиатуры (сенсоры + `KeyboardSensor`); после реордера рефреш
сохраняет порядок.

**Коммиты.** `feat(motion): page transitions and number tickers`,
`feat(dnd): widget reorder with persistence`, `feat(timeline): period scrubber`

## Фаза 10: Инсайты и методология

**Задачи.** `/insights`: карточки по severity, раскрытие `evidence`, фильтр.
`/methodology`: каждая формула из спеки, веса DMI, ограничения и дисклеймеры,
список отслеживаемых технологий, версия снапшота.

**DoD.** Число в инсайте совпадает с числом на соответствующем графике
(проверяется вручную по чеклисту); ни одного инсайта без `evidence`.

**Коммиты.** `feat(insights): evidence cards`, `feat(methodology): formulas and weights`

## Фаза 11: Полировка и релиз

**Задачи.** Lighthouse-прогон и фиксы a11y, контраст, порядок табуляции.
Перф: бандл-анализ, динамические импорты, мемоизация тяжёлых селекторов.
Доки: README по `README.template.md`, `docs/` обновлён, CHANGELOG через `npm run changelog`.
Тэг `v1.0.0`.

**DoD.** Lighthouse a11y >= 95, performance >= 90; стартовый бандл <= 200 kB gzip;
все 8 гейтов зелёные; скриншоты светлой и тёмной темы в README.

**Коммиты.** `perf: split chart bundles`, `docs: finalize readme and changelog`,
`chore(release): v1.0.0`

## Риски и как их снимаем

| Риск                                      | Снятие                                                    |
| ----------------------------------------- | --------------------------------------------------------- |
| GitHub не отдаёт статистику (202 / пусто) | `null` + `notes`, деградация вместо падения               |
| Агент пишет монолитные экраны             | `check:file-length` в pre-commit, дробление с фазы 5      |
| UI спроектирован под выдуманные данные    | Данные и метрики раньше UI (фазы 2-4)                     |
| Второй primitive-слой                     | ADR по UI-экосистеме + ревью зависимостей в каждой фазе   |
| PRO-компонент попал в проект по ошибке    | Манифест docs/ui-components.md + проверка статуса free    |
| Кластеризация эр нестабильна              | Фиксированный сид, снапшот-тесты, силуэт вместо ручного k |
| Снапшот раздувается                       | Бюджет 2 MB, `--since`, разбиение по годам                |
| Токен утекает в коммит                    | `.env.local` только, `git grep` в чеклисте релиза         |

## Что не входит в v1 (backlog)

- Мультиаккаунт и сравнение двух разработчиков.
- Серверный крон-сбор данных.
- LLM-нарративы инсайтов.
- Экспорт в PDF.
- Строка времени отдельных файлов (hotspot-анализ).
