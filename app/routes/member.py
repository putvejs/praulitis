from datetime import date, timedelta
from flask import Blueprint, render_template

from app.auth import login_required
from app.database import get_db

member_bp = Blueprint("member", __name__, url_prefix="/member")

DAYS_LV = ["Pirmdiena", "Otrdiena", "Trešdiena", "Ceturtdiena", "Piektdiena", "Sestdiena", "Svētdiena"]


@member_bp.route("/")
@login_required
def dashboard():
    db = get_db()
    pinned = db.execute(
        "SELECT * FROM announcements WHERE is_pinned=1 ORDER BY created_at DESC"
    ).fetchall()
    recent = db.execute(
        "SELECT * FROM announcements WHERE is_pinned=0 ORDER BY created_at DESC LIMIT 5"
    ).fetchall()
    schedule = _build_schedule(db)
    return render_template("member/dashboard.html",
                           pinned=pinned, recent=recent, schedule=schedule)


@member_bp.route("/schedule")
@login_required
def schedule():
    db = get_db()
    schedule = _build_schedule(db, weeks=8)
    slots = db.execute(
        "SELECT *, ? as day_name FROM rehearsal_schedule WHERE is_active=1 ORDER BY day_of_week",
        (None,),
    ).fetchall()
    return render_template("member/schedule.html", schedule=schedule, slots=slots,
                           days_lv=DAYS_LV)


@member_bp.route("/announcements")
@login_required
def announcements():
    db = get_db()
    items = db.execute(
        "SELECT * FROM announcements ORDER BY is_pinned DESC, created_at DESC"
    ).fetchall()
    return render_template("member/announcements.html", items=items)


def _build_schedule(db, weeks: int = 4) -> list:
    """Return list of upcoming rehearsal dates for the next `weeks` weeks."""
    slots = db.execute(
        "SELECT * FROM rehearsal_schedule WHERE is_active=1 ORDER BY day_of_week, time_of_day"
    ).fetchall()
    today = date.today()
    end = today + timedelta(weeks=weeks)

    # Build set of exception dates
    exceptions = {
        row["rehearsal_date"]: dict(row)
        for row in db.execute(
            "SELECT * FROM rehearsal_exceptions WHERE rehearsal_date >= ?", (today.isoformat(),)
        ).fetchall()
    }

    result = []
    current = today
    while current <= end:
        dow = current.weekday()  # 0=Mon
        for slot in slots:
            if slot["day_of_week"] == dow:
                d_str = current.isoformat()
                exc = exceptions.get(d_str)
                result.append({
                    "date": current,
                    "date_str": d_str,
                    "day_name": DAYS_LV[dow],
                    "time": slot["time_of_day"],
                    "location": slot["location"],
                    "note": exc["note"] if exc else slot["note"],
                    "cancelled": exc["is_cancelled"] if exc else 0,
                })
        current += timedelta(days=1)

    result.sort(key=lambda x: (x["date_str"], x["time"]))
    return result
