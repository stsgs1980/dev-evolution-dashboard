import type { ReactElement } from "react";

/**
 * Заглушка обзора до фазы 8: рендер подтверждает работу App Router.
 * @returns SSR-совместимая заглушка без данных
 */
export default function OverviewPage(): ReactElement {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Dashboard under construction</h1>
        <p className="mt-2 text-sm text-neutral-500">Экраны появятся в фазе 8 на реальном снапшоте.</p>
      </div>
    </main>
  );
}
