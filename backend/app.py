"""
backend/app.py

Flask REST API for Movie Recommender System.
Loads precomputed recommendation artifacts and serves:
- GET /api/health
- GET /api/movies?q=<title>
- GET /api/recommend/<movie_id>?limit=5
- GET /api/poster/<movie_id> (fetches and caches TMDB movie poster paths/URLs)
"""

import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path
from flask import Flask, jsonify, request
from flask_cors import CORS

# Load environment variables from .env if present
try:
    from dotenv import load_dotenv
    base_dir = Path(__file__).resolve().parent
    load_dotenv(base_dir / ".env")
    load_dotenv(base_dir.parent / ".env")
except ImportError:
    pass

# Fallback lightweight .env parser if python-dotenv is not active
def _load_fallback_env():
    for p in [Path(__file__).resolve().parent / ".env", Path(__file__).resolve().parent.parent / ".env"]:
        if p.is_file():
            try:
                with open(p, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            k, v = line.split("=", 1)
                            k = k.strip()
                            if k not in os.environ:
                                os.environ[k] = v.strip().strip("'\"")
            except Exception:
                pass

_load_fallback_env()

app = Flask(__name__)
CORS(app, expose_headers=["X-Total-Count", "X-Offset", "X-Limit"])

# -----------------------------------------------------------------------------
# Global in-memory storage for precomputed artifacts & poster cache
# -----------------------------------------------------------------------------
CATALOG = []
CATALOG_BY_ID = {}
RECOMMENDATIONS = {}
INITIAL_MOVIES = []
POSTER_CACHE = {}
POSTER_CACHE_FILE = None
TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500"


def get_release_year(release_date_str):
    """Safely extracts a 4-digit release year integer from a release_date string."""
    if not release_date_str or not isinstance(release_date_str, str):
        return None
    cleaned = release_date_str.strip()
    if len(cleaned) >= 4 and cleaned[:4].isdigit():
        return int(cleaned[:4])
    return None


def get_tmdb_api_key():
    """Retrieves TMDB API key from environment variable."""
    return os.environ.get("TMDB_API_KEY", "").strip()


def load_poster_cache(model_dir: Path):
    """Loads persistent poster cache from disk if available."""
    global POSTER_CACHE, POSTER_CACHE_FILE
    POSTER_CACHE_FILE = model_dir / "poster_cache.json"
    if POSTER_CACHE_FILE.is_file():
        try:
            with open(POSTER_CACHE_FILE, "r", encoding="utf-8") as f:
                POSTER_CACHE = json.load(f)
        except Exception as e:
            print(f"[WARN] Failed to load poster cache: {e}")
            POSTER_CACHE = {}


def save_poster_cache():
    """Saves poster cache to disk."""
    if POSTER_CACHE_FILE:
        try:
            with open(POSTER_CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(POSTER_CACHE, f, ensure_ascii=False, indent=2)
        except Exception:
            pass


def fetch_tmdb_poster(movie_id: int):
    """
    Retrieves poster path and complete URL for a given movie ID.
    Checks in-memory/disk cache first; queries TMDB API if key is present.
    Returns: dict with {"poster_path": str|None, "poster_url": str|None}
    """
    id_key = str(movie_id)
    cached = POSTER_CACHE.get(id_key)
    if cached and cached.get("poster_path"):
        return cached

    api_key = get_tmdb_api_key()
    if not api_key:
        return {"poster_path": None, "poster_url": None}

    url = f"https://api.themoviedb.org/3/movie/{movie_id}?api_key={api_key}&language=en-US"

    for attempt in range(2):
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
            )
            with urllib.request.urlopen(req, timeout=6) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode("utf-8"))
                    poster_path = data.get("poster_path")
                    poster_url = f"{TMDB_IMAGE_BASE_URL}{poster_path}" if poster_path else None
                    entry = {
                        "poster_path": poster_path,
                        "poster_url": poster_url
                    }
                    POSTER_CACHE[id_key] = entry
                    save_poster_cache()
                    return entry
        except urllib.error.HTTPError as e:
            if e.code == 404:
                entry = {"poster_path": None, "poster_url": None}
                POSTER_CACHE[id_key] = entry
                save_poster_cache()
                return entry
            time.sleep(0.3)
        except Exception:
            time.sleep(0.3)

    # Fallback to curl.exe on Windows for Cloudflare TLS renegotiation support
    try:
        import subprocess
        proc = subprocess.run(
            ["curl.exe", "-s", "--max-time", "6", url],
            capture_output=True,
            text=True,
            check=False
        )
        if proc.returncode == 0 and proc.stdout:
            data = json.loads(proc.stdout)
            if "poster_path" in data or "status_code" in data:
                if data.get("status_code") == 34:  # Not found
                    entry = {"poster_path": None, "poster_url": None}
                    POSTER_CACHE[id_key] = entry
                    save_poster_cache()
                    return entry
                poster_path = data.get("poster_path")
                poster_url = f"{TMDB_IMAGE_BASE_URL}{poster_path}" if poster_path else None
                entry = {
                    "poster_path": poster_path,
                    "poster_url": poster_url
                }
                POSTER_CACHE[id_key] = entry
                save_poster_cache()
                return entry
    except Exception:
        pass

    return {"poster_path": None, "poster_url": None}


