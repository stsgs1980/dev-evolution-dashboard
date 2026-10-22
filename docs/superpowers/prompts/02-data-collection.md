# Промт 02: сбор данных (фаза 2)

```text
ФАЗА 2: Офлайн-сбор данных о GitHub-аккаунте.

ЦЕЛЬ. Скрипт, который из GitHub API и git собирает детерминированный снапшот,
который потом коммитится и становится единственным источником данных для UI.

СТРУКТУРА.
scripts/
  collect-github.ts        - CLI-точка входа, <= 250 строк
  collect/cli.ts           - разбор аргументов: --user, --since, --include-private, --out
  collect/github-client.ts - Octokit + троттлинг + backoff + обработка 202
  collect/fetch-repos.ts   - список репозиториев с пагинацией
  collect/fetch-commits.ts - коммиты через git (blobless clone) с fallback на API
  collect/fetch-stats.ts   - commitActivity, codeFrequency, punchCard, releases
  collect/fetch-search.ts  - PR и issues автора через Search API
  collect/parse-manifests.ts - история package.json: deps, devDeps, scripts, engines
  collect/normalize.ts     - приведение к схеме Snapshot, сортировка ключей
  collect/schema.ts        - zod-схема Snapshot + SnapshotSchema.parse
  collect/write.ts         - запись latest.json и датированного файла, атомарно

ПРАВИЛА.
1. Сеть только в этом слое. Ни одного fetch в src/.
2. Токен. Порядок разрешения в cli.ts, строго в этом порядке:
   a. process.env.GITHUB_TOKEN, если задан в шелле;
   b. .env.local в корне (читать через process.loadEnvFile, без dotenv-зависимости);
   c. `gh auth token`, если установлен GitHub CLI и выполнен вход;
   d. ничего не найдено -> анонимный режим с [WARNING] и отказом от статистических
      эндпоинтов (иначе сгорят все 60 запросов в час впустую).
   Создай .env.example с пустым GITHUB_TOKEN и комментарием, он коммитится.
   .env.local в .gitignore шаблона уже есть, проверка: git check-ignore -v .env.local.
   Скрипт запускается так, чтобы .env.local подхватывался:
   node --env-file=.env.local --import tsx scripts/collect-github.ts
   Никогда не логируй токен, не пиши его в снапшот и не выводи в stderr.
   Форма токена и права - docs/superpowers/specs/token-setup.md.
3. Статистика может отдать 202 (GitHub считает): 5 повторов с экспоненциальной
   задержкой, затем null и запись в snapshot.notes.
4. Отсутствующие значения - null, не 0 и не []. Это требование спеки, раздел 3.
5. Идемпотентность: одинаковый вход -> одинаковый снапшот. Сортируй массивы
   (репозитории по createdAt, коммиты по дате и sha), ключи объектов - стабильно.
6. Приватные репозитории при --include-private: только агрегаты без name и url,
   name заменяется на "private-<n>".
7. Прогресс в stderr, итоговая сводка в stdout: сколько репозиториев, коммитов,
   какие деградации.
8. Если репозиториев больше 100 или коммитов больше 20000 - предупреди и предложи
   --since за последние 5 лет, не обрезай молча.

CLI.
  npm run data:collect -- --user <username> [--since 2019-01-01]
      [--include-private] [--out data/snapshot]
  npm run data:validate         - валидация latest.json по схеме
  Оба скрипта добавь в package.json. Используй tsx для запуска .ts.

ТЕСТЫ (Vitest).
- parse-manifests: на трёх записанных фикстурах package.json (v1, v2, v3) ->
  корректные точки истории.
- normalize: стабильный порядок ключей, null вместо нулей.
- schema: валидный снапшот проходит, битый - падает с понятным сообщением.
Сеть в тестах не используется, только записанные ответы в tests/fixtures/.

DoD.
[ ] npm run data:collect -- --user <u> создаёт data/snapshot/latest.json.
[ ] data/snapshot/<u>-<YYYY-MM-DD>.json создаётся рядом.
[ ] npm run data:validate зелёный; испорченный файл - красный с указанием поля.
[ ] Повторный запуск даёт побайтово идентичный latest.json.
[ ] Все 8 гейтов зелёные, все файлы <= 250 строк.
[ ] Коммиты: feat(data): add github collector; feat(data): snapshot schema and validation.
[ ] git grep -n "github_pat_" -> пусто; .env.local не в git status.
[ ] Отчёт: размер снапшота, число репозиториев и коммитов, список notes.

Не переходи к метрикам, пока снапшот не готов.
```
