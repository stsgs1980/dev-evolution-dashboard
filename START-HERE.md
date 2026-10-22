# СТАРТ: что делать

Один файл вместо карты. Всё остальное в пакете - справочники, читать не обязательно.

## Шаг 1. Создать репозиторий (2 минуты)

```bash
gh repo create dev-evolution-dashboard --template stsgs1980/webstorm-config --clone
cd dev-evolution-dashboard
npm install
```

## Шаг 2. Скопировать пакет в репозиторий (1 минута)

Не нужно ничего копировать вручную. Скачай архив `evolution-dashboard-brief.zip`,
распакуй и запусти скрипт - он разложит файлы сам.

macOS / Linux / Git Bash:

```bash
cd ~/Downloads/evolution-dashboard-brief
./setup.sh ~/Projects/dev-evolution-dashboard
```

Windows PowerShell:

```powershell
cd ~\Downloads\evolution-dashboard-brief
.\setup.ps1 C:\Projects\dev-evolution-dashboard
```

Скрипт делает пять вещей: копирует `BRIEF.md`, `AUTONOMOUS-BRIEF.md`,
`START-HERE.md` и папку `docs/`, создаёт `.superpowers/`, дописывает
`.superpowers/` в `.prettierignore`, создаёт `.env.example` и проверяет,
что `.env.local` игнорируется.

Если скрипт не хочешь запускать, руками: перетащи в папку репозитория
`BRIEF.md`, `AUTONOMOUS-BRIEF.md`, `START-HERE.md` и папку `docs`, затем создай
пустую папку `.superpowers` и добавь строку `.superpowers/` в `.prettierignore`.

## Шаг 3. Токен (3 минуты)

1. github.com -> Settings -> Developer settings -> Fine-grained tokens -> Generate new token.
2. Name: `dev-evolution-dashboard-readonly`. Expiration: 90 days.
3. Repository access: **Public repositories (read-only)**.
4. Permissions: `Contents: Read-only`, `Metadata: Read-only`. Остальное - No access.
5. В корне репозитория создай файл `.env.local`:

```bash
GITHUB_TOKEN=github_pat_вставь_сюда
```

Токен в чат не отправляй. Он уже в `.gitignore`, push protection включён.

## Шаг 4. Вставить промт агенту

Открой чат AI Assistant в WebStorm, скопируй блок ниже целиком и отправь.

