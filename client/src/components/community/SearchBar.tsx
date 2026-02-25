import { useMemo, useState } from "react";

type Props = {
  onSearchChange?: (q: string) => void;
  placeholder?: string;
};

export default function SearchBar({
  onSearchChange,
  placeholder = "Search public decks…",
}: Props) {
  const [q, setQ] = useState("");

  const id = useMemo(() => `community-search-${Math.random().toString(16).slice(2)}`, []);

  function update(next: string) {
    setQ(next);
    onSearchChange?.(next);
  }

  return (
    <div className="w-full">
      <label htmlFor={id} className="sr-only">
        Search community decks
      </label>

      <div className="relative">
        <input
          id={id}
          type="search"
          value={q}
          onChange={(e) => update(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border bg-white px-4 py-2.5 pr-10 text-sm outline-none ring-slate-900/10 focus:ring-4"
        />

        {q.length > 0 && (
          <button
            type="button"
            onClick={() => update("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}