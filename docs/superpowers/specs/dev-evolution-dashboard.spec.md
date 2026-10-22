# Спека: dev-evolution-dashboard

> **Статус**: APPROVED FOR PLANNING
> **Дата**: 2026-10-22
> **Связанные документы**: `BRIEF.md`, `plans/dev-evolution-dashboard.plan.md`

## 1. Задача

Превратить историю GitHub-аккаунта в связную картину развития: что происходило,
когда менялись практики, в каком направлении идёт рост. Спека фиксирует модель данных,
формулы метрик и информационную архитектуру экранов, чтобы агент не изобретал их по ходу.

## 2. Архитектура: три слоя

```text
[ GitHub API + git ]  ->  data/snapshot/*.json  ->  shared/metrics (pure TS)  ->  UI
     (offline)              (committed)               (tested, no side effects)
```

| Слой               | Где живёт                   | Правило                                      |
| ------------------ | --------------------------- | -------------------------------------------- |
| Сбор               | `scripts/collect-github.ts` | Сеть только здесь. Идемпотентен. Резюмируем  |
| Снапшот            | `data/snapshot/`            | Единственный источник данных для приложения  |
| Метрики            | `shared/metrics/`           | Чистые функции `(snapshot, options) => T`    |
| Производные модели | `shared/models/`            | Эры, DMI, инсайты. Детерминированный сид     |
| UI                 | `app/`, `features/`         | Только чтение снапшота, ноль сетевых вызовов |

## 3. Модель данных снапшота

```ts
export interface Snapshot {
  meta: {
    username: string;
    collectedAt: string; // ISO 8601
    range: { from: string; to: string };
    timezone: string; // для агрегации по дням
    includePrivate: boolean;
    generatorVersion: string;
    source: "api" | "api+git";
  };
  profile: Profile;
  repos: RepoSnapshot[];
  events: SearchEvents; // PR и issues через Search API
  notes: CollectionNote[]; // деградации и пропуски, показываются в /methodology
}

interface RepoSnapshot {
  name: string;
  isFork: boolean;
  isArchived: boolean;
  isPrivate: boolean;
  createdAt: string;
  pushedAt: string;
  primaryLanguage: string | null;
  languages: Record<string, number>; // байты
  stars: number;
  forks: number;
  releases: { tag: string; publishedAt: string }[];
  stats: {
    commitActivity: number[] | null; // 52 недели
    codeFrequency: [number, number, number][] | null; // [week, add, del]
    punchCard: [number, number, number][] | null; // [weekday, hour, commits]
  };
  commits: CommitRecord[] | { truncated: true; count: number; sampled: CommitRecord[] };
  manifests: ManifestPoint[]; // точки истории package.json и др.
  fileStats?: {
    // только Tier 2
    loc: number;
    files: number;
    testFiles: number;
    topDirs: { path: string; bytes: number }[];
  };
}

interface CommitRecord {
  sha: string;
  date: string; // ISO 8601, авторская дата
  message: string; // первая строка
  body: string; // опционально
  filesChanged?: number;
  additions?: number;
  deletions?: number;
  isMerge: boolean;
  parents: number;
}

interface ManifestPoint {
  sha: string;
  date: string;
  deps: string[]; // имена пакетов
  devDeps: string[];
  scripts: string[];
  engines?: Record<string, string>;
}
```

Правила модели:

- Отсутствующие данные -> `null`, не `0` и не пустой массив. Нужно отличать
  "ноль коммитов" от "GitHub не отдал статистику".
- Статистические эндпоинты GitHub отдают `202` пока считают -> повтор с backoff,
  после N попыток `null` + запись в `notes`.
- Снапшот версионируется через `meta.generatorVersion`; изменение схемы -> мажор.

## 4. Слой метрик

Все функции чистые и тестируемые без сети. Каждая возвращает `MetricResult<T>`:

```ts
export interface MetricResult<T> {
  value: T;
  confidence: "high" | "medium" | "low";
  basis: string; // "12 репозиториев, 3412 коммитов, 2019-04..2026-10"
  notes: string[]; // какие данные отсутствовали
}
```

### 4.1 Активность

| Метрика           | Формула                                                      |
| ----------------- | ------------------------------------------------------------ |
| `commitsPerMonth` | группировка по `YYYY-MM` в `meta.timezone`                   |
| `activeDays`      | число уникальных дней с >= 1 коммитом                        |
| `streak.longest`  | макс. длина серии подряд идущих дней с коммитом              |
| `streak.current`  | серия, заканчивающаяся сегодня                               |
| `activeDaysRatio` | `activeDays / daysInPeriod` -> 0..1                          |
| `cadence`         | `commits / activeDays`                                       |
| `burstiness`      | `взвешенный CV интервалов между коммитами` -> CV > 1 = рывки |

