import sqlite3
import logging
from pathlib import Path
from flask import g

from app.config import DATABASE_PATH

logger = logging.getLogger(__name__)


def get_db() -> sqlite3.Connection:
    if "db" not in g:
        Path(DATABASE_PATH).parent.mkdir(parents=True, exist_ok=True)
        g.db = sqlite3.connect(DATABASE_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
        g.db.execute("PRAGMA journal_mode = WAL")
    return g.db


def close_db(e=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'member',
    display_name  TEXT,
    created_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS events (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    title         TEXT NOT NULL,
    slug          TEXT UNIQUE NOT NULL,
    event_date    TEXT NOT NULL,
    event_time    TEXT,
    end_date      TEXT,
    location      TEXT,
    description   TEXT,
    event_type    TEXT DEFAULT 'concert',
    is_public     INTEGER DEFAULT 1,
    cover_photo_id INTEGER,
    whatsapp_source TEXT,
    created_at    TEXT DEFAULT (datetime('now')),
    updated_at    TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS events_date_idx ON events(event_date);
CREATE INDEX IF NOT EXISTS events_public_idx ON events(is_public, event_date);

CREATE TABLE IF NOT EXISTS gallery (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    filename      TEXT NOT NULL UNIQUE,
    original_name TEXT,
    caption       TEXT,
    album         TEXT,
    taken_date    TEXT,
    event_id      INTEGER REFERENCES events(id) ON DELETE SET NULL,
    sort_order    INTEGER DEFAULT 0,
    is_public     INTEGER DEFAULT 1,
    whatsapp_ts   TEXT,
    created_at    TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS gallery_album_idx ON gallery(album);
CREATE INDEX IF NOT EXISTS gallery_public_idx ON gallery(is_public, taken_date DESC);

CREATE TABLE IF NOT EXISTS members (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    role          TEXT,
    bio           TEXT,
    photo_filename TEXT,
    sort_order    INTEGER DEFAULT 0,
    is_active     INTEGER DEFAULT 1,
    joined_year   INTEGER,
    created_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS media (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    title         TEXT NOT NULL,
    media_type    TEXT NOT NULL,
    filename      TEXT,
    youtube_url   TEXT,
    description   TEXT,
    event_id      INTEGER REFERENCES events(id) ON DELETE SET NULL,
    thumbnail_filename TEXT,
    duration_sec  INTEGER,
    is_public     INTEGER DEFAULT 1,
    whatsapp_ts   TEXT,
    created_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS content_blocks (
    key           TEXT PRIMARY KEY,
    content       TEXT NOT NULL DEFAULT '',
    updated_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rehearsal_schedule (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    day_of_week   INTEGER,
    time_of_day   TEXT NOT NULL,
    location      TEXT DEFAULT 'Prauliena',
    is_active     INTEGER DEFAULT 1,
    note          TEXT
);

CREATE TABLE IF NOT EXISTS rehearsal_exceptions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    rehearsal_date TEXT NOT NULL,
    is_cancelled  INTEGER DEFAULT 0,
    note          TEXT,
    created_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS announcements (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    title         TEXT NOT NULL,
    body          TEXT NOT NULL,
    is_pinned     INTEGER DEFAULT 0,
    created_at    TEXT DEFAULT (datetime('now'))
);

CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
    doc_id,
    doc_type,
    title,
    body,
    content=''
);
"""

DEFAULT_CONTENT = {
    "home_intro": "Folkloras kopa \"Praulītis\" ir Praulienas pagasta tradicionālās mūzikas kolektīvs, kas kopj seno dziedāšanas tradīciju, tautas dejas un mūzikas mantojumu.",
    "about_history": "Folkloras kopa \"Praulītis\" dibināta Praulienā, Madonas novadā. Kolektīvs aktīvi piedalās folkloras festivālos, svētkos un kultūras pasākumos visā Latvijā, sargājot un popularizējot Praulienas novada bagāto folkloristisko mantojumu.",
    "contact_text": "Prauliena, Madonas novads\nLatvija",
    "hero_quote": "Dziedām dziesmas, ko dziedāja mūsu vecmāmiņas",
    "hero_location": "Prauliena · Madonas novads",
}

DEFAULT_SCHEDULE = [
    (4, "18:00", "Praulienas pagastmāja", 1, "Piektdienas mēģinājums"),
    (6, "15:00", "KUBS / Ceļmalas", 1, "Svētdienas mēģinājums"),
    (0, "17:30", "Madonā, Skolas iela 8", 1, "Pirmdienas mēģinājums"),
]


_MIGRATIONS = [
    "ALTER TABLE users ADD COLUMN email TEXT",
    "ALTER TABLE media ADD COLUMN hls_path TEXT",
    "ALTER TABLE media ADD COLUMN hls_status TEXT DEFAULT 'none'",
]


def _run_migrations(conn):
    """Forward-only schema migrations. Each entry runs once; errors mean column exists."""
    for sql in _MIGRATIONS:
        try:
            conn.execute(sql)
        except sqlite3.OperationalError:
            pass  # column already exists


def init_db():
    """Create tables and seed default data. Safe to run multiple times."""
    Path(DATABASE_PATH).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(SCHEMA)
    _run_migrations(conn)

    for key, value in DEFAULT_CONTENT.items():
        conn.execute(
            "INSERT OR IGNORE INTO content_blocks (key, content) VALUES (?, ?)",
            (key, value),
        )

    existing = conn.execute("SELECT COUNT(*) FROM rehearsal_schedule").fetchone()[0]
    if existing == 0:
        for dow, time, loc, active, note in DEFAULT_SCHEDULE:
            conn.execute(
                "INSERT INTO rehearsal_schedule (day_of_week, time_of_day, location, is_active, note) VALUES (?,?,?,?,?)",
                (dow, time, loc, active, note),
            )

    conn.commit()
    conn.close()
    logger.info("Database initialised at %s", DATABASE_PATH)
