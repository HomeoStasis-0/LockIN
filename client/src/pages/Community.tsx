import { useState } from "react";
import AppShell from "../components/AppShell";
import SearchBar from "../components/SearchBar";
import ResultsGrid from "../components/ResultsGrid";
import Pagination from "../components/Pagination";
import { getPublicDecks, savePublicDeck } from "../API/CommunityAPI";
import type { PublicDeckRow } from "../types/CommunityTypes";

export default function Community() {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<PublicDeckRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const resultsPerPage = 6;

  const totalPages = Math.ceil(results.length / resultsPerPage);
  const startIndex = (currentPage - 1) * resultsPerPage;
  const endIndex = startIndex + resultsPerPage;
  const currentResults = results.slice(startIndex, endIndex);

  async function handleSubmit() {
    try {
      setLoading(true);
      setError("");

      const decks = await getPublicDecks(search);
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

  async function handleSave(publicDeckId: number) {
  try {
    await savePublicDeck(publicDeckId);
    alert("Deck saved");
  } catch (err) {
    alert(err instanceof Error ? err.message : "Failed to save deck");
  }
}

  return (
    <AppShell pageTitle="Community">
      <div className="flex flex-col items-center">
        <SearchBar
          value={search}
          onSearchChange={setSearch}
          onSearchSubmit={handleSubmit}
        />
      </div>

      <div className="mt-8 w-full">
        <ResultsGrid
          results={currentResults}
          loading={loading}
          error={error}
          onSave={handleSave}
        />
      </div>

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