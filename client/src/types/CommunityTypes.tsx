export type PublicDeckRow = {
  id: number;
  user_id: number;
  deck_name: string;
  subject: string | null;
  course_number: number | null;
  instructor: string | null;
  created_at: string;
};

export type PublicDeckCardRow = {
  id: number;
  public_deck_id: number;
  card_id: number;
};

//stores public deck together with cards
export type PublicDeckWithCards = PublicDeckRow & {
  cards: PublicDeckCardRow[];
};