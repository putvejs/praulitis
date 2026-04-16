from flask import Blueprint, render_template, request, jsonify, abort

from app.database import get_db
from app import storage

public_bp = Blueprint("public", __name__)


# ── Event detail page (still server-rendered) ─────────────────────────────────

@public_bp.route("/events/<slug>")
def event_detail(slug):
    db = get_db()
    event = db.execute(
        "SELECT * FROM events WHERE slug=? AND is_public=1", (slug,)
    ).fetchone()
    if not event:
        abort(404)
    photos_raw = db.execute(
        "SELECT * FROM gallery WHERE event_id=? AND is_public=1 ORDER BY sort_order, taken_date",
        (event["id"],),
    ).fetchall()
    photos = [dict(p) | {"url": storage.public_url("photos", p["filename"])} for p in photos_raw]
    videos_raw = db.execute(
        "SELECT * FROM media WHERE event_id=? AND is_public=1 AND media_type='video'",
        (event["id"],),
    ).fetchall()
    videos = [dict(v) | {"url": storage.public_url("videos", v["filename"])} for v in videos_raw]
    return render_template("public/event_detail.html", event=event, photos=photos, videos=videos)


# ── Search ────────────────────────────────────────────────────────────────────

@public_bp.route("/search")
def search():
    q = request.args.get("q", "").strip()
    results = _do_search(q) if q else []
    return render_template("public/search.html", q=q, results=results)


@public_bp.route("/api/search")
def api_search():
    q = request.args.get("q", "").strip()
    if len(q) < 2:
        return jsonify([])
    return jsonify(_do_search(q, limit=8))


def _do_search(q: str, limit: int = 30) -> list:
    if not q:
        return []
    db = get_db()
    like = f"%{q}%"
    events = db.execute(
        "SELECT id, title, slug, event_date, location, 'event' as type FROM events"
        " WHERE is_public=1 AND (title LIKE ? OR description LIKE ? OR location LIKE ?)"
        " ORDER BY event_date DESC LIMIT ?",
        (like, like, like, limit),
    ).fetchall()
    photos = db.execute(
        "SELECT id, caption as title, filename, album, taken_date, 'photo' as type FROM gallery"
        " WHERE is_public=1 AND (caption LIKE ? OR album LIKE ?)"
        " ORDER BY taken_date DESC LIMIT ?",
        (like, like, limit // 2),
    ).fetchall()
    return [dict(r) for r in list(events) + list(photos)]
