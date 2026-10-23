# UI-компоненты: манифест Untitled UI

Сводка vendor-копии Untitled UI React в `src/vendor/untitled-ui/`. Источник
установки: `npx untitledui@latest init --nextjs` + `npx untitledui@latest add`
(см. ledger Фазы 1). Лицензия: только free tier; PRO не куплен, поэтому PRO
компоненты не устанавливались. Ссылки ведут в раздел документации библиотеки.

Дата добавления: 2026-10-22. Статус `free` подтверждён через метаданные CLI
(`access: public`). Два исключения - `application/app-navigation` и
`shared-assets/illustrations` - подтверждены косвенно: команда `untitledui add`
прошла без `login`, а PRO требует логина и ключа.

## Base

| Компонент           | Статус | Ссылка                                                |
| ------------------- | ------ | ----------------------------------------------------- |
| avatar              | free   | [untitledui.com/react](https://untitledui.com/react/) |
| badges              | free   | [untitledui.com/react](https://untitledui.com/react/) |
| button-group        | free   | [untitledui.com/react](https://untitledui.com/react/) |
| buttons             | free   | [untitledui.com/react](https://untitledui.com/react/) |
| checkbox            | free   | [untitledui.com/react](https://untitledui.com/react/) |
| dropdown            | free   | [untitledui.com/react](https://untitledui.com/react/) |
| form                | free   | [untitledui.com/react](https://untitledui.com/react/) |
| input               | free   | [untitledui.com/react](https://untitledui.com/react/) |
| progress-indicators | free   | [untitledui.com/react](https://untitledui.com/react/) |
| radio-buttons       | free   | [untitledui.com/react](https://untitledui.com/react/) |
| select              | free   | [untitledui.com/react](https://untitledui.com/react/) |
| tags                | free   | [untitledui.com/react](https://untitledui.com/react/) |
| textarea            | free   | [untitledui.com/react](https://untitledui.com/react/) |
| toggle              | free   | [untitledui.com/react](https://untitledui.com/react/) |
| tooltip             | free   | [untitledui.com/react](https://untitledui.com/react/) |

## Application

| Компонент         | Статус | Ссылка                                                |
| ----------------- | ------ | ----------------------------------------------------- |
| app-navigation    | free * | [untitledui.com/react](https://untitledui.com/react/) |
| date-picker       | free   | [untitledui.com/react](https://untitledui.com/react/) |
| empty-state       | free   | [untitledui.com/react](https://untitledui.com/react/) |
| loading-indicator | free   | [untitledui.com/react](https://untitledui.com/react/) |
| modals (modal)    | free   | [untitledui.com/react](https://untitledui.com/react/) |
| pagination        | free   | [untitledui.com/react](https://untitledui.com/react/) |
| table             | free   | [untitledui.com/react](https://untitledui.com/react/) |
| tabs              | free   | [untitledui.com/react](https://untitledui.com/react/) |

## Foundations

| Компонент     | Статус | Ссылка                                                |
| ------------- | ------ | ----------------------------------------------------- |
| dot-icon      | free   | [untitledui.com/react](https://untitledui.com/react/) |
| featured-icon | free   | [untitledui.com/react](https://untitledui.com/react/) |
| logo          | free   | [untitledui.com/react](https://untitledui.com/react/) |
| payment-icons | free   | [untitledui.com/react](https://untitledui.com/react/) |

## Shared assets

| Компонент           | Статус | Ссылка                                                |
| ------------------- | ------ | ----------------------------------------------------- |
| background-patterns | free   | [untitledui.com/react](https://untitledui.com/react/) |
| illustrations       | free * | [untitledui.com/react](https://untitledui.com/react/) |

## Поддержка

Хуки `src/vendor/untitled-ui/hooks/` (use-breakpoint, use-resize-observer),
утилиты `src/vendor/untitled-ui/utils/` (cx, is-react-component) и стили
`src/vendor/untitled-ui/styles/` (globals, theme, typography) поставлены тем же
CLI-потоком `untitledui add` и следуют той же лицензии.

## Правила использования

1. Проектный код импортирует vendor только как `@/vendor/untitled-ui/...`;
   прямое копирование компонентов дальше запрещено (спека: перетемливание
   через токены на фазе 5).
2. PRO-компоненты не добавляются: перед каждым `untitledui add` сверять статус
   с этой таблицей и документацией.
3. Гейты для vendor слоя ослаблены path-scoped (ADR 002
   в воркспейсе агента); проектный код остаётся под полными гейтами.
