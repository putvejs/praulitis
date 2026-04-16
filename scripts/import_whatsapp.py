"""
scripts/import_whatsapp.py — Import WhatsApp chat export into Praulitis DB.

Parses _chat.txt and:
  1. Copies media files (photos, videos, audio) to static/uploads/ with UUID names.
  2. Inserts gallery rows for all images (is_public=0 — admin reviews before publishing).
  3. Uses Claude AI to cluster event-related messages, generate event titles/descriptions,
     map photos to events, and produce per-photo captions (all Latvian).

Usage:
    python scripts/import_whatsapp.py \
        --chat   "/path/to/WhatsApp Chat - PRAULITS/_chat.txt" \
        --media  "/path/to/WhatsApp Chat - PRAULITS/" \
        --dry-run

Options:
    --dry-run       Print what would be imported without touching the DB or filesystem.
    --photos-only   Only import photos (skip event/Claude processing).
    --events-only   Only detect events (skip media copy).
    --no-claude     Use keyword-only event detection, skip Claude API calls.
"""

import argparse
import json
import logging
import os
import re
import shutil
import sqlite3
import sys
import uuid
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s — %(message)s",
)
logger = logging.getLogger("import_whatsapp")

from app.config import DATABASE_PATH, UPLOAD_PATH
from app.database import init_db

# ---------------------------------------------------------------------------
# WhatsApp chat line format
# iOS:     "[23/06/2025, 18:42:05] Name: text"
# Android: "23.06.2025, 18:42 - Name: text"
# ---------------------------------------------------------------------------
LINE_RE = re.compile(
    r"^\u200e?\[?(\d{1,2}[./]\d{1,2}[./]\d{2,4}),?\s+"
    r"(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*[-–]?\s+([^:]+?):\s+(.+)$"
)
MEDIA_RE = re.compile(
    r"^(.+\.(jpg|jpeg|png|gif|mp4|mov|webm|mp3|m4a|ogg|opus|pdf|docx|odt))\s*(?:\(file attached\))?$",
    re.IGNORECASE,
)
OMITTED_RE = re.compile(r"\u200e?(image|video|audio|document|sticker|GIF) omitted$", re.IGNORECASE)

# Latvian keywords that suggest a public event announcement
EVENT_KEYWORDS = [
    "koncert", "uzstāš", "pasākum", "sarīkojum", "Jāņi", "Meteņ", "Uguns Nakts",
    "Ziemassvētk", "gadatirg", "festival", "svētki", "Lēdurg", "Saulkrast",
    "Lizum", "Praulien", "Brīvdabas muzej", "Pa saulei", "Kokļu Skaņas",
]

IMAGE_EXTS = {"jpg", "jpeg", "png", "gif", "webp"}
VIDEO_EXTS = {"mp4", "mov", "webm"}
AUDIO_EXTS = {"mp3", "m4a", "ogg", "opus"}

