import type { Metadata } from "next";
import type { ReactElement, ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "dev-evolution-dashboard",
  description: "Траектория профессионального развития по истории GitHub-аккаунта",
};

/**
 * Корневой layout: html/body, тёмная и светлая темы подключаются в фазе 5.
 * @param props - свойства layout с дочерними маршрутами
 * @returns html-обёртка приложения
 */
export default function RootLayout({ children }: Readonly<{ children: ReactNode }>): ReactElement {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