### 4.2 Объём и чанж

| Метрика         | Формула                                                      |
| --------------- | ------------------------------------------------------------ |
| `churnPerMonth` | сумма `additions` и `deletions` из `codeFrequency` и numstat |
| `netLines`      | `additions - deletions`                                      |
| `churnRatio`    | `deletions / additions` -> рост = больше переписывания       |
| `codeVolume`    | LOC из Tier 2 по последнему коммиту                          |

### 4.3 Гранулярность и атомарность

| Метрика              | Формула                             | Смысл                    |
| -------------------- | ----------------------------------- | ------------------------ |
| `filesPerCommit.p50` | медиана `filesChanged`              | зрелость дробления       |
| `filesPerCommit.p95` | 95-й перцентиль                     | остались ли мега-коммиты |
| `giantCommitShare`   | доля коммитов с `filesChanged > 20` | наследие от прототипов   |
| `commitLocMedian`    | медиана `additions + deletions`     | размер шага изменений    |

Ожидаемая динамика (не догма): `filesPerCommit` снижается, `churnRatio` растёт умеренно.

### 4.4 Зрелость практик

Наличие инструмента определяется по коммитам, которые впервые добавили файл:
`git log --diff-filter=A --format=%aI -- <path>`.

| Инструмент      | Пути-детекторы                                             |
| --------------- | ---------------------------------------------------------- |
| TypeScript      | `tsconfig.json`, `*.ts`, `*.tsx`                           |
| Тесты           | `vitest.config.*`, `jest.config.*`, `*.test.*`, `*.spec.*` |
| CI              | `.github/workflows/*`                                      |
| Линтинг         | `eslint.config.*`, `.eslintrc*`, `.prettierrc*`            |
| Hooks           | `.husky/*`                                                 |
| Документация    | `docs/`, `README`, `CHANGELOG.md`, `SECURITY.md`           |
| Контейнеризация | `Dockerfile`, `docker-compose*`                            |
| Релизы          | записи в `releases[]`, `CHANGELOG.md`                      |

Производные:

- `adoptionDate(tool)` -> ISO-дата первого появления, `null` если не появился.
- `testFileRatio(period)` -> `test files added / all files added` в периоде.
- `conventionalRatio(period)` -> доля сообщений по регэкспу
  `^(feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert)(\([^)]+\))?!?:\s`.
- `commitTypeMix(period)` -> распределение по типам. `fix/feat` -> отладка vs создание.
- `scaffoldRatio(period)` -> доля коммитов вида `init`, `first commit`, `initial`.
- `avgSubjectLength(period)` -> информативность сообщений.

### 4.5 Эволюция стека

- `languageShareByQuarter` -> доля байт по языкам, сглаживание окном 2 квартала.
- `frameworkTimeline` -> для каждого пакета из словаря: `firstSeen`, `lastSeen`,
  `reposUsedIn`, `activeQuarters`.
- `breadth` -> нормированная энтропия Шеннона по распределению языков.
- `depth` -> макс. число коммитов в одном репозитории на один язык.
- `newTechRate(quarter)` -> число впервые появившихся в этом квартале пакетов.

Словарь задаётся конфигом `data/tech-dictionary.ts` и строится по фактическому
профилю, а не по универсальному списку: react, react-dom, typescript, tailwindcss,
radix, vite, next, node, python, shell (hooks), а также повторяющиеся смысловые
темы профиля: design tokens, ui kit, agent guard, audit. Тест проверяет, что
каждый пакет словаря встречается в снапшоте хотя бы один раз, иначе словарь
содержит мёртвые записи.

### 4.6 Портфель репозиториев

- `lifespan` -> `pushedAt - createdAt`.
- `activeSpan` -> `lastCommit - firstCommit`.
- `status` -> Active (коммит за 90 дней) / Dormant (90-365) / Abandoned (>365) /
  Archived / Template.
- `health` -> 0..100 из базовой гигиены: README, LICENSE, описание, топики,
  линтер. Это floor: в реальном профиле он насыщается почти сразу, поэтому рост
  он не показывает и в DMI не участвует.
- `depthScore` -> 0..100 из инженерной глубины: тесты, CI, релизы, hooks,
  CHANGELOG, зафиксированные зависимости, покрытие. Это то, что различает
  репозитории и растёт со временем. Именно `depthScore` идёт в DMI.
