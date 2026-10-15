"""
scripts/validate_artifacts.py

Validates the generated recommendation artifacts:
- Confirms movie_catalog.json and recommendations.json load without error.
- Validates schema and integrity.
- Confirms no movie recommends itself.
- Tests recommendations for Avatar and Gandhi.
- Prints movie counts, artifact sizes, and sample recommendations.
"""

import json
from pathlib import Path
import sys


def validate_artifacts(model_dir: Path):
    catalog_path = model_dir / "movie_catalog.json"
    recommendations_path = model_dir / "recommendations.json"

    print("==================================================")
    print("      VALIDATING MOVIE RECOMMENDER ARTIFACTS      ")
    print("==================================================")

    # 1. Existence Check
    assert catalog_path.exists(), f"Missing {catalog_path}"
    assert recommendations_path.exists(), f"Missing {recommendations_path}"
    print(f"[PASS] Both artifact files exist in {model_dir}")

    # 2. JSON Loading Check
    with open(catalog_path, 'r', encoding='utf-8') as f:
        catalog = json.load(f)
    print(f"[PASS] movie_catalog.json loaded successfully ({len(catalog)} entries)")

    with open(recommendations_path, 'r', encoding='utf-8') as f:
        recommendations = json.load(f)
    print(f"[PASS] recommendations.json loaded successfully ({len(recommendations)} entries)")

    # 3. Catalog Structure & Map Creation
    catalog_map = {}
    title_to_id = {}
    for movie in catalog:
        assert "id" in movie, "Catalog entry missing 'id'"
        assert "title" in movie, "Catalog entry missing 'title'"
        m_id = movie["id"]
        catalog_map[m_id] = movie
        title_to_id[movie["title"].lower().strip()] = m_id

    # 4. Self-Recommendation Validation
    self_rec_count = 0
    rec_lengths = []
    for str_id, rec_ids in recommendations.items():
        m_id = int(str_id)
        if m_id in rec_ids:
            self_rec_count += 1
        rec_lengths.append(len(rec_ids))

    assert self_rec_count == 0, f"Found {self_rec_count} movies that recommend themselves!"
    print(f"[PASS] Verified: Zero self-recommendations across all {len(recommendations)} movies.")
    print(f"[PASS] Average recommendations per movie: {sum(rec_lengths) / len(rec_lengths):.1f} (min: {min(rec_lengths)}, max: {max(rec_lengths)})")

    # 5. File Sizes
    cat_size_kb = catalog_path.stat().st_size / 1024
    rec_size_kb = recommendations_path.stat().st_size / 1024
    print(f"\nArtifact Sizes:")
    print(f"  - movie_catalog.json: {cat_size_kb:.2f} KB ({cat_size_kb / 1024:.2f} MB)")
    print(f"  - recommendations.json: {rec_size_kb:.2f} KB ({rec_size_kb / 1024:.2f} MB)")

    # 6. Test Specific Targets: Avatar & Gandhi
    test_titles = ["Avatar", "Gandhi"]
    print("\n--------------------------------------------------")
    print("           SAMPLE TARGET RECOMMENDATIONS          ")
    print("--------------------------------------------------")

    for title in test_titles:
        t_key = title.lower().strip()
        if t_key not in title_to_id:
            print(f"[WARN] Movie '{title}' not found in catalog!")
            continue

        target_id = title_to_id[t_key]
        target_movie = catalog_map[target_id]
        rec_ids = recommendations.get(str(target_id), [])

        print(f"\nMovie: '{target_movie['title']}' (TMDB ID: {target_id})")
        print(f"Genres: {', '.join(target_movie.get('genres', []))}")
        print(f"Total Recommendations: {len(rec_ids)}")
        print("Top 5 Recommendations:")
        for rank, rec_id in enumerate(rec_ids[:5], start=1):
            rec_movie = catalog_map.get(rec_id, {"title": f"Unknown (ID: {rec_id})"})
            rec_genres = ", ".join(rec_movie.get('genres', []))
            print(f"  {rank}. {rec_movie['title']} [ID: {rec_id}] - Genres: {rec_genres}")

    print("\n==================================================")
    print("         ALL ARTIFACT VALIDATIONS PASSED!         ")
    print("==================================================")


if __name__ == "__main__":
    base_dir = Path(__file__).resolve().parent.parent
    model_dir = base_dir / "model"
    validate_artifacts(model_dir)
