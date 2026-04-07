import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type BottomCardNavProps = {
  currentIndex: number;
  totalCards: number;
  setCurrentIndex: React.Dispatch<React.SetStateAction<number>>;
  holdStartDelay?: number;
  holdSpeed?: number;
  wrap?: boolean;
};

export default function BottomNav({
  currentIndex,
  totalCards,
  setCurrentIndex,
  holdStartDelay = 220,
  holdSpeed = 70,
  wrap = true,
}: BottomCardNavProps) {
  const holdTimeoutRef = useRef<number | null>(null);
  const holdIntervalRef = useRef<number | null>(null);

  function clearHoldTimers() {
    if (holdTimeoutRef.current !== null) {
      window.clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }

    if (holdIntervalRef.current !== null) {
      window.clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  }

  function goNext() {
    if (totalCards === 0) return;

    setCurrentIndex((prev) => {
      if (prev >= totalCards - 1) {
        return wrap ? 0 : prev;
      }
      return prev + 1;
    });
  }

  function goPrev() {
    if (totalCards === 0) return;

    setCurrentIndex((prev) => {
      if (prev <= 0) {
        return wrap ? totalCards - 1 : prev;
      }
      return prev - 1;
    });
  }

  function startHolding(direction: "prev" | "next") {
    clearHoldTimers();

    holdTimeoutRef.current = window.setTimeout(() => {
      holdIntervalRef.current = window.setInterval(() => {
        if (direction === "prev") {
          goPrev();
        } else {
          goNext();
        }
      }, holdSpeed);
    }, holdStartDelay);
  }

  function stopHolding() {
    clearHoldTimers();
  }

  useEffect(() => {
    return () => {
      clearHoldTimers();
    };
  }, []);

  const isEmpty = totalCards === 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={goPrev}
          onMouseDown={() => startHolding("prev")}
          onMouseUp={stopHolding}
          onMouseLeave={stopHolding}
          onTouchStart={() => startHolding("prev")}
          onTouchEnd={stopHolding}
          disabled={isEmpty}
          className="flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft size={18} />
          Prev
        </button>

        <div className="text-sm font-medium text-slate-600">
          {isEmpty ? "No cards" : `Card ${currentIndex + 1} of ${totalCards}`}
        </div>

        <button
          type="button"
          onClick={goNext}
          onMouseDown={() => startHolding("next")}
          onMouseUp={stopHolding}
          onMouseLeave={stopHolding}
          onTouchStart={() => startHolding("next")}
          onTouchEnd={stopHolding}
          disabled={isEmpty}
          className="flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}