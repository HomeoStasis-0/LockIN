import type { ReactNode } from "react"
import Sidebar from "./SideBar"
import Header from "./Header"

type AppShellProps = {
  pageTitle: string;
  children: ReactNode;
};

export default function AppShell({ pageTitle, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-slate-100">
      <Sidebar />
      <main className="ml-24 px-6 py-4">
        <Header title={pageTitle} />
        <section className="mt-4 rounded-3xl bg-white/40 p-6 shadow-sm backdrop-blur-md min-h-[75vh]">
          {children}
        </section>
      </main>
    </div>
  );
}