import PageLayout from "../components/layout/PageLayout";
import Navbar from "../components/nav/Navbar";
import PageContent from "../components/layout/PageContent";
import PageContentHeader from "../components/layout/PageContentHeader";
import SearchBar from "../components/community/SearchBar";

export default function Community() {
  return (
    <PageLayout>
      <Navbar />

      <PageContent>
        <PageContentHeader
          title="Community"
          subtitle="Explore public decks and collections shared by other users."
          left={<SearchBar />}
        />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border bg-white p-4 shadow-sm">Deck card placeholder</div>
          <div className="rounded-xl border bg-white p-4 shadow-sm">Deck card placeholder</div>
          <div className="rounded-xl border bg-white p-4 shadow-sm">Deck card placeholder</div>
        </div>
      </PageContent>
    </PageLayout>
  );
}