import os
from flask import Blueprint, session, redirect, url_for, send_file

admin_bp = Blueprint("admin", __name__, url_prefix="/admin")

_ADMIN_HTML = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "frontend_dist", "admin.html")
)


def _auth_check():
    if not session.get("user_id"):
        return redirect(url_for("auth.login", next="/admin"))
    if session.get("role") != "admin":
        return redirect("/")
    return None


@admin_bp.route("/", defaults={"path": ""})
@admin_bp.route("/<path:path>")
def admin_spa(path):
    denied = _auth_check()
    if denied:
        return denied
    return send_file(_ADMIN_HTML)
