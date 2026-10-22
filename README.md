# dev-evolution-dashboard

[![CI][ci-badge]][ci-workflow]
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22.22.2-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescript.org/)

> **Status**: ACTIVE
> **Last Updated**: 2026-10-22

## Overview

Персональный аналитический дашборд, который по истории GitHub-аккаунта восстанавливает
траекторию профессионального развития: точками перелома, фазами активности и практики
инженерного ремесла. Дашборд оценивает артефакты (коммиты, конфиги, тесты), а не
человека: любая интерпретация подписана как эвристика с раскрытой формулой на
`/methodology`.

Данные собираются офлайн-скриптом один раз и коммитятся в репозиторий как JSON-снапшот;
приложение работает без сети, детерминированно и без запросов к GitHub из браузера.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Scripts](#scripts)
- [Docs](#docs)
- [Architecture](#architecture)
- [Conventions](#conventions)
- [License](#license)

## Features

- Детекция фаз активности: кластеризация истории по месяцам с фиксированным сидом.
- Индекс зрелости DMI: составная оценка 0-100 с раскрытыми весами компонентов.
- Эволюция стека: динамика языков, Gantt технологий, breadth vs depth.
- Портфель репозиториев: таблица со статусами, спарклайны, drill-down по репо.
- Ремесло: атомарность коммитов, conventional ratio, тесты, микс типов.
- Инсайты: детерминированные правила с числами-доказательствами, без LLM.
- Тёмная и светлая темы, реордер виджетов, фильтры периода в URL.

## Tech Stack

- **Language**: TypeScript strict
- **Framework**: Next.js (App Router) + React 19
- **Design system**: Untitled UI React (free tier) на **React Aria Components**
- **Styling**: Tailwind CSS v4 (тема в CSS через `@theme`, без tailwind.config)
- **Charts**: Tremor raw, перетемлённый на токены Untitled UI
- **Testing**: Vitest
- **Quality**: ESLint, Stylelint, markdownlint, Prettier, Husky, Commitlint (из шаблона)

Один primitive-слой: React Aria. shadcn/ui, Base UI и Radix не подключаются даже как
зависимости; решение зафиксировано в `docs/superpowers/specs/ui-ecosystem.decision.md`.

## Getting Started

### Prerequisites

- Node.js >= 22.22.2 (в локальной среде - 24.15.0 из `.nvmrc`)
- npm >= 10.9.0 (`engine-strict` включён)

Pre-commit останавливается на первой ошибке: сначала `lint-staged`, затем проверка
длины файлов. Pre-push прогоняет `npm run typecheck` и `npm test`.

### Installation

```bash
npm install
npm run dev
```

Снапшот данных коммитится в `data/snapshot/`; приложение работает без сети.

## Scripts

| Команда                 | Описание                    |
| ----------------------- | --------------------------- |
| `npm run dev`           | Next.js dev-сервер          |
| `npm run build`         | Production сборка           |
| `npm start`             | Production сервер           |
| `npm run lint`          | ESLint                      |
| `npm run typecheck`     | TypeScript (`tsc --noEmit`) |
| `npm run lint:css`      | Stylelint                   |
| `npm run lint:md`       | markdownlint                |
| `npm run format`        | Prettier (запись)           |
| `npm run format:check`  | Prettier (проверка)         |
| `npm test`              | Vitest                      |
| `npm run test:watch`    | Vitest (watch)              |
| `npm run test:coverage` | Vitest + coverage           |
| `npm run check:docs`    | Сверка доков с конфигами    |

## Docs

| Документ                                      | О чём                                 |
| --------------------------------------------- | ------------------------------------- |
| [getting-started.md](docs/getting-started.md) | Фреймворк, `src/`, Tailwind, проверка |
| [webstorm.md](docs/webstorm.md)               | Настройка WebStorm                    |
| [testing.md](docs/testing.md)                 | Vitest, `jsdom`, Testing Library      |
| [markdown.md](docs/markdown.md)               | Правила оформления `.md`              |
| `docs/superpowers/specs/`                     | Спека метрик, решение по UI-тестеку   |
| `docs/superpowers/plans/`                     | План фаз 0-11                         |

## Architecture

```text
[ GitHub API + git ]  ->  data/snapshot/*.json  ->  shared/metrics (pure TS)  ->  UI
     (offline)              (committed)               (tested, no side effects)
```

Три слоя по спеке `docs/superpowers/specs/dev-evolution-dashboard.spec.md`:

- `scripts/` - сбор данных; единственное место с сетевым доступом к GitHub.
- `src/shared/` - метрики (`shared/metrics`) и модели (`shared/models`), чистые функции.
- `src/features/` и `src/app/` - экраны; чтение только снапшота, ноль сетевых вызовов.

## Conventions

Стиль кода: 2 пробела, точка с запятой, двойные кавычки, trailing commas, JSDoc для
публичного API, `const`/`let`. Anti-monolith: 250 строк на файл, 200 на компонент,
50 на функцию, 3+ `useState` -> кастомный хук. См. `.aiassistant/rules/AI Rules.md`.

## License

MIT

[ci-badge]: https://github.com/stsgs1980/dev-evolution-dashboard/actions/workflows/ci.yml/badge.svg
[ci-workflow]: https://github.com/stsgs1980/dev-evolution-dashboard/actions/workflows/ci.yml
