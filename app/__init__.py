import os
import logging
from datetime import datetime, timedelta
from flask import Flask, send_from_directory, abort, request, g

from app.config import SECRET_KEY
from app.database import close_db, init_db

# Path to Vite build output (praulitis/frontend_dist/)
_REACT_BUILD = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend_dist'))


def create_app():
    app = Flask(__name__, template_folder="templates", static_folder="static")
    app.secret_key = SECRET_KEY
    app.permanent_session_lifetime = timedelta(hours=24)
    app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
    app.config['SESSION_COOKIE_HTTPONLY'] = True

    app.teardown_appcontext(close_db)

    _log = logging.getLogger("praulitis.requests")

    @app.after_request
    def log_request(response):
        if request.path.startswith('/api/'):
            _log.info("%s %s → %s", request.method, request.path, response.status_code)
        return response

    app.jinja_env.globals["now"] = datetime.now
    app.jinja_env.globals["today"] = lambda: datetime.today().date()

    # Blueprints
    from app.auth import auth_bp
    from app.routes.public import public_bp
    from app.routes.member import member_bp
    from app.routes.admin import admin_bp
    from app.api.public import api_bp
    from app.api.admin_api import admin_api_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(public_bp)
    app.register_blueprint(member_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(api_bp)
    app.register_blueprint(admin_api_bp)

    # SPA catch-all: serve React build for everything not handled above
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_spa(path):
        # Let Flask-registered routes handle their own paths
        if path.startswith(('static/', 'admin/', 'member/', 'api/', 'login', 'logout', 'search', 'events/')):
            abort(404)
        if not os.path.isdir(_REACT_BUILD):
            abort(503)
        full = os.path.join(_REACT_BUILD, path)
        if path and os.path.isfile(full):
            return send_from_directory(_REACT_BUILD, path)
        return send_from_directory(_REACT_BUILD, 'index.html')

    return app
