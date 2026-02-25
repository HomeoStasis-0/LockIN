export type UserRow = {
  user_id: number;
  username: string;
  email: string;
  password_hash: string;
  created_at: string; 
};

export type DeckRow = {
  id: number;
  user_id: number;
  deck_name: string;
  subject: string | null;
  course_number: number | null;
  instructor: string | null;
  created_at: string; 
};

export type CardRow = {
  id: number;
  deck_id: number;
  card_front: string;
  card_back: string;
  created_at: string; 
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  due_date: string | null;
  last_reviewed: string | null;
};

// stores a deck together with cards
export type DeckWithCards = DeckRow & {
  cards: CardRow[];
};