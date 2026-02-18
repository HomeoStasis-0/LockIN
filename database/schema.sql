BEGIN;

-- ---------- User ----------
CREATE TABLE "User" (
  user_id        BIGSERIAL PRIMARY KEY,
  username       TEXT NOT NULL UNIQUE,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Deck ----------
CREATE TABLE "Deck" (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES "User"(user_id) ON DELETE CASCADE,
  deck_name     TEXT NOT NULL,
  subject       TEXT,
  course_number INTEGER,
  instructor    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Card ----------
CREATE TABLE "Card" (
  id            BIGSERIAL PRIMARY KEY,
  deck_id       BIGINT NOT NULL REFERENCES "Deck"(id) ON DELETE CASCADE,
  card_front    TEXT NOT NULL,
  card_back     TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ease_factor   REAL NOT NULL DEFAULT 2.5,
  interval_days INTEGER NOT NULL DEFAULT 0,
  repetitions   INTEGER NOT NULL DEFAULT 0,
  due_date      TIMESTAMPTZ,
  last_reviewed TIMESTAMPTZ
);

-- ---------- PublicDeck ----------
CREATE TABLE "PublicDeck" (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES "User"(user_id) ON DELETE CASCADE,
  deck_name     TEXT NOT NULL,
  subject       TEXT,
  course_number INTEGER,
  instructor    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Join Tables ----------
CREATE TABLE "UserDeck" (
  id      BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES "User"(user_id) ON DELETE CASCADE,
  deck_id BIGINT NOT NULL REFERENCES "Deck"(id) ON DELETE CASCADE,
  UNIQUE (user_id, deck_id)
);

CREATE TABLE "DeckCard" (
  id      BIGSERIAL PRIMARY KEY,
  deck_id BIGINT NOT NULL REFERENCES "Deck"(id) ON DELETE CASCADE,
  card_id BIGINT NOT NULL REFERENCES "Card"(id) ON DELETE CASCADE,
  UNIQUE (deck_id, card_id)
);

CREATE TABLE "PublicDeckCard" (
  id             BIGSERIAL PRIMARY KEY,
  public_deck_id BIGINT NOT NULL REFERENCES "PublicDeck"(id) ON DELETE CASCADE,
  card_id        BIGINT NOT NULL REFERENCES "Card"(id) ON DELETE CASCADE,
  UNIQUE (public_deck_id, card_id)
);

CREATE TABLE "UserPublicDeck" (
  id             BIGSERIAL PRIMARY KEY,
  user_id        BIGINT NOT NULL REFERENCES "User"(user_id) ON DELETE CASCADE,
  public_deck_id BIGINT NOT NULL REFERENCES "PublicDeck"(id) ON DELETE CASCADE,
  UNIQUE (user_id, public_deck_id)
);

-- ---------- UserRating ----------
CREATE TABLE "UserRating" (
  id      BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES "User"(user_id) ON DELETE CASCADE,
  deck_id BIGINT NOT NULL REFERENCES "Deck"(id) ON DELETE CASCADE,
  rating  INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  UNIQUE (user_id, deck_id)
);

-- ---------- Helpful indexes ----------
CREATE INDEX idx_deck_user_id            ON "Deck"(user_id);
CREATE INDEX idx_card_deck_id            ON "Card"(deck_id);
CREATE INDEX idx_publicdeck_user_id      ON "PublicDeck"(user_id);

CREATE INDEX idx_userdeck_user_id        ON "UserDeck"(user_id);
CREATE INDEX idx_userdeck_deck_id        ON "UserDeck"(deck_id);

CREATE INDEX idx_deckcard_deck_id        ON "DeckCard"(deck_id);
CREATE INDEX idx_deckcard_card_id        ON "DeckCard"(card_id);

CREATE INDEX idx_publicdeckcard_pd_id    ON "PublicDeckCard"(public_deck_id);
CREATE INDEX idx_publicdeckcard_card_id  ON "PublicDeckCard"(card_id);

CREATE INDEX idx_userpublicdeck_user_id  ON "UserPublicDeck"(user_id);
CREATE INDEX idx_userpublicdeck_pd_id    ON "UserPublicDeck"(public_deck_id);

CREATE INDEX idx_userrating_user_id      ON "UserRating"(user_id);
CREATE INDEX idx_userrating_deck_id      ON "UserRating"(deck_id);

COMMIT; 