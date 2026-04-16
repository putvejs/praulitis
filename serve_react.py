import os
from flask import Flask, send_from_directory

# Adjust the path if your structure is different
REACT_BUILD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../frontend/dist'))

app = Flask(__name__, static_folder=REACT_BUILD_DIR, static_url_path="/")

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5002, debug=True)
