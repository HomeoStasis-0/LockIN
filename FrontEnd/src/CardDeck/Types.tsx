export type Card = {
  id: string;
  front: string;
  back: string;
  tags?: string[];
  inReviewPile: boolean;
  dueAt: number;
  intervalDays: number;
};

export type Deck = {
  id: string;
  name: string;
  subject?: string;
  course?: string;
  prof?: string;
  cards: Card[];
};