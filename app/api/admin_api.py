import uuid
import unicodedata
import re
from datetime import datetime
from functools import wraps

from flask import Blueprint, jsonify, request, session, current_app
from werkzeug.security import generate_password_hash

from app.database import get_db
from app import storage
from app.config import DATABASE_PATH, AWS_S3_BUCKET, AWS_S3_REGION, AWS_CLOUDFRONT_URL, USE_S3

admin_api_bp = Blueprint("admin_api", __name__, url_prefix="/api/admin")

ALLOWED_IMAGES = {"jpg", "jpeg", "png", "webp", "gif"}
ALLOWED_VIDEOS = {"mp4", "mov", "webm"}
ALLOWED_AUDIO  = {"mp3", "m4a", "ogg", "opus"}


def _api_admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("user_id") or session.get("role") != "admin":
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated


def _row(row):
    """Convert sqlite3.Row to dict."""
    return dict(row) if row else None


def _rows(rows):
    return [dict(r) for r in rows]


def _gallery_row(row):
    d = dict(row)
    d["url"] = storage.public_url("photos", d.get("filename"))
    return d


def _gallery_rows(rows):
    return [_gallery_row(r) for r in rows]


def _ext(filename):
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def _save_upload(file, subfolder):
    ext = _ext(file.filename)
    stored = f"{uuid.uuid4().hex}.{ext}"
    storage.save_upload(file, subfolder, stored)
    return stored


def _slugify(text):
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^\w\s-]", "", text.lower())
    text = re.sub(r"[\s_-]+", "-", text).strip("-")
    return text[:80]


def _unique_slug(db, base, exclude_id=None):
    slug = base
    n = 1
    while True:
        row = db.execute(
            "SELECT id FROM events WHERE slug=?" + (" AND id!=?" if exclude_id else ""),
            (slug, exclude_id) if exclude_id else (slug,),
        ).fetchone()
        if not row:
            return slug
        slug = f"{base}-{n}"
        n += 1


# ── Auth ──────────────────────────────────────────────────────────────────────

@admin_api_bp.route("/me")
@_api_admin_required
def me():
    return jsonify({
        "user_id": session["user_id"],
        "username": session["username"],
        "role": session["role"],
    })


# ── Stats ─────────────────────────────────────────────────────────────────────

@admin_api_bp.route("/stats")
@_api_admin_required
def stats():
    db = get_db()
    return jsonify({
        "events":        db.execute("SELECT COUNT(*) FROM events").fetchone()[0],
        "photos":        db.execute("SELECT COUNT(*) FROM gallery").fetchone()[0],
        "members":       db.execute("SELECT COUNT(*) FROM members WHERE is_active=1").fetchone()[0],
        "media":         db.execute("SELECT COUNT(*) FROM media").fetchone()[0],
        "pending_photos": db.execute("SELECT COUNT(*) FROM gallery WHERE is_public=0").fetchone()[0],
        "announcements": db.execute("SELECT COUNT(*) FROM announcements").fetchone()[0],
    })


# ── Events ────────────────────────────────────────────────────────────────────

@admin_api_bp.route("/events", methods=["GET"])
@_api_admin_required
def events_list():
    db = get_db()
    rows = db.execute("SELECT * FROM events ORDER BY event_date DESC").fetchall()
    return jsonify(_rows(rows))


@admin_api_bp.route("/events", methods=["POST"])
@_api_admin_required
def event_create():
    db = get_db()
    data = request.get_json()
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "Nosaukums ir obligāts"}), 400
    base_slug = _slugify(data.get("slug", "").strip() or title)
    slug = _unique_slug(db, base_slug)
    db.execute(
        "INSERT INTO events (title,slug,event_date,event_time,end_date,location,"
        "description,event_type,is_public,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
        (title, slug,
         data.get("event_date") or "", data.get("event_time") or None,
         data.get("end_date") or None, data.get("location") or None,
         data.get("description") or None, data.get("event_type", "concert"),
         1 if data.get("is_public", True) else 0,
         datetime.now().isoformat()),
    )
    db.commit()
    row = db.execute("SELECT * FROM events WHERE slug=?", (slug,)).fetchone()
    return jsonify(_row(row)), 201