- `status` и `activeSpan` считаются по датам коммитов, а не по `pushedAt`:
  массовое обновление метаданных в один день не делает все репозитории активными.
- `commitSparkline` -> 12 точек по месяцам последнего года активности.

### 4.7 Индекс зрелости DMI (0-100)

```text
DMI = 100 * ( 0.15*consistency + 0.30*craft + 0.20*complexity
            + 0.15*depth + 0.15*breadth + 0.05*ossSignal )
```

| Компонент     | Формула                                                                 |
| ------------- | ----------------------------------------------------------------------- |
| `consistency` | `min(1, activeDaysRatio_90d / 0.35)`                                    |
| `craft`       | среднее по инженерной глубине (`depthScore`), базовая гигиена не в счёт |
| `complexity`  | `min(1, log10(1 + codeVolume) / 5)` — насыщение на 100k LOC             |
| `depth`       | `min(1, log10(1 + maxRepoCommits) / 3)` — насыщение на 1000 коммитов    |
| `breadth`     | `min(1, distinctLangs / 8)` с штрафом 0.5 за язык с < 20 коммитами      |
| `ossSignal`   | `min(1, log10(1 + 10*stars + 3*externalPRs) / 2)`; вес снижен до 0.05   |

Требования к DMI:

- `log` — десятичный, аргумент защищён `Math.max(0, x)`.
- Каждый компонент отображается отдельно; свёртка не скрывает составляющие.
- Рядом с индексом всегда стоят дельта за 12 месяцев и подпись "эвристика".
- Веса вынесены в `shared/metrics/dmi-weights.ts` и меняются без правки логики.
- Компонент, который физически не может измениться (в этом профиле `ossSignal`),
  помечается `notApplicable` и показывается отдельно, без драматизации.

### 4.8 Детекция эр

1. Признаки месяца: `commits`, `activeDays`, `distinctRepos`, `churn`,
   `filesPerCommitP50`, `testFileRatio`, `tsShare`, `conventionalRatio`.
2. Заполнить пропуски нулями, z-нормализовать по историческим данным.
3. Горизонт выбирается по длине истории, а не жёстко:
   - 24+ месяцев: бины по месяцам, `k` 3-6, термин "эра";
   - 12-23 месяцев: бины по месяцам, `k` 2-4, термин "эра";
   - 6-11 месяцев: бины по половине месяца, `k` 2-3, термин "фаза";
   - меньше 6 месяцев: одна фаза, `confidence: low`, честная подпись на экране.
4. Сегментация: агломеративная кластеризация соседних бинов, выбор `k` по
   максимальному силуэту в разрешённом диапазоне. Сид фиксирован.
5. Слияние слишком коротких сегментов (меньше 3 бинов) с соседом по минимальной
   дистанции центроидов.
6. Название генерируется по доминирующим признакам из шаблонов:
   `"<период>: <акцент>"`, например `"2026-05..2026-07: дизайн-системы"`.
7. Каждая фаза получает `turningPoints`: adoption-даты инструментов внутри периода.
8. Событие массового обслуживания (`mass-push`) не считается turning point и не
   влияет на сегментацию: оно исключается из признака активности.

Эры детерминированы: одинаковый снапшот -> одинаковый результат.

### 4.9 Инсайты

Правила в `shared/models/insight-rules.ts`. Формат правила:

```ts
export interface InsightRule {
  id: string;
  severity: "positive" | "neutral" | "attention";
  applies(ctx: InsightContext): boolean;
  render(ctx: InsightContext): { title: string; body: string; evidence: Evidence[] };
}
```

Обязательный набор правил v1:

| id                      | Условие                                                       |
| ----------------------- | ------------------------------------------------------------- |
| `tests-adopted`         | `testFileRatio` вырос более чем в 3 раза между эрами          |
| `ts-migration`          | появился `tsconfig.json` после 100+ коммитов                  |
| `ci-adopted`            | первый workflow появился позже 50-го коммита                  |
| `atomicity-improved`    | `filesPerCommitP50` упал >= 30% между первой и последней эрой |
| `conventional-adopted`  | `conventionalRatio` вырос до >= 60%                           |
| `abandonment-wave`      | >= 50% репозиториев в статусе Abandoned                       |
| `breadth-without-depth` | `breadth` высокий, а `depth` низкий два года подряд           |
| `plateau`               | `activeDaysRatio_90d` < 0.15, но коммиты есть                 |
| `revival`               | пауза > 180 дней, затем >= 20 коммитов за 60 дней             |
| `scaffold-heavy`        | `scaffoldRatio` > 25% в какой-либо эре                        |

