# Промт 03: слой метрик (фаза 3)

```text
ФАЗА 3: Чистые метрики.

ЦЕЛЬ. Реализовать раздел 4 спеки как чистые функции. Никакой сети, никакого React,
никаких side effects. Вход - Snapshot, выход - MetricResult<T>.

СТРУКТУРА src/shared/metrics/.
  types.ts          - MetricResult<T>, Confidence, Period, MetricsOptions
  period.ts         - парсинг и пересечение периодов, пресеты (30d, 90d, 1y, all)
  activity.ts       - 4.1: commitsPerMonth, activeDays, streak, activeDaysRatio,
                      cadence, burstiness
  churn.ts          - 4.2: churnPerMonth, netLines, churnRatio, codeVolume
  granularity.ts    - 4.3: filesPerCommit p50/p95, giantCommitShare, commitLocMedian
  craft.ts          - 4.4: adoptionDate, testFileRatio, conventionalRatio,
                      commitTypeMix, scaffoldRatio, avgSubjectLength
  stack.ts          - 4.5: languageShareByQuarter, frameworkTimeline, breadth,
                      depth, newTechRate
  portfolio.ts      - 4.6: lifespan, activeSpan, status, health, commitSparkline
  index.ts          - реэкспорт, дерево функций без побочных эффектов

ПРАВИЛА.
1. Каждая функция возвращает MetricResult с полями value, confidence, basis, notes.
   basis - человекочитаемое доказательство: "<N> репозиториев, <M> коммитов, <период>".
   confidence: high при полных данных, medium при наличии null в статистике,
   low при сэмплировании коммитов.
2. Ноль и отсутствие данных - разные вещи. Если GitHub не отдал статистику, это null,
   и метрика об этом говорит в notes.
3. Перцентили - только линейная интерполяция, функция percentile(values, p) в
   shared/metrics/stats.ts, покрыта тестами на граничных случаях (пустой массив,
   одно значение, дубликаты).
4. Таймзона агрегации берётся из snapshot.meta.timezone, не из системы.
5. Энтропия Шеннона: нормируй на log2(число категорий), защити от деления на ноль.
6. Все логарифмы - десятичные, аргумент через Math.max(0, x).
7. Языки с числом коммитов < 20 не считаются за breadth (штраф 0.5 из спеки).
8. Ни одна функция не длиннее 50 строк. Сложные - дроби на приватные хелперы.

ТЕСТЫ.
- Фикстуры в tests/fixtures/snapshots/: real-small, real-typical, empty, nulls,
  single-day, huge-gap.
- На каждую метрику минимум три кейса: норма, пустой вход, граница (один коммит,
  один день, все null).
- Проверки: диапазон значений, отсутствие NaN и Infinity, стабильность повторных
  вызовов.
- Цель покрытия: >= 80% по функциям в shared/metrics.
- Проверяй покрытие: npm run test:coverage.

DoD.
[ ] Все метрики из 4.1-4.6 спеки реализованы и экспортированы из index.ts.
[ ] Покрытие shared/metrics >= 80%.
[ ] Ни одного NaN/Infinity ни на одной фикстуре.
[ ] Все 8 гейтов зелёные, каждый файл <= 250 строк.
[ ] Коммиты: feat(metrics): activity and churn; feat(metrics): craft and stack;
    test(metrics): edge cases and nulls.
[ ] Отчёт: таблица метрик с примером значения на реальном снапшоте.

Не переходи к моделям (эры, DMI, инсайты), пока метрики не готовы.
```
