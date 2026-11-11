-- TimeWarp schema (v1). Safe to run repeatedly.
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'editor', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS eras (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    start_year INTEGER,
    end_year INTEGER,
    description TEXT,
    CHECK (start_year IS NULL OR end_year IS NULL OR start_year <= end_year)
);

CREATE TABLE IF NOT EXISTS destinations (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    country VARCHAR(100),
    description TEXT,
    era_id BIGINT REFERENCES eras(id) ON DELETE SET NULL,
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    event_year INTEGER NOT NULL,
    category VARCHAR(60),
    description TEXT,
    destination_id BIGINT REFERENCES destinations(id) ON DELETE SET NULL,
    image_url TEXT,
    source_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS predictions (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    target_year INTEGER NOT NULL,
    category VARCHAR(100),
    description TEXT NOT NULL,
    assumptions TEXT,
    author VARCHAR(100),
    last_reviewed DATE,
    confidence_level VARCHAR(30),
    is_speculative BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journeys (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    destination_id BIGINT REFERENCES destinations(id) ON DELETE SET NULL,
    selected_year INTEGER NOT NULL,
    travel_type VARCHAR(20) NOT NULL CHECK (travel_type IN ('past', 'present', 'future')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS media (
    id BIGSERIAL PRIMARY KEY,
    event_id BIGINT REFERENCES events(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    caption TEXT,
    credit TEXT,
    media_type VARCHAR(30) NOT NULL DEFAULT 'image'
);

CREATE TABLE IF NOT EXISTS quiz_questions (
    id BIGSERIAL PRIMARY KEY,
    question TEXT NOT NULL,
    options JSONB NOT NULL,
    correct_answer VARCHAR(255) NOT NULL,
    explanation TEXT,
    difficulty VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(20) NOT NULL,
    resource VARCHAR(50) NOT NULL,
    record_id BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_year ON events(event_year);
CREATE INDEX IF NOT EXISTS idx_events_destination ON events(destination_id);
CREATE INDEX IF NOT EXISTS idx_destinations_country ON destinations(country);
CREATE INDEX IF NOT EXISTS idx_predictions_year ON predictions(target_year);
CREATE INDEX IF NOT EXISTS idx_journeys_user_created ON journeys(user_id, created_at DESC);

-- Immersive full-screen scene shown right after time travel (image or looping video).
-- Pick the row whose year range contains the chosen year; a destination-specific row wins over a general one.
CREATE TABLE IF NOT EXISTS scenes (
    id BIGSERIAL PRIMARY KEY,
    mode VARCHAR(20) NOT NULL CHECK (mode IN ('past', 'present', 'future')),
    year_from INTEGER NOT NULL,
    year_to INTEGER NOT NULL,
    destination_id BIGINT REFERENCES destinations(id) ON DELETE CASCADE,
    title VARCHAR(200),
    media_type VARCHAR(10) NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
    media_url TEXT NOT NULL,
    poster_url TEXT,
    credit TEXT,
    CHECK (year_from <= year_to)
);
CREATE INDEX IF NOT EXISTS idx_scenes_lookup ON scenes(mode, year_from, year_to);

-- ---------- v2: globe coordinates, 3D models, achievements ----------
ALTER TABLE destinations ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE destinations ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE scenes ADD COLUMN IF NOT EXISTS model_url TEXT;          -- optional .glb for /explore
ALTER TABLE scenes ALTER COLUMN media_url DROP NOT NULL;              -- a scene may be 3D-only

-- No foreign keys to content tables on purpose: re-seeding content must not wipe user progress.
CREATE TABLE IF NOT EXISTS visits (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mode VARCHAR(20) NOT NULL,
    year INTEGER NOT NULL,
    destination_id BIGINT,
    era_id BIGINT,
    visited_on DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_visits_user ON visits(user_id, visited_on);

CREATE TABLE IF NOT EXISTS user_badges (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_code VARCHAR(60) NOT NULL,
    earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, badge_code)
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    total INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user ON quiz_attempts(user_id, created_at);

-- v9 Save System: one save slot per user. "life" is the whole Life Mode JSON, the rest is the Live World progress.
CREATE TABLE IF NOT EXISTS saves (
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    last_mode VARCHAR(10) NOT NULL DEFAULT 'life' CHECK (last_mode IN ('life', 'world')),
    era VARCHAR(10) NOT NULL DEFAULT 'present' CHECK (era IN ('past', 'present', 'future')),
    year INTEGER,
    destination_id BIGINT,
    position JSONB,
    money INTEGER NOT NULL DEFAULT 0,
    mission_progress INTEGER NOT NULL DEFAULT 0,
    life JSONB,
    saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- v11: Time Machine upgrades, language and points live in saves.meta; the Life leaderboard keeps one best verified life per user.
ALTER TABLE saves ADD COLUMN IF NOT EXISTS meta JSONB;
CREATE TABLE IF NOT EXISTS life_scores (
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(40) NOT NULL,
    score INTEGER NOT NULL,
    title VARCHAR(80) NOT NULL DEFAULT '',
    age INTEGER NOT NULL DEFAULT 0,
    era VARCHAR(10) NOT NULL DEFAULT 'present',
    job VARCHAR(30) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_life_scores_score ON life_scores (score DESC);
