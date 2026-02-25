import { useState } from "react";
import FilterPill from "./FilterPill";

type Sort = "trending" | "newest" | "most_saved";

export default function Filters() {
  const [sort, setSort] = useState<Sort>("trending");
  const [publicOnly, setPublicOnly] = useState(true);
  const [tags, setTags] = useState<string[]>(["CS", "Math"]);

  function toggleTag(tag: string) {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  function reset() {
    setSort("trending");
    setPublicOnly(true);
    setTags([]);
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      {/* Sort */}
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-slate-600">Sort</label>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="rounded-xl border bg-white px-3 py-2 text-sm"
          aria-label="Sort community decks"
        >
          <option value="trending">Trending</option>
          <option value="newest">Newest</option>
          <option value="most_saved">Most saved</option>
        </select>
      </div>

      {/* Public only */}
      <label className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm">
        <input
          type="checkbox"
          checked={publicOnly}
          onChange={(e) => setPublicOnly(e.target.checked)}
          className="h-4 w-4"
        />
        Public only
      </label>

      {/* Tags */}
      <div className="flex flex-wrap gap-2">
        <FilterPill active={tags.includes("CS")} onClick={() => toggleTag("CS")}>
          CS
        </FilterPill>
        <FilterPill active={tags.includes("Math")} onClick={() => toggleTag("Math")}>
          Math
        </FilterPill>
        <FilterPill active={tags.includes("Security")} onClick={() => toggleTag("Security")}>
          Security
        </FilterPill>
      </div>

      <button
        type="button"
        onClick={reset}
        className="rounded-xl border bg-white px-3 py-2 text-sm hover:bg-slate-50"
      >
        Reset
      </button>
    </div>
  );
}