# Matches NNNNN-PHOTO-YYYY-MM-DD-HH-MM-SS.ext  or  NNNNN-VIDEO-...  etc.
MEDIA_FILENAME_RE = re.compile(
    r"(\d{8})-(?:PHOTO|VIDEO|AUDIO|PTT)-(\d{4}-\d{2}-\d{2})-(\d{2})-(\d{2})-(\d{2})",
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------

def parse_date(date_str: str, time_str: str) -> datetime | None:
    """Parse WhatsApp date+time string into a datetime (with seconds if present)."""
    date_str = date_str.replace("/", ".")
    for fmt in ("%d.%m.%Y", "%d.%m.%y"):
        for tfmt in ("%H:%M:%S", "%H:%M"):
            try:
                return datetime.strptime(f"{date_str} {time_str}", f"{fmt} {tfmt}")
            except ValueError:
                continue
    return None


def parse_chat(chat_path: str) -> list[dict]:
    """Parse WhatsApp _chat.txt — preserves full seconds in timestamp."""
    messages = []
    current = None
    with open(chat_path, encoding="utf-8", errors="replace") as f:
        for raw in f:
            line = raw.rstrip("\r\n")
            m = LINE_RE.match(line)
            if m:
                if current:
                    messages.append(current)
                date_s, time_s, sender, body = m.groups()
                ts = parse_date(date_s, time_s)
                body = body.strip()
                media_m = MEDIA_RE.match(body)
                omitted_m = OMITTED_RE.search(body)  # search handles inline "‎image omitted"
                current = {
                    "ts": ts,
                    "sender": sender.strip(),
                    "body": body,
                    "media_file": media_m.group(1) if media_m else None,
                    "is_omitted": bool(omitted_m),
                    "omitted_type": omitted_m.group(1).lower() if omitted_m else None,
                    "matched_path": None,   # filled by match_media_to_messages()
                }
            elif current:
                current["body"] += "\n" + line
    if current:
        messages.append(current)
    logger.info("Parsed %d messages from chat.", len(messages))
    return messages


# ---------------------------------------------------------------------------
# Media index + matching
# ---------------------------------------------------------------------------

def build_media_index(media_dir: Path) -> dict[datetime, Path]:
    """
    Build {datetime → Path} from WhatsApp export filenames.
    iOS filenames: 00000010-PHOTO-2025-06-22-16-23-00.jpg
    """
    index: dict[datetime, Path] = {}
    for p in media_dir.iterdir():
        m = MEDIA_FILENAME_RE.search(p.name)
        if not m:
            continue
        _, date_part, hh, mm, ss = m.groups()
        try:
            dt = datetime.strptime(f"{date_part} {hh}:{mm}:{ss}", "%Y-%m-%d %H:%M:%S")
            index[dt] = p
        except ValueError:
            pass
    logger.info("Media index: %d files with parseable timestamps.", len(index))
    return index


def match_media_to_messages(messages: list[dict], media_index: dict[datetime, Path]) -> None:
    """
    For messages marked 'image omitted' (or video/audio omitted), find the matching
    file in media_index by exact timestamp (±2 seconds tolerance).
    Sets msg['matched_path'] in-place.
    """
    tolerance = timedelta(seconds=2)
    used: set[datetime] = set()
    matched = 0
    for msg in messages:
        if not msg["is_omitted"] or msg["ts"] is None:
            continue
        best_dt = None
        best_delta = None
        for dt in media_index:
            if dt in used:
                continue
            delta = abs(msg["ts"] - dt)
            if delta <= tolerance:
                if best_delta is None or delta < best_delta:
                    best_delta = delta
                    best_dt = dt
        if best_dt is not None:
            msg["matched_path"] = media_index[best_dt]
            used.add(best_dt)
            matched += 1
    logger.info("Matched %d omitted messages to media files.", matched)


# ---------------------------------------------------------------------------
# Event clustering
# ---------------------------------------------------------------------------

def is_event_hint(body: str) -> bool:
    return any(kw.lower() in body.lower() for kw in EVENT_KEYWORDS)


def cluster_events(
    messages: list[dict],
    media_dir: Path | None = None,
    window_days: int = 3,
) -> list[dict]:
    """
    Group event-hint messages into clusters based on temporal proximity.
    A cluster spans messages within `window_days` of the first event-hint.

    Photos are assigned by DATE PROXIMITY (taken_date from filename vs event window),
    not by exact timestamp, since WhatsApp file timestamps reflect photo creation time
    which differs from message send time.

    Returns list of cluster dicts:
      {
        "anchor_ts": datetime,
        "messages": [...],       # text messages in window
        "photos": [Path, ...],   # photos whose taken_date falls in window
        "videos": [Path, ...],
        "audio": [Path, ...],
      }
    """
    # Find anchor timestamps (event-hint messages)
    anchors: list[datetime] = []
    for msg in messages:
        if msg["ts"] and not msg["is_omitted"] and is_event_hint(msg["body"]):
            anchors.append(msg["ts"])

    if not anchors:
        logger.info("No event-hint anchors found.")
        return []

    # Merge overlapping windows into spans [start, end]
    spans: list[tuple[datetime, datetime]] = []
    for a in sorted(anchors):
        start = a - timedelta(days=window_days)
        end = a + timedelta(days=window_days)
        if spans and start <= spans[-1][1]:
            spans[-1] = (spans[-1][0], max(spans[-1][1], end))
        else:
            spans.append((start, end))

    # Build date → [Path] index from media files for date-based assignment
    media_by_date: dict[str, list[Path]] = {}
    if media_dir:
        for p in sorted(media_dir.iterdir()):
            if p.name.startswith(".") or p.name == "_chat.txt":
                continue
            d = _date_from_filename(p.name)
            if d:
                media_by_date.setdefault(d, []).append(p)

    # Track which media dates have been assigned to avoid double-counting
    assigned_dates: set[str] = set()

    clusters = []
    for start, end in spans:
        text_msgs = []
        for msg in messages:
            if msg["ts"] is None or msg["is_omitted"]:
                continue
            if start <= msg["ts"] <= end:
                text_msgs.append(msg)

        # Anchor = first event-hint in the window
        anchor = next(
            (m["ts"] for m in text_msgs if is_event_hint(m["body"])),
            start + (end - start) / 2,
        )

        # Assign media files by date proximity
        photos: list[Path] = []
        videos: list[Path] = []
        audio_files: list[Path] = []

        span_start_date = start.date()
        span_end_date = end.date()
        cur = span_start_date
        while cur <= span_end_date:
            date_str = cur.isoformat()
            if date_str not in assigned_dates and date_str in media_by_date:
                for p in media_by_date[date_str]:
                    ext = p.suffix.lstrip(".").lower()
                    if ext in IMAGE_EXTS:
                        photos.append(p)
                    elif ext in VIDEO_EXTS:
                        videos.append(p)
                    elif ext in AUDIO_EXTS:
                        audio_files.append(p)
                assigned_dates.add(date_str)
            cur += timedelta(days=1)

        clusters.append({
            "anchor_ts": anchor,
            "messages": text_msgs,
            "photos": photos,
            "videos": videos,
            "audio": audio_files,
        })

    logger.info("Clustered into %d event groups.", len(clusters))
    return clusters


# ---------------------------------------------------------------------------
# Claude AI event generation
# ---------------------------------------------------------------------------

CLAUDE_TOOL = {
    "name": "create_event",
    "description": "Create a structured event record from WhatsApp chat context.",
    "input_schema": {
        "type": "object",
        "properties": {
            "title": {
                "type": "string",
                "description": "Event title in Latvian (concise, max 80 chars)",
            },
            "event_date": {
                "type": "string",
                "description": "ISO date YYYY-MM-DD of the event (not message date)",
            },
            "event_time": {
                "type": "string",
                "description": "Time HH:MM or null if unknown",
            },
            "location": {
                "type": "string",
                "description": "Venue / location in Latvian, or null",
            },
            "description": {
                "type": "string",
                "description": "Rich description in Latvian (2-5 sentences, suitable for public website)",
            },
            "event_type": {
                "type": "string",
                "enum": ["concert", "festival", "rehearsal", "other"],
                "description": "Type of event",
            },
            "album_name": {
                "type": "string",
                "description": "Short album name for photos from this event (Latvian)",
            },
            "photo_captions": {
                "type": "object",
                "description": "Map of original filename → Latvian caption (max 120 chars each)",
                "additionalProperties": {"type": "string"},
            },
        },
        "required": ["title", "event_date", "description", "event_type", "album_name"],
    },
}


def claude_generate_event(cluster: dict) -> dict | None:
    """
    Call Claude API with cluster context, return structured event data dict.
    Returns None on failure.
    """
    try:
        import anthropic
    except ImportError:
        logger.error("anthropic package not installed. Run: pip install anthropic")
        return None

    client = anthropic.Anthropic()

    # Build prompt context
    anchor_date = cluster["anchor_ts"].strftime("%Y-%m-%d")
    text_lines = []
    for msg in cluster["messages"][:40]:  # cap at 40 messages
        ts_str = msg["ts"].strftime("%Y-%m-%d %H:%M") if msg["ts"] else "?"
        text_lines.append(f"[{ts_str}] {msg['sender']}: {msg['body'][:300]}")

    photo_names = [p.name for p in cluster["photos"][:20]]

    prompt = f"""Tu esi palīgs, kas analizē folkloras kopas "Praulītis" WhatsApp čata vēstules un izveido strukturētu pasākuma ierakstu.

Pasākuma apmēram datums (konteksts no čata): {anchor_date}
Čata ziņas šī pasākuma kontekstā:

{chr(10).join(text_lines)}

Fotogrāfijas, kas saistītas ar šo pasākumu ({len(photo_names)} faili):
{chr(10).join(photo_names) if photo_names else "(nav fotogrāfiju)"}

Pamatojoties uz šo informāciju, izmanto rīku `create_event`, lai izveidotu pasākuma ierakstu.
Ja nevar noteikt precīzu datumu, izmanto kontekstuālo datumu {anchor_date}.
Aprakstam jābūt latviešu valodā, piemērotam publiskai mājas lapai.
"""

    try:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            tools=[CLAUDE_TOOL],
            tool_choice={"type": "tool", "name": "create_event"},
            messages=[{"role": "user", "content": prompt}],
        )
        for block in response.content:
            if block.type == "tool_use" and block.name == "create_event":
                return block.input
    except Exception as e:
        logger.error("Claude API error: %s", e)
    return None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def slugify(text: str) -> str:
    import unicodedata
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^\w\s-]", "", text.lower())
    text = re.sub(r"[\s_-]+", "-", text).strip("-")
    return text[:60] or "pasākums"