Каждый инсайт обязан нести `evidence`: числа, период, имена репозиториев.
Инсайт без доказательств не рендерится. Максимум 8 карточек, сортировка по severity.

## 5. Информационная архитектура

| Маршрут         | Назначение                                                      |
| --------------- | --------------------------------------------------------------- |
| `/`             | Обзор: KPI, спарклайны, DMI, текущая эра, топ-3 инсайта         |
| `/timeline`     | Эры: горизонтальный таймлайн, точки перелома, drag-скраббер     |
| `/stack`        | Стек: динамика языков, Gantt технологий, breadth vs depth       |
| `/repos`        | Портфель: таблица, фильтры, спарклайны, бейджи статуса          |
| `/repos/[name]` | Детали: активность, чанж, дисциплина коммитов, дерево каталогов |
| `/craft`        | Ремесло: атомарность, conventional ratio, тесты, микс типов     |
| `/insights`     | Инсайты: карточки с доказательствами, фильтр по severity        |
| `/methodology`  | Формулы, веса, ограничения, что именно не измеряется            |

Общие требования:

- Единый `DashboardShell` с сайдбаром, хлебными крошками, командной палитрой (Cmd+K).
- Глобальный фильтр периода и репозитория в шапке, состояние в URL-параметрах.
- Каждый график имеет пустое состояние, состояние ошибки и подпись источника данных.
- Все числа рядом с определением метрики в `/methodology` (ссылка-иконка).

## 6. Маппинг библиотек из запроса

Три категории: спайн (реальные зависимости), порт (паттерн переносим руками),
референс (смотрим, не подключаем). Второго primitive-слоя в проекте не существует.

| Библиотека   | Категория | Как используется                                                    |
| ------------ | --------- | ------------------------------------------------------------------- |
| Untitled UI  | спайн     | Все компоненты: кнопки, поля, таблицы, модалки, секции, токены      |
| React Aria   | спайн     | Primitive-слой под Untitled UI: Table, DateRangePicker, Dialog      |
| Tremor       | спайн     | Только типы, которых нет у Untitled UI; палитры на токены темы      |
| dnd-kit      | спайн     | Реордер виджетов на `/` и скраббер периода на `/timeline`           |
| motion       | спайн     | Переходы страниц и счётчики, точечно; `LazyMotion` + reduced-motion |
| lucide-react | добор     | Иконки, которых нет в `@untitledui/icons`; stroke 1.5, 16/20/24     |
| shadcnblocks | порт      | Паттерны dashboard-shell, sidebar, KPI-секции                       |
| shadcnstudio | порт      | Паттерны карточек статистики и таблиц с фильтрами                   |
| shadcndeck   | порт      | Паттерны секций для `/methodology`                                  |
| magicui      | порт      | Идеи NumberTicker, BorderBeam; переписать на своих токенах          |
| shadcn/ui    | референс  | Не подключается: по умолчанию ставит Base UI                        |
| Base UI      | референс  | Не подключается: третий primitive-слой, нет таблиц и календаря      |
| Radix UI     | референс  | Не подключается: дублирует React Aria                               |
| design.dev   | референс  | Визуальные ориентиры, не зависимость                                |

Обязательные пакеты установки Untitled UI (не выводить вручную, ставить одной командой):

```bash
npm install @untitledui/icons react-aria-components \
  tailwindcss-react-aria-components tailwindcss-animate tailwind-merge
```

Бесплатный набор и распределение графиков:

| Тип графика        | Источник                      | Почему                           |
| ------------------ | ----------------------------- | -------------------------------- |
| Line, bar          | Untitled UI charts (free)     | Совпадает с дизайн-системой      |
| Pie, donut         | Untitled UI charts (free)     | То же                            |
| Radar (CraftRadar) | Untitled UI charts (free)     | То же                            |
| Area, stacked area | Tremor на токенах Untitled UI | В free-наборе нет                |
| Scatter            | Tremor на токенах Untitled UI | В free-наборе нет                |
| Tracker, sparkline | Tremor на токенах Untitled UI | В free-наборе нет                |
| Gantt технологий   | Своими силами на CSS-сетке    | Готового нет ни в free, ни в PRO |

Лицензионная граница (обязательно к соблюдению):

1. PRO не приобретён. Добавлять только компоненты со статусом free в документации.
2. CLI скачивает и PRO-ассеты: перед каждым `untitledui add` проверь страницу
   компонента на пометку free.
3. Каждый добавленный компонент фиксируется в `docs/ui-components.md`: имя,
   дата, ссылка на страницу, статус free.
