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
      <div className="flex min-h-screen">
        <SideBar />

        <main className="flex flex-1 flex-col p-6">
          <header className="mb-6 flex items-center justify-between rounded-3xl bg-white px-6 py-5 shadow-sm">
            <h1 className="text-3xl font-semibold text-slate-800">
              {pageTitle}
            </h1>

            {headerRight ? <div>{headerRight}</div> : null}
          </header>

        <section className="flex-1 rounded-3xl bg-slate-50 p-6 shadow-sm">
          {children}
        </section>
        </main>
      </div>
    </div>
  );
}