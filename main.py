import logging
from app import create_app
from app.database import init_db
from app.config import FLASK_PORT

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)

if __name__ == "__main__":
    init_db()
    app = create_app()
    from waitress import serve
    logging.getLogger("waitress").setLevel(logging.INFO)
    print(f"Praulitis running on http://0.0.0.0:{FLASK_PORT}")
    serve(app, host="0.0.0.0", port=FLASK_PORT, connection_limit=500, threads=8)