4. Если нужного компонента нет в free - собираем сами на React Aria, а не тянем PRO.
5. Готовых страниц-примеров (dashboards, settings, marketing pages) в проекте нет:
   экраны компонуются из бесплатных блоков.

Правила порта и конфликтов:

1. **Порт, а не копия.** Блок из shadcn-маркетплейса переносится как структура:
   разметка, порядок секций, поведение. Классы, токены и иконки заменяются на
   Untitled UI. Готовый код shadcn-блока в проект не попадает.
2. **Иконки не смешиваются в одном компоненте.** Базовый набор — `@untitledui/icons`,
   потому что компоненты Untitled UI уже импортируют их. lucide допустим только там,
   где нужной иконки нет; в одном файле два набора не встречаются.
3. **Tremor не приносит свою палитру.** Цвета серий, сетки и осей маппятся на
   `chart-1..chart-6`, `border-secondary`, `text-tertiary` темы Untitled UI.
   Проверка: поиск по hex-литералам в `src/shared/components/charts/` даёт пусто.
4. **React Aria DnD не используется.** dnd-kit остаётся единственной системой
   перетаскивания, чтобы не держать два механизма доступности одновременно.
5. **CSS-состояния вместо библиотеки анимаций.** У React Aria есть
   `data-entering` / `data-exiting` и плагин `tailwindcss-react-aria-components`
   с вариантами `entering:` / `exiting:`. Появление оверлеев делается на CSS,
   `motion` подключается только там, где нужен счётчик чисел или layout-переход.
6. **Декоративные эффекты** (magicui-подобные): не более 3 на продукт, каждый
   с проверкой `prefers-reduced-motion` и CLS.

Почему не shadcn как основа (решение зафиксировано, менять только через ADR):

| Критерий         | React Aria (Untitled UI)                     | Base UI (shadcn по умолчанию) |
| ---------------- | -------------------------------------------- | ----------------------------- |
| Таблицы, деревья | Table, Tree, GridList, NavigationTree        | Нет                           |
| Даты и календарь | 6 компонентов, 13 календарных систем         | Нет                           |
| Drag and drop    | Встроен, с паритетом клавиатуры              | Нет                           |
| Локализация      | 34 bundle, включая `ru-RU`                   | Только `Intl`-пропсы          |
| Токены           | Готовый семантический слой, светлая и тёмная | Приносит свои из shadcn       |
| Кто ведёт        | Adobe, Apache-2.0                            | MUI, MIT                      |

## 7. Нефункциональные требования

| Категория   | Требование                                                          |
| ----------- | ------------------------------------------------------------------- |
| Доступность | WCAG 2.2 AA: контраст >= 4.5:1, фокус видим, клавиатурная навигация |
| Motion      | `MotionConfig reducedMotion="user"`, `LazyMotion` + `domAnimation`  |
| Производит. | Первый рендер < 1.5 s на среднем ноутбуке, CLS < 0.05               |
| Бандл       | Стартовый маршрут <= 200 kB gzip; графики — динамический импорт     |
| Данные      | Снапшот <= 2 MB, иначе разбить по годам и грузить лениво            |
| Тема        | Светлая и тёмная, переключение без вспышки, `color-scheme`          |
| Локализация | Русский UI, `Intl.NumberFormat("ru-RU")` и `Intl.DateTimeFormat`    |
| Приватность | Приватные репозитории: только агрегаты, без имён и URL              |

## 8. Тестовая стратегия

| Слой                     | Что тестируем                                          |
| ------------------------ | ------------------------------------------------------ |
| `shared/metrics/*`       | Юнит-тесты на фикстурах: границы, пустые данные, null  |
| `shared/models/eras`     | Детерминизм: один вход -> один выход, снапшот-тест     |
| `shared/models/dmi`      | Сумма весов = 1, диапазон 0..100, монотонность         |
| `shared/models/insights` | Срабатывание каждого правила на минимальной фикстуре   |
| `scripts/collect`        | Парсер манифестов и нормализация на записанных ответах |
| UI                       | Smoke-тесты рендера экранов с фикстурным снапшотом     |

Принцип из AI Rules: сначала падающий тест, потом фикс.

## 9. Критерии приёмки спеки

1. Все метрики из раздела 4 имеют функцию и тест.
2. Ни один экран не читает `data/snapshot` напрямую — только через `shared/metrics`.
3. Токен GitHub не встречается в `git grep` по репозиторию.
4. `/methodology` содержит формулу DMI дословно как в 4.7.
