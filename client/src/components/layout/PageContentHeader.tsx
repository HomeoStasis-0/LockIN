import type { ReactNode } from "react";

type Props = {
  title?: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
};

export default function PageContentHeader({ title, subtitle, left, right }: Props) {
  return (
    <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
      {(title || subtitle) && (
        <div className="mb-4">
          {title && <h1 className="text-xl font-semibold">{title}</h1>}
          {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">{left}</div>
        <div className="shrink-0">{right}</div>
      </div>
    </section>
  );
}