@admin_api_bp.route("/events/<int:eid>", methods=["PUT"])
@_api_admin_required
def event_update(eid):
    db = get_db()
    data = request.get_json()
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "Nosaukums ir obligāts"}), 400
    base_slug = _slugify(data.get("slug", "").strip() or title)
    slug = _unique_slug(db, base_slug, exclude_id=eid)
    db.execute(
        "UPDATE events SET title=?,slug=?,event_date=?,event_time=?,end_date=?,"
        "location=?,description=?,event_type=?,is_public=?,updated_at=? WHERE id=?",
        (title, slug,
         data.get("event_date") or "", data.get("event_time") or None,
         data.get("end_date") or None, data.get("location") or None,
         data.get("description") or None, data.get("event_type", "concert"),
         1 if data.get("is_public", True) else 0,
         datetime.now().isoformat(), eid),
    )
    db.commit()
    row = db.execute("SELECT * FROM events WHERE id=?", (eid,)).fetchone()
    return jsonify(_row(row))


@admin_api_bp.route("/events/<int:eid>", methods=["DELETE"])
@_api_admin_required
def event_delete(eid):
    db = get_db()
    db.execute("DELETE FROM events WHERE id=?", (eid,))
    db.commit()
    return jsonify({"ok": True})


@admin_api_bp.route("/events/bulk", methods=["PUT"])
@_api_admin_required
def events_bulk():
    db = get_db()
    data = request.get_json()
    ids = [int(i) for i in data.get("ids", [])]
    is_public = 1 if data.get("is_public") else 0
    if ids:
        db.execute(f"UPDATE events SET is_public=? WHERE id IN ({','.join('?'*len(ids))})", [is_public, *ids])
        db.commit()
    return jsonify({"ok": True, "count": len(ids)})


# ── Gallery ───────────────────────────────────────────────────────────────────

@admin_api_bp.route("/gallery", methods=["GET"])
@_api_admin_required
def gallery_list():
    db = get_db()
    rows = db.execute(
        "SELECT g.*, e.title as event_title FROM gallery g"
        " LEFT JOIN events e ON e.id=g.event_id"
        " ORDER BY g.taken_date DESC, g.id DESC"
    ).fetchall()
    return jsonify(_gallery_rows(rows))


@admin_api_bp.route("/gallery/upload", methods=["POST"])
@_api_admin_required
def gallery_upload():
    db = get_db()
    files = request.files.getlist("photos")
    album = request.form.get("album", "").strip() or None
    event_id = request.form.get("event_id") or None
    is_public = 1 if request.form.get("is_public", "1") != "0" else 0
    saved = []
    for file in files:
        if not file or not file.filename:
            continue
        if _ext(file.filename) not in ALLOWED_IMAGES:
            continue
        stored = _save_upload(file, "photos")
        db.execute(
            "INSERT INTO gallery (filename,original_name,album,event_id,is_public,taken_date)"
            " VALUES (?,?,?,?,?,datetime('now'))",
            (stored, file.filename, album, event_id, is_public),
        )
        saved.append(stored)
    db.commit()
    return jsonify({"uploaded": len(saved), "files": saved}), 201


@admin_api_bp.route("/gallery/<int:gid>", methods=["PUT"])
@_api_admin_required
def gallery_update(gid):
    db = get_db()
    data = request.get_json()
    db.execute(
        "UPDATE gallery SET caption=?,album=?,event_id=?,is_public=?,sort_order=? WHERE id=?",
        (data.get("caption") or None, data.get("album") or None,
         data.get("event_id") or None, 1 if data.get("is_public", True) else 0,
         int(data.get("sort_order", 0)), gid),
    )
    db.commit()
    row = db.execute(
        "SELECT g.*, e.title as event_title FROM gallery g"
        " LEFT JOIN events e ON e.id=g.event_id WHERE g.id=?", (gid,)
    ).fetchone()
    return jsonify(_gallery_row(row))


@admin_api_bp.route("/gallery/<int:gid>", methods=["DELETE"])
@_api_admin_required
def gallery_delete(gid):
    db = get_db()
    row = db.execute("SELECT filename FROM gallery WHERE id=?", (gid,)).fetchone()
    if row:
        storage.delete_file("photos", row["filename"])
        db.execute("DELETE FROM gallery WHERE id=?", (gid,))
        db.commit()
    return jsonify({"ok": True})


