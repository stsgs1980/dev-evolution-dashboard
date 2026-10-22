# Промт 01: фундамент (фазы 0-1)

```text
ФАЗА 0-1: Kickoff и фундамент.

ШАГ 1. Согласование.
Прочитай BRIEF.md, спеку и план. Проверь открытые вопросы в README.md пакета брифа.
Задай мне все уточняющие вопросы ОДНИМ блоком, максимально конкретно:
  - какой GitHub username анализируем,
  - включаем ли приватные репозитории (только агрегаты, без имён),
  - какая таймзона для агрегации по дням,
  - нужен ли static export для GitHub Pages,
  - имя репозитория и проекта.
Кода на этом шаге не пиши. Дождись ответов.

ШАГ 2. Подготовка из шаблона (Steps 1-5 из docs/getting-started.md).
1. Обнови package.json: name, description, version 0.1.0.
2. README.template.md -> README.md, заполни Overview, Features, Tech Stack, Architecture.
3. Удали CHANGELOG.md шаблона и закоммить сброс.
4. Установи Next.js 15+ (App Router, TS, src dir, eslint, tailwind):
   npm install -D next @next/eslint-plugin-next eslint-plugin-testing-library
   npm install react react-dom
5. Tailwind CSS v4 через PostCSS, без tailwind.config.js (v4-подход, тема в CSS).
6. Untitled UI React: установи зависимости одной командой и подключи CLI:
   npm install @untitledui/icons react-aria-components \
     tailwindcss-react-aria-components tailwindcss-animate tailwind-merge
   npx untitledui@latest init --nextjs
   Затем добавь базовый набор компонентов через CLI (button, input, select, checkbox,
   table, tabs, modal, tooltip, dropdown, badge, progress, pagination, empty state,
   page header, sidebar navigation, filter bar, metrics, date picker).
   ЛИЦЕНЗИЯ: PRO не куплен. Перед каждым `untitledui add` проверь, что компонент
   помечен в документации как free. Данные компонента занеси в docs/ui-components.md:
   имя, дата, ссылка на страницу, статус free.
   ВАЖНО: shadcn/ui не устанавливать. Он по умолчанию ставит Base UI, это второй
   primitive-слой, запрещённый разделом 6 спеки и ADR по UI-экосистеме.

ШАГ 3. Каркас.
Создай структуру:
  src/app/(dashboard)/layout.tsx, page.tsx
  src/app/globals.css            - токены темы, светлая и тёмная
  src/features/                  - пустая, с .gitkeep
  src/shared/                    - components/ui (из Untitled UI), lib, metrics, models
  src/data/                      - сюда попадёт снапшот на фазе 2
  docs/ui-components.md          - манифест добавленных компонентов и их лицензий
  scripts/                       - скрипты сбора
Обнови tsconfig paths: "@/*" -> "./src/*".
Добавь скрипты: dev, build, start, data:collect (заглушка-заглушка не нужна:
скрипт появится на фазе 2, сейчас только поле в package.json без файла - не добавляй).

ШАГ 4. Гейты.
Прогони все 8 гейтов. Особое внимание check:docs: он валидирует inline-код
с префиксами docs/, scripts/, .husky/ в README и docs/. Если README ссылается на
ещё не существующий путь - убери ссылку или создай файл.
Проверь, что check-file-length не жалуется (всё <= 250 строк).

ЗАПРЕТЫ.
- Не проектировать UI дальше заглушки "Dashboard under construction".
- Не добавлять chart-библиотеки, motion и dnd-kit на этом шаге.
- Не создавать src/features/**/*.tsx, пока не готова фаза 8.
- Не ставить shadcn, Radix и Base UI: спайн - Untitled UI на React Aria.

DoD.
[ ] npm run dev открывает страницу с заглушкой и тёмной темой.
[ ] Все 8 гейтов зелёные.
[ ] docs/ui-components.md содержит все добавленные компоненты со статусом free.
[ ] Один коммит feat(next): bootstrap app router, второй feat(ui): untitled ui and tokens.
[ ] Отчёт: что установлено, какие версии, что осталось на фазу 2.
```