def unique_slug(conn: sqlite3.Connection, base: str) -> str:
    slug = base
    n = 1
    while conn.execute("SELECT 1 FROM events WHERE slug=?", (slug,)).fetchone():
        slug = f"{base}-{n}"
        n += 1
    return slug


def copy_media(src: Path, subfolder: str, dry_run: bool) -> str | None:
    ext = src.suffix.lstrip(".").lower()
    stored = f"{uuid.uuid4().hex}.{ext}"
    dest = Path(UPLOAD_PATH) / subfolder / stored
    if not dry_run:
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)
    return stored


DATE_FROM_FILENAME_RE = re.compile(r"(\d{4}-\d{2}-\d{2})")


def _date_from_filename(name: str) -> str | None:
    m = DATE_FROM_FILENAME_RE.search(name)
    return m.group(1) if m else None


# ---------------------------------------------------------------------------
# Media import (all files in directory)
# ---------------------------------------------------------------------------

def import_all_media(media_dir_str: str, dry_run: bool, conn: sqlite3.Connection) -> None:
    """
    Scan the WhatsApp export directory and copy all media files.
    Inserts gallery/media rows without event linking (linking happens during event import).
    """
    media_dir = Path(media_dir_str)
    photo_count = video_count = audio_count = 0

    for src in sorted(media_dir.iterdir()):
        if src.name.startswith(".") or src.name == "_chat.txt":
            continue
        ext = src.suffix.lstrip(".").lower()
        taken_date = _date_from_filename(src.name)
        ts_str = src.name

        if ext in IMAGE_EXTS:
            if not dry_run:
                if conn.execute("SELECT 1 FROM gallery WHERE original_name=?", (src.name,)).fetchone():
                    photo_count += 1
                    continue
                stored = copy_media(src, "photos", dry_run)
                conn.execute(
                    "INSERT INTO gallery (filename, original_name, taken_date, whatsapp_ts, is_public)"
                    " VALUES (?, ?, ?, ?, 0)",
                    (stored, src.name, taken_date, ts_str),
                )
            photo_count += 1

        elif ext in VIDEO_EXTS:
            if not dry_run:
                if conn.execute("SELECT 1 FROM media WHERE whatsapp_ts=?", (ts_str,)).fetchone():
                    video_count += 1
                    continue
                stored = copy_media(src, "videos", dry_run)
                title = src.stem.replace("-", " ").replace("_", " ")[:60]
                conn.execute(
                    "INSERT INTO media (title, media_type, filename, whatsapp_ts, is_public)"
                    " VALUES (?, 'video', ?, ?, 0)",
                    (title, stored, ts_str),
                )
            video_count += 1

        elif ext in AUDIO_EXTS:
            if not dry_run:
                if conn.execute("SELECT 1 FROM media WHERE whatsapp_ts=?", (ts_str,)).fetchone():
                    audio_count += 1
                    continue
                stored = copy_media(src, "audio", dry_run)
                title = src.stem.replace("-", " ").replace("_", " ")[:60]
                conn.execute(
                    "INSERT INTO media (title, media_type, filename, whatsapp_ts, is_public)"
                    " VALUES (?, 'audio', ?, ?, 0)",
                    (title, stored, ts_str),
                )
            audio_count += 1

    logger.info("Media: %d photos, %d videos, %d audio", photo_count, video_count, audio_count)


