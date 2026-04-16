from flask import Blueprint, jsonify
from flask_cors import cross_origin

from app.database import get_db
from app import storage

api_bp = Blueprint('api', __name__, url_prefix='/api')

# Gradient palette for member cards (cycles if more than 7 members)
_MEMBER_GRADS = [
    "160deg,#2d5c46,#1c3a2e",
    "160deg,#2d5c46,#1a3a2e",
    "160deg,#3a5230,#243820",
    "160deg,#1c3a2e,#122818",
    "160deg,#2e4535,#1e3226",
    "160deg,#384a35,#252e22",
    "160deg,#405535,#2a3822",
]

_VIDEO_GRADS = [
    "135deg,#1c3a2e,#0e2018",
    "135deg,#1c4030,#132a20",
    "135deg,#1e3a30,#152a22",
]

_MONTHS_LV = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jūn', 'Jūl', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec']


def _fmt_duration(seconds):
    """Convert integer seconds to mm:ss string."""
    if not seconds:
        return "0:00"
    return f"{seconds // 60}:{seconds % 60:02d}"


def _initials(name: str) -> str:
    parts = name.split()
    if len(parts) >= 2:
        return (parts[0][0] + parts[-1][0]).upper()
    return name[:2].upper()


def _event_day_month(event_date: str):
    """Split '2025-06-21' into day='21', month='Jūn 2025'."""
    parts = event_date.split('-')
    if len(parts) < 3:
        return '', ''
    year, m, d = parts
    return d.lstrip('0'), f"{_MONTHS_LV[int(m)]} {year}"


@api_bp.route('/members')
@cross_origin()
def get_members():
    db = get_db()
    rows = db.execute(
        "SELECT id, name, role, bio, photo_filename, sort_order, joined_year"
        " FROM members WHERE is_active=1 ORDER BY sort_order, name"
    ).fetchall()
    result = []
    for i, r in enumerate(rows):
        role = r['role'] or ''
        # Use first segment before · as instrument label
        instrument = role.split('·')[0].strip() if '·' in role else role
        result.append({
            'id': r['id'],
            'initials': _initials(r['name']),
            'name': r['name'],
            'role': role,
            'instrument': instrument,
            'photo_filename': r['photo_filename'],
            'photo_url': storage.public_url('photos', r['photo_filename']),
            'grad': _MEMBER_GRADS[i % len(_MEMBER_GRADS)],
        })
    return jsonify(result)


@api_bp.route('/events')
@cross_origin()
def get_events():
    db = get_db()
    rows = db.execute(
        "SELECT id, title, slug, event_date, event_time, location, description, event_type"
        " FROM events WHERE is_public=1 ORDER BY event_date DESC"
    ).fetchall()
    result = []
    for r in rows:
        day, month = _event_day_month(r['event_date'])
        result.append({
            'id': r['id'],
            'day': day,
            'month': month,
            'title': r['title'],
            'slug': r['slug'],
            'venue': r['location'] or '',
            'date': r['event_date'],
            'badge': None,
        })
    return jsonify(result)


@api_bp.route('/gallery')
@cross_origin()
def get_gallery():
    db = get_db()
    rows = db.execute(
        "SELECT id, filename, caption, album, taken_date, is_public"
        " FROM gallery WHERE is_public=1 ORDER BY taken_date DESC, id DESC"
    ).fetchall()
    spans = [6, 3, 3, 4, 8, 4]
    result = []
    for i, r in enumerate(rows):
        result.append({
            'id': r['id'],
            'filename': r['filename'],
            'url': storage.public_url('photos', r['filename']),
            'caption': r['caption'] or '',
            'album': r['album'] or '',
            'taken_date': r['taken_date'] or '',
            'span': spans[i % len(spans)],
            'private': False,
        })
    return jsonify(result)


@api_bp.route('/music')
@cross_origin()
def get_music():
    db = get_db()
    import re as _re2
    _adate = _re2.compile(r'(\d{4}-\d{2}-\d{2})')
    def _audio_date(r):
        m = _adate.search(r['whatsapp_ts'] or '')
        return m.group(1) if m else (r['created_at'] or '')[:10]
    rows = db.execute(
        "SELECT id, title, description, filename, duration_sec, whatsapp_ts, created_at"
        " FROM media WHERE media_type='audio' AND is_public=1"
    ).fetchall()
    rows = sorted(rows, key=_audio_date, reverse=True)
    result = []
    for r in rows:
        m = _adate.search(r['whatsapp_ts'] or '')
        result.append({
            'id': r['id'],
            'title': r['title'],
            'album': r['description'] or 'Praulits',
            'duration': _fmt_duration(r['duration_sec']),
            'filename': r['filename'],
            'url': storage.public_url('audio', r['filename']),
            'date': m.group(1) if m else (r['created_at'] or '')[:10],
        })
    return jsonify(result)


@api_bp.route('/videos')
@cross_origin()
def get_videos():
    db = get_db()
    rows = db.execute(
        "SELECT id, title, youtube_url, filename, thumbnail_filename, duration_sec,"
        " created_at, whatsapp_ts, description, hls_path"
        " FROM media WHERE media_type='video' AND is_public=1"
        " ORDER BY created_at DESC"
    ).fetchall()
    import re as _re
    _date_re = _re.compile(r'(\d{4}-\d{2}-\d{2})')
    def _media_date(r):
        m = _date_re.search(r['whatsapp_ts'] or '')
        return m.group(1) if m else (r['created_at'] or '')[:10]
    rows = sorted(rows, key=_media_date, reverse=True)
    result = []
    for i, r in enumerate(rows):
        date_str = _media_date(r)
        hls_path = r['hls_path']
        hls_url = storage.public_url_key(hls_path) if hls_path else None
        result.append({
            'id': r['id'],
            'title': r['title'],
            'youtube_url': r['youtube_url'],
            'filename': r['filename'],
            'url': storage.public_url('videos', r['filename']),
            'hls_url': hls_url,
            'thumbnail': r['thumbnail_filename'],
            'thumbnail_url': storage.public_url('photos', r['thumbnail_filename']),
            'dur': _fmt_duration(r['duration_sec']),
            'date': date_str,
            'grad': _VIDEO_GRADS[i % len(_VIDEO_GRADS)],
        })
    return jsonify(result)


@api_bp.route('/content')
@cross_origin()
def get_content():
    db = get_db()
    rows = db.execute("SELECT key, content FROM content_blocks").fetchall()
    return jsonify({r['key']: r['content'] for r in rows})
