
-- Creates users, decks, cards, public decks, join tables, and ratings

-- Drop tables in dependency order to allow re-running this script
DROP TABLE IF EXISTS deck_cards CASCADE;
DROP TABLE IF EXISTS user_decks CASCADE;
DROP TABLE IF EXISTS public_deck_cards CASCADE;
DROP TABLE IF EXISTS user_public_decks CASCADE;
DROP TABLE IF EXISTS user_ratings CASCADE;
DROP TABLE IF EXISTS public_decks CASCADE;
DROP TABLE IF EXISTS cards CASCADE;
DROP TABLE IF EXISTS decks CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(150) NOT NULL UNIQUE,
    email VARCHAR(320) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Decks (owned by a user)
CREATE TABLE decks (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    deck_name TEXT NOT NULL,
    subject TEXT,
    course_number TEXT,
    instructor TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Join table: users who have access to (or saved) decks
CREATE TABLE user_decks (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    deck_id BIGINT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, deck_id)
);

-- Cards (belonging to a deck)
CREATE TABLE cards (
    id BIGSERIAL PRIMARY KEY,
    deck_id BIGINT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    card_front TEXT NOT NULL,
    card_back TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ease_factor REAL NOT NULL DEFAULT 2.5,
    interval_days INTEGER NOT NULL DEFAULT 0,
    repetitions INTEGER NOT NULL DEFAULT 0,
    due_date TIMESTAMPTZ,
    last_reviewed TIMESTAMPTZ
);

-- Join table: card membership in a deck (useful if cards can be shared between decks)
CREATE TABLE deck_cards (
    id BIGSERIAL PRIMARY KEY,
    deck_id BIGINT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    card_id BIGINT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    UNIQUE(deck_id, card_id)
);

-- Public decks (decks shared publicly)
CREATE TABLE public_decks (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    deck_name TEXT NOT NULL,
    subject TEXT,
    course_number TEXT,
    instructor TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Join table: mapping public decks to cards
CREATE TABLE public_deck_cards (
    id BIGSERIAL PRIMARY KEY,
    public_deck_id BIGINT NOT NULL REFERENCES public_decks(id) ON DELETE CASCADE,
    card_id BIGINT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    UNIQUE(public_deck_id, card_id)
);

-- Join table: users who have saved a public deck to their account
CREATE TABLE user_public_decks (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    public_deck_id BIGINT NOT NULL REFERENCES public_decks(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, public_deck_id)
);

-- User ratings for decks
CREATE TABLE user_ratings (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    deck_id BIGINT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, deck_id)
);

-- Helpful indexes
CREATE INDEX idx_cards_due_date ON cards(due_date);
CREATE INDEX idx_decks_user_id ON decks(user_id);
CREATE INDEX idx_public_decks_user_id ON public_decks(user_id);

-- Optional: grant minimal privileges example (uncomment and adjust role names)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO your_app_role;