```text
Проект: dev-evolution-dashboard. Работаешь автономно, вопросы - только по триггерам.

ЧИТАЙ В ЭТОМ ПОРЯДОКЕ:
1. AUTONOMOUS-BRIEF.md - контракт автономности (разделы 3, 4, 10, 11, 13).
2. BRIEF.md - что за продукт, стек, скоуп.
3. docs/superpowers/specs/dev-evolution-dashboard.spec.md - модель данных и формулы.
4. docs/superpowers/specs/calibration.report.md - факты профиля stsgs1980.
5. docs/superpowers/specs/ui-ecosystem.decision.md - UI-стек и лицензия free-tier.
6. docs/superpowers/plans/dev-evolution-dashboard.plan.md - фазы 0-11.
7. .aiassistant/rules/AI Rules.md - правила шаблона.

ВХОДНЫЕ ДАННЫЕ (уже решены, не спрашивай):
- username: stsgs1980
- приватные репозитории: выключены
- таймзона: Europe/Moscow
- деплой: не делаем
- инсайты: детерминированные правила, без LLM
- лицензия Untitled UI: только free tier, PRO-компоненты запрещены

ПОДГОТОВКА ДО КОДА:
1. Создай .superpowers/state.md, ledger.md, decisions/, reports/ по шаблонам из
   docs/superpowers/templates/.
2. Проверь git rev-parse --is-shallow-repository; если shallow - git fetch --unshallow.
3. Заполни state.md: фаза 0, план фазы 1.
4. Первый ответ - только чтение и вопросы, если есть. Кода не пиши.

ДАЛЬШЕ: фазы 0-11 по плану. На каждой фазе:
- прочитай соответствующий промт из docs/superpowers/prompts/ (01-08),
- выполни, прогони 8 гейтов, прогони саморевью по prompts/99,
- обнови state.md и ledger.md, коммит в Conventional Commits.
- Не начинай следующую фазу, пока все гейты не зелёные.

ГЕЙТЫ (на каждой фазе):
npm run lint && npm run typecheck && npm run lint:css && npm run lint:md \
  && npm run format:check && npm test && npm run check:file-length -- --all \
  && npm run check:docs

ЖЁСТКИЕ ЗАПРЕТЫ:
- console.log (только warn/error); в скриптах process.stdout.write.
- shadcn, Radix, Base UI, cmdk как зависимости. Спайн: Untitled UI на React Aria.
- PRO-компоненты Untitled UI. Только free, с записью в docs/ui-components.md.
- Сетевые вызовы к GitHub вне scripts/.
- Токен в коде, снапшоте, логах или коммите.
- Обход хуков: --no-verify, HUSKY=0.
- Анти-монолит: 250 строк файл, 200 компонент, 50 функция, 3+ useState -> хук.

ФОРМАТ ОТВЕТА: начинай каждый ответ строкой
[INFO] Фаза <N>/11 - <название> - шаг <k> - гейты: <OK|FAIL>

СТОП: только по 8 триггерам из раздела 4 AUTONOMOUS-BRIEF.md. При остановке -
отчёт по формату prompts/12-escalation.md и ждать.

Начинай с подготовки .superpowers/ и чтения документов.
```

## Шаг 5. Первый сбор данных вручную (5 минут)

Агент дойдёт до фазы 2 и попросит снапшот. Лучше сделать самому - токен не покинет
машину:

```bash
npm run data:collect -- --user stsgs1980
npm run data:validate
git add data/snapshot && git commit -m "feat(data): collect initial snapshot"
```

Скажи агенту: `Снапшот собран, продолжай с фазы 3.`

## Шаг 6. Приёмка

Агент закончит фазой 11. Проверять по 10 пунктам из раздела 14 `AUTONOMOUS-BRIEF.md`.

---

## Где что лежит

Нужно агенту (он прочитает сам):

- `AUTONOMOUS-BRIEF.md` - контракт: уровни решений, триггеры, границы, DoD.
- `BRIEF.md` - продукт, стек, скоуп, anti-goals.
- `docs/superpowers/specs/` - модель данных, формулы метрик, UI-решение, факты профиля.
- `docs/superpowers/plans/` - 12 фаз с DoD.
- `docs/superpowers/prompts/` - промт на каждую фазу (`01`-`08`), восстановление
  после сбоя (`11`), отчёт об остановке (`12`), саморевью (`99`).

Тебе по необходимости:

- `docs/superpowers/specs/token-setup.md` - если токен не заводится.
- `docs/superpowers/specs/calibration.report.md` - цифры по профилю.
- `docs/kickoff.md` и `prompts/00`-`01` - только если хочешь режим с диалогом
  на каждом шаге вместо автономного.

Не нужно читать: `README.md` пакета, `templates/`, `prompts/10`, `12`, `99`.

## Если что-то пошло не так

| Симптом                     | Что делать                                                                         |
| --------------------------- | ---------------------------------------------------------------------------------- |
| Агент задаёт вопросы пачкой | Он не прочитал раздел 4 брифа. Скажи: "дефолты из раздела 12, триггеры только 1-8" |
| Контекст сессии потерян     | Вставь `docs/superpowers/prompts/11-autonomous-loop.md`                            |
| Агент остановился и молчит  | Ждёт ответа. Смотри его отчёт по `12`                                              |
| Гейт красный и не чинится   | `docs/superpowers/prompts/99-review-mode.md`                                       |
| Хочешь прервать и проверить | `npm test && npm run check:file-length -- --all`                                   |