# ---------------------------------------------------------------------------
# Event import (Claude-powered)
# ---------------------------------------------------------------------------

def import_events_with_claude(
    clusters: list[dict],
    dry_run: bool,
    conn: sqlite3.Connection,
    use_claude: bool = True,
) -> None:
    """
    For each event cluster: generate event via Claude (or keywords), insert event row,
    link photos from the cluster to the event with captions.
    """
    created = 0
    linked_photos = 0

    for i, cluster in enumerate(clusters, 1):
        anchor_ts = cluster["anchor_ts"]
        photos = cluster["photos"]
        logger.info(
            "Cluster %d/%d: anchor=%s, %d text msgs, %d photos",
            i, len(clusters), anchor_ts.date(), len(cluster["messages"]), len(photos),
        )

        if use_claude and (cluster["messages"] or photos):
            logger.info("  → Calling Claude API…")
            event_data = claude_generate_event(cluster)
        else:
            event_data = None

        # Fallback: build event_data from first event-hint message
        if event_data is None:
            hint_msg = next(
                (m for m in cluster["messages"] if is_event_hint(m["body"])), None
            )
            first_line = (hint_msg["body"].split("\n")[0][:80] if hint_msg
                          else f"Pasākums {anchor_ts.strftime('%Y-%m-%d')}")
            event_data = {
                "title": first_line,
                "event_date": anchor_ts.date().isoformat(),
                "event_time": None,
                "location": None,
                "description": first_line,
                "event_type": "concert",
                "album_name": first_line[:40],
                "photo_captions": {},
            }

        title = event_data.get("title", "Pasākums")
        event_date = event_data.get("event_date", anchor_ts.date().isoformat())
        event_time = event_data.get("event_time")
        location = event_data.get("location")
        description = event_data.get("description", "")
        event_type = event_data.get("event_type", "concert")
        album_name = event_data.get("album_name", title[:40])
        photo_captions: dict = event_data.get("photo_captions") or {}

        whatsapp_source = anchor_ts.isoformat()
        base_slug = slugify(title)

        if dry_run:
            logger.info(
                "  [DRY RUN] EVENT: %s | %s | %s | %d photos",
                event_date, base_slug, title[:60], len(photos),
            )
            for p in photos[:3]:
                caption = photo_captions.get(p.name, "")
                logger.info("    photo: %s  caption: %.60s", p.name, caption)
            continue

        # Check dedup
        existing = conn.execute(
            "SELECT id FROM events WHERE whatsapp_source=?", (whatsapp_source,)
        ).fetchone()
        if existing:
            event_id = existing["id"]
            logger.info("  Existing event id=%d, updating photos only.", event_id)
        else:
            slug = unique_slug(conn, base_slug)
            conn.execute(
                "INSERT INTO events"
                " (title, slug, event_date, event_time, location, description,"
                "  event_type, is_public, whatsapp_source)"
                " VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)",
                (title, slug, event_date, event_time, location, description,
                 event_type, whatsapp_source),
            )
            event_id = conn.execute(
                "SELECT id FROM events WHERE whatsapp_source=?", (whatsapp_source,)
            ).fetchone()["id"]
            created += 1
            logger.info("  Created event id=%d: %s", event_id, title)

        # Link photos to event
        for photo_path in photos:
            # Find gallery row by original_name
            row = conn.execute(
                "SELECT id FROM gallery WHERE original_name=?", (photo_path.name,)
            ).fetchone()
            if row:
                caption = photo_captions.get(photo_path.name) or ""
                conn.execute(
                    "UPDATE gallery SET event_id=?, album=?, caption=? WHERE id=?",
                    (event_id, album_name, caption, row["id"]),
                )
                linked_photos += 1

        # Link videos to event
        for video_path in cluster["videos"]:
            row = conn.execute(
                "SELECT id FROM media WHERE whatsapp_ts=?", (video_path.name,)
            ).fetchone()
            if row:
                conn.execute(
                    "UPDATE media SET event_id=? WHERE id=?",
                    (event_id, row["id"]),
                )

    logger.info(
        "Events: %d created, %d photos linked (is_public=0, review in /admin).",
        created, linked_photos,
    )


