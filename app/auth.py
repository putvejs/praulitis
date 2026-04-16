from functools import wraps
from flask import session, redirect, url_for, flash, request, render_template, Blueprint, current_app
from werkzeug.security import generate_password_hash, check_password_hash

from app.database import get_db

auth_bp = Blueprint("auth", __name__)


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("user_id"):
            return redirect(url_for("auth.login", next=request.path))
        return f(*args, **kwargs)
    return decorated


def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("user_id"):
            return redirect(url_for("auth.login", next=request.path))
        if session.get("role") != "admin":
            flash("Nepietiekamas tiesības.", "error")
            return redirect("/")
        return f(*args, **kwargs)
    return decorated


@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    if session.get("user_id"):
        return redirect("/admin/" if session.get("role") == "admin" else "/member/")

    error = None
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")
        db = get_db()
        user = db.execute(
            "SELECT * FROM users WHERE username = ?", (username,)
        ).fetchone()
        if user and check_password_hash(user["password_hash"], password):
            session.permanent = True
            session["user_id"] = user["id"]
            session["username"] = user["username"]
            session["role"] = user["role"]
            next_url = request.form.get("next") or (
                "/admin/" if user["role"] == "admin" else "/member/"
            )
            return redirect(next_url, 303)
        error = "Nepareizs lietotājvārds vai parole."

    return render_template("login.html", error=error, next=request.args.get("next", ""))


@auth_bp.route("/logout")
def logout():
    session.clear()
    resp = redirect("/login")
    # Explicitly delete the session cookie so the browser drops it immediately
    cookie_name = current_app.config.get("SESSION_COOKIE_NAME", "session")
    resp.delete_cookie(cookie_name)
    return resp


def create_user(username: str, password: str, role: str = "member", display_name: str = None):
    """Create or update a user. Used by create_admin.py script."""
    import sqlite3
    from app.config import DATABASE_PATH
    conn = sqlite3.connect(DATABASE_PATH)
    pw_hash = generate_password_hash(password)
    conn.execute(
        "INSERT INTO users (username, password_hash, role, display_name) VALUES (?,?,?,?)"
        " ON CONFLICT(username) DO UPDATE SET password_hash=excluded.password_hash, role=excluded.role",
        (username, pw_hash, role, display_name or username),
    )
    conn.commit()
    conn.close()
