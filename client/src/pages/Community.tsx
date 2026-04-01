import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import SearchBar from "../components/SearchBar";
import ResultsGrid from "../components/ResultsGrid";
import Pagination from "../components/Pagination";
import { getPublicDecks, savePublicDeck } from "../API/CommunityAPI";
import type { PublicDeckRow } from "../types/CommunityTypes";

const PAGE_SIZE = 6;

export default function Community() {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<PublicDeckRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  async function loadDecks(searchValue: string) {
    try {
      setLoading(true);
      setError("");

      const decks = await getPublicDecks(searchValue.trim());
      setResults(decks);
      setCurrentPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load results");
      setResults([]);
      setCurrentPage(1);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    await loadDecks(search);
  }

  async function handleSave(publicDeckId: number) {
    try {
      await savePublicDeck(publicDeckId);
      alert("Deck saved");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save deck");
    }
  }

  useEffect(() => {
    void loadDecks("");
  }, []);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  }, [results]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedResults = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return results.slice(start, end);
  }, [results, currentPage]);

  return (
    <AppShell pageTitle="Community">
      <div className="flex flex-col items-center">
        <SearchBar
          value={search}
          onSearchChange={setSearch}
          onSearchSubmit={handleSubmit}
        />
      </div>

      <ResultsGrid
        results={paginatedResults}
        loading={loading}
        error={error}
        onSave={handleSave}
      />

      {!loading && !error && results.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}
    </AppShell>
  );
}