-- THE DESIGN SECTION'S OWN DATABASE
--
-- The hierarchy is the application's: the user at the top, the Design section, the Design
-- package, the four rooms, and the content each room owns. Every content record names the
-- room it belongs to. A room's content is the set of records that name it; the package's
-- content is the set whose rooms name the package; the chat room's search is the package's
-- set. This file is the whole structure; it is created once, and the rows are moved into it
-- one at a time (see design_moves).
--
-- The credentials are the database's own. The design_app role owns this database and has no
-- connection to the application's identity database. The identity database keeps the users;
-- design_users holds only the id and the display name.

CREATE TABLE IF NOT EXISTS design_users (
    id UUID PRIMARY KEY,
    display_name TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS design_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES design_users(id) ON DELETE CASCADE,
    key TEXT NOT NULL DEFAULT 'design',
    title TEXT NOT NULL DEFAULT 'Design',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, key)
);

CREATE TABLE IF NOT EXISTS design_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES design_sections(id) ON DELETE CASCADE,
    key TEXT NOT NULL DEFAULT 'design',
    title TEXT NOT NULL DEFAULT 'Design',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (section_id, key)
);

CREATE TABLE IF NOT EXISTS design_tabs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID NOT NULL REFERENCES design_packages(id) ON DELETE CASCADE,
    key TEXT NOT NULL CHECK (key IN ('chat', 'tools', 'approve', 'ux')),
    title TEXT NOT NULL,
    ordinal INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (package_id, key)
);

-- THE PACKAGE'S OWN RECORDS — the design systems, the section-level cards, anything that
-- belongs to the Design package and to no room. A catalogue is not a Tools session; it is the
-- Design section's own system. Keeping it here is what stops a catalogue from appearing in a
-- room's list.
CREATE TABLE IF NOT EXISTS design_package_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID NOT NULL REFERENCES design_packages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES design_users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '(untitled)',
    payload JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS design_package_records_package
    ON design_package_records (package_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS design_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tab_id UUID NOT NULL REFERENCES design_tabs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES design_users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT '(untitled)',
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB NOT NULL DEFAULT '{}',
    surface_state_json TEXT,
    surface_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- THE SOURCE ROWS ALREADY CARRY THESE. A conversation's metadata holds the UX notebook and
-- the package it came from; the surface state is the scroll, the filters, and the box sizes a
-- kept visit left. They are copied with the row, never re-derived.
ALTER TABLE design_conversations
    ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';
ALTER TABLE design_conversations
    ADD COLUMN IF NOT EXISTS surface_state_json TEXT;
ALTER TABLE design_conversations
    ADD COLUMN IF NOT EXISTS surface_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS design_conversations_tab_updated
    ON design_conversations (tab_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS design_conversations_user_updated
    ON design_conversations (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS design_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES design_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS design_messages_conversation_created
    ON design_messages (conversation_id, created_at);

CREATE TABLE IF NOT EXISTS design_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tab_id UUID NOT NULL REFERENCES design_tabs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES design_users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '(untitled)',
    state TEXT NOT NULL DEFAULT '',
    payload JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS design_records_tab_updated
    ON design_records (tab_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS design_records_kind_updated
    ON design_records (kind, updated_at DESC);

CREATE TABLE IF NOT EXISTS design_events (
    id BIGSERIAL PRIMARY KEY,
    tab_id UUID NOT NULL REFERENCES design_tabs(id) ON DELETE CASCADE,
    user_id UUID REFERENCES design_users(id) ON DELETE SET NULL,
    kind TEXT NOT NULL,
    detail JSONB NOT NULL DEFAULT '{}',
    at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS design_events_tab_at
    ON design_events (tab_id, at DESC);

-- EVERY ROW THE MIGRATION MOVES IS RECORDED HERE, ONE ROW PER SOURCE RECORD. The ledger is
-- the proof of the move and the list of what is still to do: a source row with no ledger row
-- has not been moved. The unique key makes a repeated run safe.
CREATE TABLE IF NOT EXISTS design_moves (
    id BIGSERIAL PRIMARY KEY,
    source_table TEXT NOT NULL,
    source_id TEXT NOT NULL,
    target_table TEXT NOT NULL DEFAULT '',
    target_id TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'moved',
    detail JSONB NOT NULL DEFAULT '{}',
    at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (source_table, source_id)
);
