export type PublicDeckRow = {
  saved_id?: number;
  saved_by_user_id?: number;
  public_deck_id: number;
  deck_id: number;
  user_id: number;
  published_at: string;
  deck_name: string;
  subject: string | null;
  course_number: number | null;
  instructor: string | null;
  deck_created_at: string;
  card_count: number;
  is_saved: boolean;
};

export type PublicDeckCardRow = {
  id: number;
  public_deck_id: number;
  card_id: number;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  due_date: string | null;
  last_reviewed: string | null;
};

//stores public deck together with cards
export type PublicDeckWithCards = PublicDeckRow & {
  cards: PublicDeckCardRow[];
};