# ---------------------------------------------------------------------------
# Fallback keyword-only event detection (no Claude)
# ---------------------------------------------------------------------------

def detect_events_keywords(messages: list[dict], dry_run: bool, conn: sqlite3.Connection) -> None:
    """Legacy keyword-only detection — used when --no-claude is set."""
    created = 0
    seen: set[str] = set()

    for msg in messages:
        if not msg["ts"] or msg["is_omitted"]:
            continue
        body = msg["body"]
        if not is_event_hint(body):
            continue
        if len(body) < 20 or len(body) > 1000:
            continue

        first_line = body.split("\n")[0].strip()[:80]
        base_slug = slugify(first_line)
        if base_slug in seen:
            continue
        seen.add(base_slug)

        event_date = msg["ts"].date().isoformat()
        slug = unique_slug(conn, base_slug) if not dry_run else base_slug

        if dry_run:
            logger.info("  DRAFT EVENT: %s | %s | %.60s", event_date, slug, first_line)
        else:
            ws = msg["ts"].isoformat() + msg["sender"]
            if not conn.execute("SELECT 1 FROM events WHERE whatsapp_source=?", (ws,)).fetchone():
                conn.execute(
                    "INSERT INTO events"
                    " (title, slug, event_date, description, event_type, is_public, whatsapp_source)"
                    " VALUES (?, ?, ?, ?, 'concert', 0, ?)",
                    (first_line, slug, event_date, body[:500], ws),
                )
                created += 1

    logger.info("Events detected: %d (is_public=0, review in /admin)", created)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Import WhatsApp chat into Praulitis DB.")
    parser.add_argument("--chat", required=True, help="Path to _chat.txt")
    parser.add_argument("--media", required=True, help="Path to WhatsApp export directory")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--photos-only", action="store_true", help="Only import media, skip events")
    parser.add_argument("--events-only", action="store_true", help="Only detect events, skip media copy")
    parser.add_argument("--no-claude", action="store_true", help="Skip Claude API, use keyword matching")
    args = parser.parse_args()

    if not Path(args.chat).exists():
        logger.error("Chat file not found: %s", args.chat)
        sys.exit(1)

    init_db()

    messages = parse_chat(args.chat)

    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")

    try:
        if not args.events_only:
            logger.info("Importing media files%s…", " [DRY RUN]" if args.dry_run else "")
            import_all_media(args.media, args.dry_run, conn)

        if not args.photos_only:
            logger.info("Processing events%s…", " [DRY RUN]" if args.dry_run else "")

            if args.no_claude:
                detect_events_keywords(messages, args.dry_run, conn)
            else:
                # Cluster by temporal proximity; assign photos by date range
                media_dir = Path(args.media)
                clusters = cluster_events(messages, media_dir=media_dir, window_days=3)
                import_events_with_claude(clusters, args.dry_run, conn, use_claude=True)

        if not args.dry_run:
            conn.commit()
            logger.info("Committed to DB: %s", DATABASE_PATH)
        else:
            logger.info("[DRY RUN] No changes written.")
    finally:
        conn.close()

    logger.info("=== Import complete. ===")
    if not args.dry_run:
        logger.info("All imported content has is_public=0 — review and publish in /admin.")


if __name__ == "__main__":
    main()
