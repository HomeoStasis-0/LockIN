BEGIN;

-- ---------- Users ----------
CREATE TABLE users (
  user_id        BIGSERIAL PRIMARY KEY,
  username       TEXT NOT NULL UNIQUE,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Deck ----------
CREATE TABLE deck (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  deck_name     TEXT NOT NULL,
  subject       TEXT,
  course_number INTEGER,
  instructor    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Card ----------
CREATE TABLE card (
  id            BIGSERIAL PRIMARY KEY,
  deck_id       BIGINT NOT NULL REFERENCES deck(id) ON DELETE CASCADE,
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
CREATE TABLE public_deck (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  deck_name     TEXT NOT NULL,
  subject       TEXT,
  course_number INTEGER,
  instructor    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Join Tables ----------
CREATE TABLE user_deck (
  id      BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  deck_id BIGINT NOT NULL REFERENCES deck(id) ON DELETE CASCADE,
  UNIQUE (user_id, deck_id)
);

CREATE TABLE deck_card (
  id      BIGSERIAL PRIMARY KEY,
  deck_id BIGINT NOT NULL REFERENCES deck(id) ON DELETE CASCADE,
  card_id BIGINT NOT NULL REFERENCES card(id) ON DELETE CASCADE,
  UNIQUE (deck_id, card_id)
);

CREATE TABLE public_deck_card (
  id             BIGSERIAL PRIMARY KEY,
  public_deck_id BIGINT NOT NULL REFERENCES public_deck(id) ON DELETE CASCADE,
  card_id        BIGINT NOT NULL REFERENCES card(id) ON DELETE CASCADE,
  UNIQUE (public_deck_id, card_id)
);

CREATE TABLE user_public_deck (
  id             BIGSERIAL PRIMARY KEY,
  user_id        BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  public_deck_id BIGINT NOT NULL REFERENCES public_deck(id) ON DELETE CASCADE,
  UNIQUE (user_id, public_deck_id)
);

-- ---------- UserRating ----------
CREATE TABLE user_rating (
  id      BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  deck_id BIGINT NOT NULL REFERENCES deck(id) ON DELETE CASCADE,
  rating  INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  UNIQUE (user_id, deck_id)
);

-- ---------- Helpful indexes ----------
CREATE INDEX idx_deck_user_id            ON deck(user_id);
CREATE INDEX idx_card_deck_id            ON card(deck_id);
CREATE INDEX idx_publicdeck_user_id      ON public_deck(user_id);

CREATE INDEX idx_userdeck_user_id        ON user_deck(user_id);
CREATE INDEX idx_userdeck_deck_id        ON user_deck(deck_id);

CREATE INDEX idx_deckcard_deck_id        ON deck_card(deck_id);
CREATE INDEX idx_deckcard_card_id        ON deck_card(card_id);

CREATE INDEX idx_publicdeckcard_pd_id    ON public_deck_card(public_deck_id);
CREATE INDEX idx_publicdeckcard_card_id  ON public_deck_card(card_id);

CREATE INDEX idx_userpublicdeck_user_id  ON user_public_deck(user_id);
CREATE INDEX idx_userpublicdeck_pd_id    ON user_public_deck(public_deck_id);

CREATE INDEX idx_userrating_user_id      ON user_rating(user_id);
CREATE INDEX idx_userrating_deck_id      ON user_rating(deck_id);

COMMIT;
