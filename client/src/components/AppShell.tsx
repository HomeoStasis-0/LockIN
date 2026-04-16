import type { ReactNode } from "react";
import SideBar from "./SideBar";

type AppShellProps = {
  pageTitle: string;
  children: ReactNode;
  headerRight?: ReactNode;
};

export default function AppShell({
  pageTitle,
  children,
  headerRight,
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="flex min-h-screen flex-col sm:flex-row">
        <SideBar />

        <main className="flex flex-1 flex-col p-3 sm:p-6">
          <header className="mb-4 flex flex-col gap-3 rounded-2xl bg-white px-4 py-4 shadow-sm sm:mb-6 sm:flex-row sm:items-center sm:justify-between sm:rounded-3xl sm:px-6 sm:py-5">
            <h1 className="text-2xl font-semibold text-slate-800 sm:text-3xl">
              {pageTitle}
            </h1>

            {headerRight ? <div>{headerRight}</div> : null}
          </header>

          <section className="flex-1 rounded-2xl bg-slate-50 p-3 shadow-sm sm:rounded-3xl sm:p-6">
            {children}
          </section>
        </main>
      </div>
    </div>
  );
}