
CREATE TABLE IF NOT EXISTS players (
    id BIGSERIAL PRIMARY KEY,
    account_key VARCHAR(128) UNIQUE,
    nickname VARCHAR(20) NOT NULL DEFAULT '.GG/SGxenon',
    tag_number INTEGER NOT NULL UNIQUE,
    is_bot BOOLEAN NOT NULL DEFAULT FALSE,
    gems BIGINT NOT NULL DEFAULT 100000,
    tokens BIGINT NOT NULL DEFAULT 5000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT nickname_length CHECK (char_length(nickname) BETWEEN 4 AND 20),
    CONSTRAINT valid_tag_number CHECK (tag_number BETWEEN 1000 AND 9999),
    CONSTRAINT valid_gems CHECK (gems >= 0),
    CONSTRAINT valid_tokens CHECK (tokens >= 0)
);

CREATE TABLE IF NOT EXISTS maps (
    id BIGSERIAL PRIMARY KEY,
    map_key VARCHAR(80) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    game_version VARCHAR(20) NOT NULL DEFAULT '0.72',
    enabled BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS tournaments (
    id BIGSERIAL PRIMARY KEY,
    tournament_type VARCHAR(20) NOT NULL,
    name VARCHAR(80) NOT NULL,
    image_url TEXT,
    description TEXT DEFAULT '',
    max_players INTEGER NOT NULL,
    selected_maps JSONB NOT NULL DEFAULT '[]',
    rounds INTEGER,
    team_mode VARCHAR(10),
    starts_at TIMESTAMPTZ,
    registration_ends_at TIMESTAMPTZ,
    duration_days INTEGER,
    entry_cost BIGINT NOT NULL DEFAULT 0,
    first_place_gems BIGINT NOT NULL DEFAULT 0,
    position_rewards JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_by BIGINT REFERENCES players(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_tournament_type CHECK (tournament_type IN ('gems', 'classic')),
    CONSTRAINT valid_team_mode CHECK (team_mode IS NULL OR team_mode IN ('solo', 'duos')),
    CONSTRAINT valid_max_players CHECK (max_players > 0),
    CONSTRAINT valid_entry_cost CHECK (entry_cost >= 0),
    CONSTRAINT valid_first_place_gems CHECK (first_place_gems >= 0),
    CONSTRAINT valid_duration CHECK (duration_days IS NULL OR duration_days > 0)
);

CREATE TABLE IF NOT EXISTS tournament_players (
    id BIGSERIAL PRIMARY KEY,
    tournament_id BIGINT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    player_id BIGINT NOT NULL REFERENCES players(id),
    placement INTEGER,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tournament_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_players_account_key ON players(account_key);
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);
CREATE INDEX IF NOT EXISTS idx_tournament_players_player ON tournament_players(player_id);

ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS registration_ends_at TIMESTAMPTZ;