def format_movie_summary(movie):
    """Formats minimal movie metadata for catalog / search results."""
    m_id = movie["id"]
    poster_info = POSTER_CACHE.get(str(m_id), {})
    poster_path = poster_info.get("poster_path") or movie.get("poster_path")
    poster_url = poster_info.get("poster_url") or (f"{TMDB_IMAGE_BASE_URL}{poster_path}" if poster_path else None)

    return {
        "id": m_id,
        "title": movie["title"],
        "overview": movie.get("overview", ""),
        "release_year": get_release_year(movie.get("release_date")),
        "rating": movie.get("vote_average"),
        "poster_path": poster_path,
        "poster_url": poster_url
    }


def format_movie_detail(movie):
    """Formats full movie metadata for recommendation results."""
    m_id = movie["id"]
    poster_data = fetch_tmdb_poster(m_id)

    return {
        "id": m_id,
        "title": movie["title"],
        "overview": movie.get("overview", ""),
        "release_year": get_release_year(movie.get("release_date")),
        "rating": movie.get("vote_average"),
        "poster_path": poster_data.get("poster_path"),
        "poster_url": poster_data.get("poster_url")
    }


def load_artifacts():
    """Locates and loads movie_catalog.json and recommendations.json once at startup."""
    global CATALOG, CATALOG_BY_ID, RECOMMENDATIONS, INITIAL_MOVIES

    base_dir = Path(__file__).resolve().parent
    project_root = base_dir.parent

    candidate_dirs = [
        project_root / "model",
        base_dir / "model",
        Path("model").resolve(),
    ]

    catalog_path = None
    recs_path = None

    for candidate in candidate_dirs:
        cat = candidate / "movie_catalog.json"
        rec = candidate / "recommendations.json"
        if cat.is_file() and rec.is_file():
            catalog_path = cat
            recs_path = rec
            break

    if not catalog_path or not recs_path:
        raise FileNotFoundError(
            f"Artifacts not found in any expected location: {[str(d) for d in candidate_dirs]}"
        )

    # Load catalog
    with open(catalog_path, "r", encoding="utf-8") as f:
        CATALOG = json.load(f)

    if not isinstance(CATALOG, list) or len(CATALOG) == 0:
        raise ValueError(f"Invalid catalog artifact at {catalog_path}: must be non-empty list.")

    # Load recommendations
    with open(recs_path, "r", encoding="utf-8") as f:
        RECOMMENDATIONS = json.load(f)

    if not isinstance(RECOMMENDATIONS, dict) or len(RECOMMENDATIONS) == 0:
        raise ValueError(f"Invalid recommendations artifact at {recs_path}: must be non-empty dict.")

    # Index by integer ID
    CATALOG_BY_ID = {movie["id"]: movie for movie in CATALOG if "id" in movie}

    # Load persistent poster cache
    load_poster_cache(catalog_path.parent)

    # Pre-compute sensible initial list: top 20 by vote_count descending
    sorted_popular = sorted(
        CATALOG,
        key=lambda m: m.get("vote_count", 0),
        reverse=True
    )
    INITIAL_MOVIES = [format_movie_summary(m) for m in sorted_popular[:20]]

    key_status = "Configured" if get_tmdb_api_key() else "Not Configured"
    print(
        f"[INFO] Loaded {len(CATALOG_BY_ID)} movies and {len(RECOMMENDATIONS)} recommendation sets from {catalog_path.parent} (TMDB API Key: {key_status})"
    )


# Load artifacts once upon module initialization
load_artifacts()


# -----------------------------------------------------------------------------
# API Endpoints
# -----------------------------------------------------------------------------

@app.route("/api/health", methods=["GET"])
def health_check():
    """Healthcheck endpoint confirming server status and artifact availability."""
    return jsonify({
        "status": "healthy",
        "artifacts_loaded": len(CATALOG_BY_ID) > 0 and len(RECOMMENDATIONS) > 0,
        "total_movies": len(CATALOG_BY_ID),
        "recommendation_entries": len(RECOMMENDATIONS),
        "tmdb_configured": bool(get_tmdb_api_key()),
        "posters_cached": len(POSTER_CACHE)
    }), 200


