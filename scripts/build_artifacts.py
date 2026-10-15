"""
scripts/build_artifacts.py

Builds content-based recommendation artifacts from TMDB 5000 datasets:
- Extracts overview, genres, keywords, first three cast members, and directors.
- Uses CountVectorizer(max_features=5000, stop_words='english').
- Uses NearestNeighbors with cosine metric (top 20 similar movies).
- Saves:
    - model/movie_catalog.json (movie metadata for UI catalog and search)
    - model/recommendations.json (mapping of movie_id -> top 20 recommended movie_ids)
"""

import ast
import json
import os
import sys
from pathlib import Path
import pandas as pd
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.neighbors import NearestNeighbors


def parse_json_safely(text):
    """Safely evaluates or parses JSON-like string metadata."""
    if not isinstance(text, str) or not text.strip():
        return []
    try:
        data = ast.literal_eval(text)
        if isinstance(data, list):
            return data
    except (ValueError, SyntaxError, TypeError, MemoryError):
        pass
    try:
        data = json.loads(text)
        if isinstance(data, list):
            return data
    except Exception:
        pass
    return []


def extract_names(text):
    """Extracts name field from list of dicts."""
    items = parse_json_safely(text)
    names = []
    for item in items:
        if isinstance(item, dict) and 'name' in item and isinstance(item['name'], str):
            names.append(item['name'])
    return names


def extract_cast(text, limit=3):
    """Extracts first `limit` cast member names."""
    items = parse_json_safely(text)
    names = []
    for item in items[:limit]:
        if isinstance(item, dict) and 'name' in item and isinstance(item['name'], str):
            names.append(item['name'])
    return names


def extract_directors(text):
    """Extracts director names from crew metadata."""
    items = parse_json_safely(text)
    directors = []
    for item in items:
        if isinstance(item, dict) and item.get('job') == 'Director' and 'name' in item and isinstance(item['name'], str):
            directors.append(item['name'])
    return directors


def collapse_tokens(tokens):
    """Removes spaces within tokens so multi-word names become unique single tags."""
    if not isinstance(tokens, list):
        return []
    return [str(token).replace(" ", "") for token in tokens if token]


