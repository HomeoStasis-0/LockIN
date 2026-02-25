import type { ReactNode } from "react";

export default function PageContent({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      {children}
    </main>
  );
}