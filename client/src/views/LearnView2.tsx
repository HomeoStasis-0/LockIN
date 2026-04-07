import { useState } from "react";
import BottomCardNav from "../components/BottomNav";

type Card = {
  id: number;
  card_front: string;
  card_back: string;
};

type DeckViewerProps = {
  cards: Card[];
};

export default function LearnView2({ cards }: DeckViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentCard = cards[currentIndex];

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="mx-auto max-w-3xl px-4 pt-8">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          {currentCard ? (
            <>
              <h2 className="mb-3 text-xl font-bold text-slate-800">Front</h2>
              <p className="mb-8 text-slate-700">{currentCard.card_front}</p>

              <h2 className="mb-3 text-xl font-bold text-slate-800">Back</h2>
              <p className="text-slate-700">{currentCard.card_back}</p>
            </>
          ) : (
            <p className="text-slate-500">No cards found.</p>
          )}
        </div>
      </div>

      <BottomCardNav
        currentIndex={currentIndex}
        totalCards={cards.length}
        setCurrentIndex={setCurrentIndex}
        wrap={true}
      />
    </div>
  );
}