@app.route("/api/poster/<movie_id>", methods=["GET"])
def get_movie_poster_endpoint(movie_id):
    """
    Retrieves the poster path and complete image URL for a given movie ID.
    Uses cached data when available; queries TMDB if TMDB_API_KEY is configured.
    """
    try:
        m_id_int = int(movie_id)
    except (ValueError, TypeError):
        return jsonify({"error": f"Invalid movie ID '{movie_id}'. Expected integer."}), 400

    if m_id_int not in CATALOG_BY_ID:
        return jsonify({"error": f"Movie with ID {m_id_int} not found in catalog."}), 404

    poster_data = fetch_tmdb_poster(m_id_int)
    return jsonify({
        "movie_id": m_id_int,
        "title": CATALOG_BY_ID[m_id_int].get("title"),
        "poster_path": poster_data.get("poster_path"),
        "poster_url": poster_data.get("poster_url")
    }), 200


@app.route("/api/movies", methods=["GET"])
def search_movies():
    """
    Returns movie list.
    - If ?q=<term> is provided: case-insensitive title search limited to 20 results.
    - If ?q is omitted or empty: returns the top 20 popular movies as an initial list.
    """
    query = request.args.get("q", "").strip()

    if not query:
        return jsonify(INITIAL_MOVIES), 200

    q_lower = query.lower()

    # Prioritize exact and prefix matches, followed by substring matches
    prefix_matches = []
    contains_matches = []

    for movie in CATALOG:
        title_lower = movie.get("title", "").lower()
        if title_lower.startswith(q_lower):
            prefix_matches.append(format_movie_summary(movie))
        elif q_lower in title_lower:
            contains_matches.append(format_movie_summary(movie))

        if len(prefix_matches) + len(contains_matches) >= 50:
            break

    results = (prefix_matches + contains_matches)[:20]
    return jsonify(results), 200


@app.route("/api/recommend/<movie_id>", methods=["GET"])
def get_recommendations(movie_id):
    """
    Returns recommendations for a given movie ID with offset pagination.
    - Query parameter `limit`: integer, defaults to 5, capped at 20.
    - Query parameter `offset`: integer, defaults to 0. Slices recommendations.
      If offset reaches or exceeds total recommendations, wraps around to the beginning.
    - Looks up recommendations by TMDB movie ID.
    - Returns 404 if the movie ID does not exist.
    """
    try:
        m_id_int = int(movie_id)
    except (ValueError, TypeError):
        return jsonify({"error": f"Invalid movie ID '{movie_id}'. Expected integer."}), 400

    # Verify movie exists in catalog
    if m_id_int not in CATALOG_BY_ID:
        return jsonify({"error": f"Movie with ID {m_id_int} not found in catalog."}), 404

    # Look up recommendations using string ID (as stored in JSON)
    rec_ids = RECOMMENDATIONS.get(str(m_id_int))
    if rec_ids is None:
        return jsonify({"error": f"Recommendations for movie ID {m_id_int} not found."}), 404

    total_recs = len(rec_ids)
    if total_recs == 0:
        response = jsonify([])
        response.headers["X-Total-Count"] = "0"
        response.headers["X-Offset"] = "0"
        response.headers["X-Limit"] = "5"
        return response, 200

    # Parse and clamp limit parameter
    limit_param = request.args.get("limit", 5)
    try:
        limit = int(limit_param)
    except (ValueError, TypeError):
        limit = 5

    limit = max(1, min(limit, 20))

    # Parse and validate offset parameter
    offset_param = request.args.get("offset", 0)
    try:
        offset = int(offset_param)
    except (ValueError, TypeError):
        offset = 0

    if offset < 0:
        offset = 0

    # Wrap around to the beginning if offset reaches or exceeds total
    if offset >= total_recs:
        offset = 0

    selected_rec_ids = rec_ids[offset:offset + limit]
    recommended_movies = []

    for r_id in selected_rec_ids:
        if r_id in CATALOG_BY_ID:
            recommended_movies.append(format_movie_detail(CATALOG_BY_ID[r_id]))
        else:
            poster_data = fetch_tmdb_poster(r_id)
            recommended_movies.append({
                "id": r_id,
                "title": f"TMDB Movie {r_id}",
                "overview": "",
                "release_year": None,
                "rating": None,
                "poster_path": poster_data.get("poster_path"),
                "poster_url": poster_data.get("poster_url")
            })

    response = jsonify(recommended_movies)
    response.headers["X-Total-Count"] = str(total_recs)
    response.headers["X-Offset"] = str(offset)
    response.headers["X-Limit"] = str(limit)
    return response, 200


@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404


@app.errorhandler(500)
def server_error(error):
    return jsonify({"error": "Internal server error"}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