@admin_api_bp.route("/gallery/bulk", methods=["PUT"])
@_api_admin_required
def gallery_bulk():
    db = get_db()
    data = request.get_json()
    ids = [int(i) for i in data.get("ids", [])]
    if not ids:
        return jsonify({"ok": True, "count": 0})
    if "event_id" in data:
        event_id = int(data["event_id"]) if data["event_id"] else None
        db.execute(f"UPDATE gallery SET event_id=? WHERE id IN ({','.join('?'*len(ids))})", [event_id, *ids])
    else:
        is_public = 1 if data.get("is_public") else 0
        db.execute(f"UPDATE gallery SET is_public=? WHERE id IN ({','.join('?'*len(ids))})", [is_public, *ids])
    db.commit()
    return jsonify({"ok": True, "count": len(ids)})


@admin_api_bp.route("/gallery/bulk", methods=["DELETE"])
@_api_admin_required
def gallery_bulk_delete():
    db = get_db()
    data = request.get_json()
    ids = [int(i) for i in data.get("ids", [])]
    for gid in ids:
        row = db.execute("SELECT filename FROM gallery WHERE id=?", (gid,)).fetchone()
        if row:
            storage.delete_file("photos", row["filename"])
        db.execute("DELETE FROM gallery WHERE id=?", (gid,))
    db.commit()
    return jsonify({"ok": True, "count": len(ids)})


@admin_api_bp.route("/gallery/reorder", methods=["POST"])
@_api_admin_required
def gallery_reorder():
    db = get_db()
    order = request.get_json()  # [{id, sort_order}, ...]
    for item in order:
        db.execute("UPDATE gallery SET sort_order=? WHERE id=?",
                   (item["sort_order"], item["id"]))
    db.commit()
    return jsonify({"ok": True})


@admin_api_bp.route("/members/bulk", methods=["PUT"])
@_api_admin_required
def members_bulk():
    db = get_db()
    data = request.get_json()
    ids = [int(i) for i in data.get("ids", [])]
    is_active = 1 if data.get("is_active") else 0
    if ids:
        db.execute(f"UPDATE members SET is_active=? WHERE id IN ({','.join('?'*len(ids))})", [is_active, *ids])
        db.commit()
    return jsonify({"ok": True, "count": len(ids)})


# ── Members ───────────────────────────────────────────────────────────────────

@admin_api_bp.route("/members", methods=["GET"])
@_api_admin_required
def members_list():
    db = get_db()
    rows = db.execute("SELECT * FROM members ORDER BY sort_order, name").fetchall()
    return jsonify(_rows(rows))


@admin_api_bp.route("/members", methods=["POST"])
@_api_admin_required
def member_create():
    db = get_db()
    # multipart for photo upload
    f = request.form
    name = f.get("name", "").strip()
    if not name:
        return jsonify({"error": "Vārds ir obligāts"}), 400
    photo_filename = None
    photo_file = request.files.get("photo")
    if photo_file and photo_file.filename and _ext(photo_file.filename) in ALLOWED_IMAGES:
        photo_filename = _save_upload(photo_file, "photos")
    db.execute(
        "INSERT INTO members (name,role,bio,photo_filename,sort_order,is_active,joined_year)"
        " VALUES (?,?,?,?,?,?,?)",
        (name, f.get("role") or None, f.get("bio") or None,
         photo_filename, int(f.get("sort_order", 0)),
         1 if f.get("is_active", "1") != "0" else 0,
         f.get("joined_year") or None),
    )
    db.commit()
    row = db.execute("SELECT * FROM members WHERE name=? ORDER BY id DESC LIMIT 1", (name,)).fetchone()
    return jsonify(_row(row)), 201