def build_artifacts(data_dir: Path, output_dir: Path, n_neighbors: int = 20):
    movies_path = data_dir / "tmdb_5000_movies.csv"
    credits_path = data_dir / "tmdb_5000_credits.csv"

    # Fallback to root directory if not found in data_dir
    if not movies_path.exists() or not credits_path.exists():
        root_dir = data_dir.parent.parent if data_dir.name == "raw" else data_dir.parent
        if (root_dir / "tmdb_5000_movies.csv").exists() and (root_dir / "tmdb_5000_credits.csv").exists():
            movies_path = root_dir / "tmdb_5000_movies.csv"
            credits_path = root_dir / "tmdb_5000_credits.csv"
        else:
            raise FileNotFoundError(f"Missing TMDB datasets in {data_dir} or {root_dir}")

    print(f"Loading datasets from {movies_path.parent}...")
    movies_df = pd.read_csv(movies_path)
    credits_df = pd.read_csv(credits_path)
    print(f"Loaded movies: {movies_df.shape}, credits: {credits_df.shape}")

    # Standardize column names and merge on movie ID
    # In movies_df TMDB id is 'id'; in credits_df TMDB id is 'movie_id'
    if 'id' in movies_df.columns and 'movie_id' in credits_df.columns:
        merged_df = movies_df.merge(
            credits_df[['movie_id', 'cast', 'crew']],
            left_on='id',
            right_on='movie_id',
            how='inner'
        )
    else:
        # Fallback to title merge like original notebook
        merged_df = movies_df.merge(credits_df, on='title', how='inner')
        if 'id' not in merged_df.columns and 'movie_id' in merged_df.columns:
            merged_df['id'] = merged_df['movie_id']

    # Ensure movie_id column is consistently named
    merged_df['id'] = merged_df['id'].astype(int)
    merged_df.drop_duplicates(subset=['id'], inplace=True)
    merged_df.reset_index(drop=True, inplace=True)

    print(f"Merged dataset contains {len(merged_df)} unique movies.")

    # Safe feature extraction
    print("Extracting features (genres, keywords, cast, crew, overview)...")
    genres_cleaned = merged_df['genres'].apply(extract_names).apply(collapse_tokens)
    keywords_cleaned = merged_df['keywords'].apply(extract_names).apply(collapse_tokens)
    cast_cleaned = merged_df['cast'].apply(lambda x: extract_cast(x, limit=3)).apply(collapse_tokens)
    directors_cleaned = merged_df['crew'].apply(extract_directors).apply(collapse_tokens)

    # Overview split safely
    overview_tokens = merged_df['overview'].fillna('').apply(
        lambda x: x.split() if isinstance(x, str) else []
    )

    # Combine tags exactly as in the original model
    combined_tags = (
        overview_tokens +
        genres_cleaned +
        keywords_cleaned +
        cast_cleaned +
        directors_cleaned
    )
    tags_string = combined_tags.apply(lambda tokens: " ".join(tokens).lower())

    # Build CountVectorizer representation
    print("Fitting CountVectorizer(max_features=5000, stop_words='english')...")
    cv = CountVectorizer(max_features=5000, stop_words='english')
    feature_vectors = cv.fit_transform(tags_string)
    print(f"Feature vector matrix shape: {feature_vectors.shape}")

    # Use NearestNeighbors with cosine distance
    print(f"Fitting NearestNeighbors(metric='cosine')...")
    # Request extra neighbors to ensure we have at least n_neighbors after removing self
    k_search = min(n_neighbors + 10, len(merged_df))
    nn = NearestNeighbors(n_neighbors=k_search, metric='cosine', algorithm='brute')
    nn.fit(feature_vectors)

    print(f"Computing top {n_neighbors} recommendations for all movies...")
    distances, indices = nn.kneighbors(feature_vectors)

    # Prepare catalog and recommendations
    movie_catalog = []
    recommendations_map = {}

    movie_ids = merged_df['id'].tolist()
    titles = merged_df['title'].tolist()
    overviews = merged_df['overview'].fillna('').tolist()
    release_dates = merged_df['release_date'].fillna('').tolist() if 'release_date' in merged_df.columns else [''] * len(merged_df)
    vote_averages = merged_df['vote_average'].fillna(0.0).tolist() if 'vote_average' in merged_df.columns else [0.0] * len(merged_df)
    vote_counts = merged_df['vote_count'].fillna(0).astype(int).tolist() if 'vote_count' in merged_df.columns else [0] * len(merged_df)
    genres_raw = merged_df['genres'].apply(extract_names).tolist()

    for idx, movie_id in enumerate(movie_ids):
        # Movie metadata record
        movie_catalog.append({
            "id": movie_id,
            "title": titles[idx],
            "overview": overviews[idx],
            "genres": genres_raw[idx],
            "release_date": str(release_dates[idx]),
            "vote_average": float(vote_averages[idx]),
            "vote_count": int(vote_counts[idx])
        })

        # Neighbor indices excluding self
        rec_ids = []
        for neighbor_idx in indices[idx]:
            rec_id = movie_ids[neighbor_idx]
            if rec_id != movie_id:
                rec_ids.append(rec_id)
            if len(rec_ids) >= n_neighbors:
                break

        recommendations_map[str(movie_id)] = rec_ids

    # Save artifacts
    output_dir.mkdir(parents=True, exist_ok=True)
    catalog_file = output_dir / "movie_catalog.json"
    recommendations_file = output_dir / "recommendations.json"

    print(f"Saving catalog to {catalog_file}...")
    with open(catalog_file, 'w', encoding='utf-8') as f:
        json.dump(movie_catalog, f, ensure_ascii=False, indent=2)

    print(f"Saving recommendations to {recommendations_file}...")
    with open(recommendations_file, 'w', encoding='utf-8') as f:
        json.dump(recommendations_map, f, ensure_ascii=False, indent=2)

    catalog_size_kb = catalog_file.stat().st_size / 1024
    rec_size_kb = recommendations_file.stat().st_size / 1024

    print(f"Artifacts successfully created!")
    print(f"- Total movies processed: {len(movie_catalog)}")
    print(f"- {catalog_file.name}: {catalog_size_kb:.1f} KB")
    print(f"- {recommendations_file.name}: {rec_size_kb:.1f} KB")

    return catalog_file, recommendations_file


if __name__ == "__main__":
    base_dir = Path(__file__).resolve().parent.parent
    raw_data_dir = base_dir / "data" / "raw"
    model_output_dir = base_dir / "model"

    try:
        build_artifacts(raw_data_dir, model_output_dir, n_neighbors=20)
    except Exception as e:
        print(f"Error during artifact building: {e}", file=sys.stderr)
        sys.exit(1)
