# Промт 08: motion, качество, релиз (фазы 9-11)

```text
ФАЗЫ 9-11: Анимации, drag-and-drop, полировка, релиз.

ЧАСТЬ А. Motion (фаза 9).

1. Установи motion. Используй LazyMotion с domAnimation и m вместо motion, чтобы
   не тянуть полный бандл.
2. MotionConfig reducedMotion="user" в корне. Дополнительно провайдер темы не должен
   ломать prefers-reduced-motion.
3. Что анимируем (и только это):
   - переходы между экранами: мягкий fade + 8px сдвиг, 180 мс, ease-out;
   - появление графиков: reveal с задержкой 60 мс по индексу карточки;
   - NumberTicker на KPI: 600 мс, easing out, уважает reduced-motion (иначе сразу
     финальное число);
   - hover-состояния карточек: тень и 2px подъём, 120 мс.
4. Декоративные эффекты (максимум 3 на весь продукт): один BorderBeam на hero-карточке
   обзора, AnimatedBeam на /stack между выбранными технологиями, Meteors - не используем.
   Каждый проверен на reduced-motion и на CLS.
5. dnd-kit для реордера виджетов на /:
   - sensors: PointerSensor с activationConstraint 8px + KeyboardSensor;
   - accessible: announcements на русском, aria-live;
   - порядок сохраняется в localStorage, кнопка "Сбросить раскладку";
   - при reduced-motion анимация перетаскивания отключается, но функция работает.
6. Drag-скраббер на /timeline: перетаскивание ручек меняет period в URL.

DoD части А.
[ ] При reducedMotion="reduce" нет ни одной анимации (проверить в DevTools).
[ ] Реордер работает с клавиатуры (Space, стрелки, Space, Esc отменяет).
[ ] CLS < 0.05 на всех экранах (Lighthouse).
[ ] Коммиты: feat(motion)..., feat(dnd)..., feat(timeline): period scrubber.

ЧАСТЬ Б. Качество (фаза 10).

1. /insights: довести карточки до финального вида, evidence раскрывается details/summary
   или Disclosure из React Aria. Проверь каждую карточку глазами против графика.
2. /methodology: MDX через next-mdx-remote, контент в src/features/methodology/content/.
   Оглавление, якоря, подсветка формул (katex только если реально нужен - иначе
   код-блоки). Все 8 групп метрик + DMI + эры + инсайты + дисклеймер.
3. Сверка чисел: прогони скрипт npm run report (консольный вывод всех ключевых метрик)
   и сравни с экранами. Расхождения - баг, не "погрешность".
4. Проверка утечки токена: git grep -n "ghp_\|github_pat_" -> пусто.
5. Лицензии UI: docs/ui-components.md содержит все компоненты Untitled UI со
   статусом free, ссылки живые, PRO-компонентов нет.

DoD части Б.
[ ] Ни одного инсайта без evidence.
[ ] /methodology содержит формулу DMI дословно как в спеке 4.7.
[ ] Скрипт report даёт те же числа, что и UI.

ЧАСТЬ В. Релиз (фаза 11).

1. Lighthouse на / и /craft: a11y >= 95, performance >= 90, best-practices >= 95.
2. Бандл: npx @next/bundle-analyzer. Стартовый маршрут <= 200 kB gzip.
   Тяжёлое - в динамический импорт.
3. Контраст и фокус: пройти все интерактивные элементы только клавиатурой.
4. Доки: README по README.template.md (Overview, Features, Tech Stack, Architecture,
   Scripts, Docs), docs/ обновить, скриншоты двух тем приложить.
5. CHANGELOG: npm run changelog, закоммитить.
6. Тэг v1.0.0, аннотированный, с текстом "dev-evolution-dashboard v1.0.0".

Финальный чеклист (выведи его с отметками).
[ ] npm run lint
[ ] npm run typecheck
[ ] npm run lint:css
[ ] npm run lint:md
[ ] npm run format:check
[ ] npm test
[ ] npm run check:file-length
[ ] npm run check:docs
[ ] git grep по токену - пусто
[ ] Все компоненты Untitled UI в docs/ui-components.md помечены free
[ ] Lighthouse: a11y 95+, perf 90+
[ ] Все 8 маршрутов открываются, данные реальные
[ ] README и CHANGELOG актуальны
[ ] Тэг v1.0.0

Отчёт: итоговая таблица "фаза - коммит - DoD закрыт", список отклонений от спеки
с обоснованием, что ушло в backlog.
```