@admin_api_bp.route("/members/<int:mid>", methods=["PUT"])
@_api_admin_required
def member_update(mid):
    db = get_db()
    f = request.form
    name = f.get("name", "").strip()
    if not name:
        return jsonify({"error": "Vārds ir obligāts"}), 400
    existing = db.execute("SELECT photo_filename FROM members WHERE id=?", (mid,)).fetchone()
    photo_filename = existing["photo_filename"] if existing else None
    photo_file = request.files.get("photo")
    if photo_file and photo_file.filename and _ext(photo_file.filename) in ALLOWED_IMAGES:
        photo_filename = _save_upload(photo_file, "photos")
    db.execute(
        "UPDATE members SET name=?,role=?,bio=?,photo_filename=?,sort_order=?,is_active=?,joined_year=? WHERE id=?",
        (name, f.get("role") or None, f.get("bio") or None,
         photo_filename, int(f.get("sort_order", 0)),
         1 if f.get("is_active", "1") != "0" else 0,
         f.get("joined_year") or None, mid),
    )
    db.commit()
    row = db.execute("SELECT * FROM members WHERE id=?", (mid,)).fetchone()
    return jsonify(_row(row))


@admin_api_bp.route("/members/<int:mid>", methods=["DELETE"])
@_api_admin_required
def member_delete(mid):
    db = get_db()
    db.execute("DELETE FROM members WHERE id=?", (mid,))
    db.commit()
    return jsonify({"ok": True})


# ── Media ─────────────────────────────────────────────────────────────────────

@admin_api_bp.route("/media", methods=["GET"])
@_api_admin_required
def media_list():
    import re as _re
    _date_re = _re.compile(r'(\d{4}-\d{2}-\d{2})')

    def _media_sort_key(r):
        m = _date_re.search(r['whatsapp_ts'] or '')
        return m.group(1) if m else (r['created_at'] or '')[:10]

    db = get_db()
    rows = _rows(db.execute(
        "SELECT m.*, e.title as event_title FROM media m"
        " LEFT JOIN events e ON e.id=m.event_id"
    ).fetchall())
    rows.sort(key=_media_sort_key, reverse=True)
    for r in rows:
        r['thumbnail_url'] = storage.public_url('photos', r.get('thumbnail_filename'))
    return jsonify(rows)


@admin_api_bp.route("/media/presign", methods=["POST"])
@_api_admin_required
def media_presign():
    """Generate a presigned S3 URL for direct browser-to-S3 upload."""
    if not storage.USE_S3:
        return jsonify({"error": "Direct upload not available"}), 400
    data = request.get_json() or {}
    media_type = data.get("media_type", "video")
    ext = data.get("ext", "mp4").lower()
    allowed = ALLOWED_VIDEOS if media_type == "video" else ALLOWED_AUDIO
    if ext not in allowed:
        return jsonify({"error": "Faila tips nav atļauts"}), 400
    filename = f"{uuid.uuid4().hex}.{ext}"
    subfolder = "videos" if media_type == "video" else "audio"
    storage.ensure_cors()
    url, content_type = storage.generate_presign_url(subfolder, filename)
    return jsonify({"url": url, "filename": filename, "content_type": content_type})


@admin_api_bp.route("/media", methods=["POST"])
@_api_admin_required
def media_create():
    db = get_db()
    f = request.form
    title = f.get("title", "").strip()
    if not title:
        return jsonify({"error": "Nosaukums ir obligāts"}), 400
    media_type = f.get("media_type", "video")
    filename = f.get("presigned_filename") or None  # already uploaded directly to S3
    if not filename:
        media_file = request.files.get("file")
        if media_file and media_file.filename:
            allowed = ALLOWED_VIDEOS if media_type == "video" else ALLOWED_AUDIO
            if _ext(media_file.filename) in allowed:
                subfolder = "videos" if media_type == "video" else "audio"
                filename = _save_upload(media_file, subfolder)
    thumbnail = None
    thumb_file = request.files.get("thumbnail")
    if thumb_file and thumb_file.filename and _ext(thumb_file.filename) in ALLOWED_IMAGES:
        thumbnail = _save_upload(thumb_file, "photos")
    duration_sec = None
    try:
        raw = f.get("duration_sec")
        if raw:
            duration_sec = int(raw)
    except (ValueError, TypeError):
        pass
    db.execute(
        "INSERT INTO media (title,media_type,filename,youtube_url,description,"
        "event_id,thumbnail_filename,duration_sec,is_public) VALUES (?,?,?,?,?,?,?,?,?)",
        (title, media_type, filename, f.get("youtube_url") or None,
         f.get("description") or None, f.get("event_id") or None,
         thumbnail, duration_sec, 1 if f.get("is_public", "1") != "0" else 0),
    )
    db.commit()
    row = db.execute("SELECT * FROM media ORDER BY id DESC LIMIT 1").fetchone()
    new_row = _row(row)
    # Kick off HLS processing if this is a video file stored in S3
    if USE_S3 and media_type == "video" and filename:
        from app import video_processor
        video_processor.trigger(
            new_row["id"], filename, DATABASE_PATH,
            AWS_S3_BUCKET, AWS_S3_REGION, AWS_CLOUDFRONT_URL,
        )
    return jsonify(new_row), 201


