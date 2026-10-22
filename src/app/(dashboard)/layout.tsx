import type { ReactElement, ReactNode } from "react";

/**
 * Layout группы dashboard: шелл с сайдбаром добавляется в фазе 5.
 * @param props - свойства layout с дочерними маршрутами
 * @returns контейнер содержимого экранов
 */
export default function DashboardLayout({ children }: { children: ReactNode }): ReactElement {
  return <div className="min-h-screen">{children}</div>;
}