@admin_api_bp.route("/media/<int:mid>/process", methods=["POST"])
@_api_admin_required
def media_process(mid):
    """Manually trigger HLS processing for an existing video."""
    if not USE_S3:
        return jsonify({"error": "S3 not configured"}), 400
    db = get_db()
    row = db.execute("SELECT * FROM media WHERE id=?", (mid,)).fetchone()
    if not row:
        return jsonify({"error": "Not found"}), 404
    row = _row(row)
    if row.get("media_type") != "video" or not row.get("filename"):
        return jsonify({"error": "Not a video with a file"}), 400
    db.execute("UPDATE media SET hls_status='pending' WHERE id=?", (mid,))
    db.commit()
    from app import video_processor
    video_processor.trigger(
        mid, row["filename"], DATABASE_PATH,
        AWS_S3_BUCKET, AWS_S3_REGION, AWS_CLOUDFRONT_URL,
    )
    return jsonify({"ok": True, "status": "processing"})


@admin_api_bp.route("/media/<int:mid>", methods=["PUT"])
@_api_admin_required
def media_update(mid):
    db = get_db()
    # Accept either JSON (metadata only) or multipart (with optional thumbnail)
    if request.content_type and 'multipart' in request.content_type:
        f = request.form
        thumbnail = None
        thumb_file = request.files.get("thumbnail")
        if thumb_file and thumb_file.filename and _ext(thumb_file.filename) in ALLOWED_IMAGES:
            thumbnail = _save_upload(thumb_file, "photos")
        duration_sec = None
        try:
            raw = f.get("duration_sec")
            if raw:
                duration_sec = int(raw)
        except (ValueError, TypeError):
            pass
        if thumbnail:
            db.execute(
                "UPDATE media SET title=?, youtube_url=?, description=?, event_id=?, is_public=?,"
                " thumbnail_filename=?, duration_sec=COALESCE(?,duration_sec) WHERE id=?",
                (f.get("title") or "", f.get("youtube_url") or None,
                 f.get("description") or None, f.get("event_id") or None,
                 1 if f.get("is_public", "1") != "0" else 0,
                 thumbnail, duration_sec, mid),
            )
        else:
            db.execute(
                "UPDATE media SET title=?, youtube_url=?, description=?, event_id=?, is_public=?,"
                " duration_sec=COALESCE(?,duration_sec) WHERE id=?",
                (f.get("title") or "", f.get("youtube_url") or None,
                 f.get("description") or None, f.get("event_id") or None,
                 1 if f.get("is_public", "1") != "0" else 0,
                 duration_sec, mid),
            )
    else:
        data = request.get_json()
        db.execute(
            "UPDATE media SET title=?, youtube_url=?, description=?, event_id=?, is_public=? WHERE id=?",
            (data.get("title") or "", data.get("youtube_url") or None,
             data.get("description") or None, data.get("event_id") or None,
             1 if data.get("is_public", True) else 0, mid),
        )
    db.commit()
    row = _row(db.execute(
        "SELECT m.*, e.title as event_title FROM media m"
        " LEFT JOIN events e ON e.id=m.event_id WHERE m.id=?", (mid,)
    ).fetchone())
    return jsonify(row)


@admin_api_bp.route("/media/<int:mid>", methods=["DELETE"])
@_api_admin_required
def media_delete(mid):
    db = get_db()
    db.execute("DELETE FROM media WHERE id=?", (mid,))
    db.commit()
    return jsonify({"ok": True})


@admin_api_bp.route("/media/bulk", methods=["DELETE"])
@_api_admin_required
def media_bulk_delete():
    db = get_db()
    data = request.get_json()
    ids = [int(i) for i in data.get("ids", [])]
    for mid in ids:
        row = db.execute("SELECT filename, thumbnail_filename FROM media WHERE id=?", (mid,)).fetchone()
        if row:
            if row["filename"]:
                storage.delete_file("audio" if row["filename"].endswith(('.mp3','.m4a','.ogg','.opus')) else "videos", row["filename"])
            if row["thumbnail_filename"]:
                storage.delete_file("photos", row["thumbnail_filename"])
        db.execute("DELETE FROM media WHERE id=?", (mid,))
    db.commit()
    return jsonify({"ok": True, "count": len(ids)})


@admin_api_bp.route("/media/bulk", methods=["PUT"])
@_api_admin_required
def media_bulk():
    db = get_db()
    data = request.get_json()
    ids = [int(i) for i in data.get("ids", [])]
    if not ids:
        return jsonify({"ok": True, "count": 0})
    if "event_id" in data:
        event_id = int(data["event_id"]) if data["event_id"] else None
        db.execute(f"UPDATE media SET event_id=? WHERE id IN ({','.join('?'*len(ids))})", [event_id, *ids])
    else:
        is_public = 1 if data.get("is_public") else 0
        db.execute(f"UPDATE media SET is_public=? WHERE id IN ({','.join('?'*len(ids))})", [is_public, *ids])
    db.commit()
    return jsonify({"ok": True, "count": len(ids)})


# ── Hero image ────────────────────────────────────────────────────────────────

@admin_api_bp.route("/content/hero-image", methods=["POST"])
@_api_admin_required
def hero_image_upload():
    db = get_db()
    f = request.files.get("image")
    if not f or not f.filename:
        return jsonify({"error": "Nav faila"}), 400
    if _ext(f.filename) not in ALLOWED_IMAGES:
        return jsonify({"error": "Neatļauts formāts"}), 400
    filename = _save_upload(f, "photos")
    from app import storage as _storage
    url = _storage.public_url("photos", filename)
    db.execute(
        "INSERT INTO content_blocks (key,content,updated_at) VALUES (?,?,datetime('now'))"
        " ON CONFLICT(key) DO UPDATE SET content=excluded.content, updated_at=excluded.updated_at",
        ("hero_image", url),
    )
    db.commit()
    return jsonify({"url": url}), 201


# ── Content ───────────────────────────────────────────────────────────────────

@admin_api_bp.route("/content", methods=["GET"])
@_api_admin_required
def content_get():
    db = get_db()
    rows = db.execute("SELECT * FROM content_blocks ORDER BY key").fetchall()
    return jsonify(_rows(rows))


@admin_api_bp.route("/content", methods=["PUT"])
@_api_admin_required
def content_update():
    db = get_db()
    data = request.get_json()  # {key: content, ...}
    for key, content in data.items():
        db.execute(
            "INSERT INTO content_blocks (key,content,updated_at) VALUES (?,?,datetime('now'))"
            " ON CONFLICT(key) DO UPDATE SET content=excluded.content, updated_at=excluded.updated_at",
            (key, content),
        )
    db.commit()
    rows = db.execute("SELECT * FROM content_blocks ORDER BY key").fetchall()
    return jsonify(_rows(rows))


# ── Schedule ──────────────────────────────────────────────────────────────────

@admin_api_bp.route("/schedule", methods=["GET"])
@_api_admin_required
def schedule_get():
    db = get_db()
    DAYS = ["Pirmdiena", "Otrdiena", "Trešdiena", "Ceturtdiena", "Piektdiena", "Sestdiena", "Svētdiena"]
    slots = _rows(db.execute(
        "SELECT * FROM rehearsal_schedule ORDER BY day_of_week, time_of_day"
    ).fetchall())
    for s in slots:
        s["day_name"] = DAYS[s["day_of_week"]] if 0 <= s["day_of_week"] <= 6 else str(s["day_of_week"])
    exceptions = _rows(db.execute(
        "SELECT * FROM rehearsal_exceptions ORDER BY rehearsal_date DESC LIMIT 30"
    ).fetchall())
    return jsonify({"slots": slots, "exceptions": exceptions})


@admin_api_bp.route("/schedule/slots", methods=["POST"])
@_api_admin_required
def schedule_slot_create():
    db = get_db()
    data = request.get_json()
    db.execute(
        "INSERT INTO rehearsal_schedule (day_of_week, time_of_day, location, is_active, note)"
        " VALUES (?,?,?,?,?)",
        (int(data.get("day_of_week", 0)), data.get("time_of_day", ""),
         data.get("location") or None, 1 if data.get("is_active", True) else 0,
         data.get("note") or None),
    )
    db.commit()
    DAYS = ["Pirmdiena", "Otrdiena", "Trešdiena", "Ceturtdiena", "Piektdiena", "Sestdiena", "Svētdiena"]
    row = _row(db.execute("SELECT * FROM rehearsal_schedule ORDER BY id DESC LIMIT 1").fetchone())
    row["day_name"] = DAYS[row["day_of_week"]]
    return jsonify(row), 201


@admin_api_bp.route("/schedule/slots/<int:sid>", methods=["PUT"])
@_api_admin_required
def schedule_slot_update(sid):
    db = get_db()
    data = request.get_json()
    db.execute(
        "UPDATE rehearsal_schedule SET day_of_week=?, time_of_day=?, location=?, is_active=?, note=? WHERE id=?",
        (int(data.get("day_of_week", 0)), data.get("time_of_day", ""),
         data.get("location") or None, 1 if data.get("is_active", True) else 0,
         data.get("note") or None, sid),
    )
    db.commit()
    DAYS = ["Pirmdiena", "Otrdiena", "Trešdiena", "Ceturtdiena", "Piektdiena", "Sestdiena", "Svētdiena"]
    row = _row(db.execute("SELECT * FROM rehearsal_schedule WHERE id=?", (sid,)).fetchone())
    row["day_name"] = DAYS[row["day_of_week"]]
    return jsonify(row)


@admin_api_bp.route("/schedule/slots/<int:sid>", methods=["DELETE"])
@_api_admin_required
def schedule_slot_delete(sid):
    db = get_db()
    db.execute("DELETE FROM rehearsal_schedule WHERE id=?", (sid,))
    db.commit()
    return jsonify({"ok": True})


@admin_api_bp.route("/schedule/exceptions", methods=["POST"])
@_api_admin_required
def schedule_exception_create():
    db = get_db()
    data = request.get_json()
    db.execute(
        "INSERT OR REPLACE INTO rehearsal_exceptions (rehearsal_date,is_cancelled,note)"
        " VALUES (?,?,?)",
        (data.get("rehearsal_date"), 1 if data.get("is_cancelled", True) else 0,
         data.get("note") or None),
    )
    db.commit()
    row = db.execute(
        "SELECT * FROM rehearsal_exceptions ORDER BY id DESC LIMIT 1"
    ).fetchone()
    return jsonify(_row(row)), 201


@admin_api_bp.route("/schedule/exceptions/<int:eid>", methods=["DELETE"])
@_api_admin_required
def schedule_exception_delete(eid):
    db = get_db()
    db.execute("DELETE FROM rehearsal_exceptions WHERE id=?", (eid,))
    db.commit()
    return jsonify({"ok": True})


# ── Announcements ─────────────────────────────────────────────────────────────

@admin_api_bp.route("/announcements", methods=["GET"])
@_api_admin_required
def announcements_list():
    db = get_db()
    rows = db.execute(
        "SELECT * FROM announcements ORDER BY is_pinned DESC, created_at DESC"
    ).fetchall()
    return jsonify(_rows(rows))


@admin_api_bp.route("/announcements", methods=["POST"])
@_api_admin_required
def announcement_create():
    db = get_db()
    data = request.get_json()
    title = (data.get("title") or "").strip()
    body = (data.get("body") or "").strip()
    if not title or not body:
        return jsonify({"error": "Virsraksts un teksts ir obligāti"}), 400
    db.execute(
        "INSERT INTO announcements (title,body,is_pinned) VALUES (?,?,?)",
        (title, body, 1 if data.get("is_pinned") else 0),
    )
    db.commit()
    row = db.execute("SELECT * FROM announcements ORDER BY id DESC LIMIT 1").fetchone()
    return jsonify(_row(row)), 201


@admin_api_bp.route("/announcements/<int:aid>", methods=["DELETE"])
@_api_admin_required
def announcement_delete(aid):
    db = get_db()
    db.execute("DELETE FROM announcements WHERE id=?", (aid,))
    db.commit()
    return jsonify({"ok": True})


# ── Events list (for selects) ─────────────────────────────────────────────────

@admin_api_bp.route("/events-select", methods=["GET"])
@_api_admin_required
def events_select():
    db = get_db()
    rows = db.execute(
        "SELECT id, title, event_date FROM events ORDER BY event_date DESC"
    ).fetchall()
    return jsonify(_rows(rows))

# ── Users ──────────────────────────────────────────────────────────────────────

@admin_api_bp.route("/users", methods=["GET"])
@_api_admin_required
def users_list():
    db = get_db()
    rows = db.execute(
        "SELECT id, username, email, role, display_name, created_at FROM users ORDER BY id"
    ).fetchall()
    return jsonify(_rows(rows))


@admin_api_bp.route("/users", methods=["POST"])
@_api_admin_required
def user_create():
    db = get_db()
    data = request.get_json()
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()
    if not username:
        return jsonify({"error": "Lietotājvārds ir obligāts"}), 400
    if len(password) < 8:
        return jsonify({"error": "Parolei jābūt vismaz 8 rakstzīmēm"}), 400
    if db.execute("SELECT id FROM users WHERE username=?", (username,)).fetchone():
        return jsonify({"error": "Lietotājvārds jau aizņemts"}), 400
    db.execute(
        "INSERT INTO users (username, password_hash, email, role, display_name) VALUES (?,?,?,?,?)",
        (username, generate_password_hash(password),
         (data.get("email") or "").strip() or None,
         data.get("role", "member"),
         (data.get("display_name") or "").strip() or username),
    )
    db.commit()
    row = db.execute(
        "SELECT id, username, email, role, display_name, created_at FROM users WHERE username=?",
        (username,)
    ).fetchone()
    return jsonify(_row(row)), 201


@admin_api_bp.route("/users/<int:uid>", methods=["PUT"])
@_api_admin_required
def user_update(uid):
    db = get_db()
    data = request.get_json()
    username = (data.get("username") or "").strip()
    if not username:
        return jsonify({"error": "Lietotājvārds ir obligāts"}), 400
    if db.execute("SELECT id FROM users WHERE username=? AND id!=?", (username, uid)).fetchone():
        return jsonify({"error": "Lietotājvārds jau aizņemts"}), 400
    if uid == session.get("user_id") and data.get("role") != "admin":
        return jsonify({"error": "Nevar mainīt savas tiesības"}), 400
    db.execute(
        "UPDATE users SET username=?, email=?, role=?, display_name=? WHERE id=?",
        (username,
         (data.get("email") or "").strip() or None,
         data.get("role", "member"),
         (data.get("display_name") or "").strip() or username,
         uid),
    )
    db.commit()
    row = db.execute(
        "SELECT id, username, email, role, display_name, created_at FROM users WHERE id=?",
        (uid,)
    ).fetchone()
    return jsonify(_row(row))


@admin_api_bp.route("/users/<int:uid>", methods=["DELETE"])
@_api_admin_required
def user_delete(uid):
    if uid == session.get("user_id"):
        return jsonify({"error": "Nevar dzēst savu kontu"}), 400
    db = get_db()
    db.execute("DELETE FROM users WHERE id=?", (uid,))
    db.commit()
    return jsonify({"ok": True})


@admin_api_bp.route("/users/<int:uid>/reset-password", methods=["POST"])
@_api_admin_required
def user_reset_password(uid):
    data = request.get_json()
    password = (data.get("password") or "").strip()
    if len(password) < 8:
        return jsonify({"error": "Parolei jābūt vismaz 8 rakstzīmēm"}), 400
    db = get_db()
    if not db.execute("SELECT id FROM users WHERE id=?", (uid,)).fetchone():
        return jsonify({"error": "Lietotājs nav atrasts"}), 404
    db.execute("UPDATE users SET password_hash=? WHERE id=?", (generate_password_hash(password), uid))
    db.commit()
    return jsonify({"ok": True})
