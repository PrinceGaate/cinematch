"""
backend/test_api.py

Automated test suite for the Movie Recommender Flask REST API:
- Tests /api/health
- Tests /api/movies (default initial list and query searches)
- Tests /api/recommend/<movie_id> (default limit, custom limit, cap, metadata, posters)
- Tests /api/poster/<movie_id> (poster paths, caching, error handling)
- Tests target movies: Avatar (19995), Frozen (109445), Titan A.E. (7450), Aladdin (812)
"""

import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from app import app


def run_tests():
    client = app.test_client()
    passed = 0
    total = 0

    def assert_test(condition, message):
        nonlocal passed, total
        total += 1
        if condition:
            passed += 1
            print(f"  [PASS] {message}")
        else:
            print(f"  [FAIL] {message}")
            raise AssertionError(message)

    print("==================================================")
    print("        RUNNING FLASK REST API TEST SUITE         ")
    print("==================================================")

    # -------------------------------------------------------------------------
    # 1. Healthcheck Endpoint
    # -------------------------------------------------------------------------
    print("\n[TEST GROUP 1] GET /api/health")
    res = client.get("/api/health")
    assert_test(res.status_code == 200, "Healthcheck returns HTTP 200")
    data = res.get_json()
    assert_test(data.get("status") == "healthy", "Status is 'healthy'")
    assert_test(data.get("artifacts_loaded") is True, "Artifacts loaded is True")
    assert_test(data.get("total_movies") == 4803, f"Total movies is 4803 (got {data.get('total_movies')})")
    assert_test(data.get("recommendation_entries") == 4803, f"Recommendations is 4803 (got {data.get('recommendation_entries')})")
    assert_test("tmdb_configured" in data, "Health response includes 'tmdb_configured'")

    # -------------------------------------------------------------------------
    # 2. Movie Catalog / Search Endpoint
    # -------------------------------------------------------------------------
    print("\n[TEST GROUP 2] GET /api/movies")
    res = client.get("/api/movies")
    assert_test(res.status_code == 200, "Initial movies returns HTTP 200")
    data = res.get_json()
    assert_test(isinstance(data, list), "Initial movies response is a list")
    assert_test(len(data) == 20, f"Initial movies returns 20 items (got {len(data)})")
    first = data[0]
    assert_test("id" in first and "title" in first, "Initial movie has 'id' and 'title'")
    assert_test("release_year" in first, "Initial movie has 'release_year'")
    assert_test("rating" in first, "Initial movie has 'rating'")

    res = client.get("/api/movies?q=avatar")
    assert_test(res.status_code == 200, "Search 'avatar' returns HTTP 200")
    data = res.get_json()
    avatar_found = any(m["id"] == 19995 and m["title"].lower() == "avatar" for m in data)
    assert_test(avatar_found, "Avatar (ID 19995) is in the search results")

    res = client.get("/api/movies?q=GANDHI")
    assert_test(res.status_code == 200, "Search 'GANDHI' returns HTTP 200")
    data = res.get_json()
    gandhi_found = any(m["id"] == 783 for m in data)
    assert_test(gandhi_found, "Gandhi (ID 783) found with uppercase query")

    res = client.get("/api/movies?q=frozen")
    assert_test(res.status_code == 200, "Search 'frozen' returns HTTP 200")
    data = res.get_json()
    frozen_found = any(m["id"] == 109445 for m in data)
    assert_test(frozen_found, "Frozen (ID 109445) found in search")

    res = client.get("/api/movies?q=aladdin")
    assert_test(res.status_code == 200, "Search 'aladdin' returns HTTP 200")
    data = res.get_json()
    aladdin_found = any(m["id"] == 812 for m in data)
    assert_test(aladdin_found, "Aladdin (ID 812) found in search")

    # -------------------------------------------------------------------------
    # 3. Recommendations Endpoint
    # -------------------------------------------------------------------------
    print("\n[TEST GROUP 3] GET /api/recommend/<movie_id>")
    res = client.get("/api/recommend/19995")
    assert_test(res.status_code == 200, "Recommend for Avatar (19995) returns HTTP 200")
    data = res.get_json()
    assert_test(isinstance(data, list), "Recommendations response is a list")
    assert_test(len(data) == 5, f"Default recommendations count is 5 (got {len(data)})")

    first_rec = data[0]
    for field in ["id", "title", "overview", "release_year", "rating", "poster_path"]:
        assert_test(field in first_rec, f"Recommended movie includes '{field}'")

    assert_test(all(m["id"] != 19995 for m in data), "Avatar does not recommend itself")
    assert_test(data[0]["title"] == "Titan A.E.", f"Top recommendation for Avatar is Titan A.E. (got {data[0]['title']})")

    res = client.get("/api/recommend/19995?limit=10")
    assert_test(res.status_code == 200, "Custom limit=10 returns HTTP 200")
    data = res.get_json()
    assert_test(len(data) == 10, f"Returns exactly 10 recommendations (got {len(data)})")

    # Pagination & Offset Tests (Fresh batches without repeating consecutive movies)
    # Batch 1 (items 1–5)
    res_b1 = client.get("/api/recommend/19995?offset=0&limit=5")
    assert_test(res_b1.status_code == 200, "Offset=0 returns HTTP 200")
    assert_test(res_b1.headers.get("X-Total-Count") == "20", "Header X-Total-Count is 20")
    assert_test(res_b1.headers.get("X-Offset") == "0", "Header X-Offset is 0")
    batch1 = res_b1.get_json()
    assert_test(len(batch1) == 5, f"Batch 1 has 5 recommendations (got {len(batch1)})")
    batch1_ids = [m["id"] for m in batch1]

    # Batch 2 (items 6–10)
    res_b2 = client.get("/api/recommend/19995?offset=5&limit=5")
    assert_test(res_b2.status_code == 200, "Offset=5 returns HTTP 200")
    assert_test(res_b2.headers.get("X-Offset") == "5", "Header X-Offset is 5")
    batch2 = res_b2.get_json()
    assert_test(len(batch2) == 5, f"Batch 2 has 5 recommendations (got {len(batch2)})")
    batch2_ids = [m["id"] for m in batch2]
    overlap_b1_b2 = set(batch1_ids).intersection(set(batch2_ids))
    assert_test(len(overlap_b1_b2) == 0, "Batch 1 and Batch 2 do not repeat movies")

    # Batch 3 (items 11–15)
    res_b3 = client.get("/api/recommend/19995?offset=10&limit=5")
    batch3 = res_b3.get_json()
    assert_test(len(batch3) == 5, f"Batch 3 has 5 recommendations (got {len(batch3)})")
    batch3_ids = [m["id"] for m in batch3]
    overlap_b2_b3 = set(batch2_ids).intersection(set(batch3_ids))
    assert_test(len(overlap_b2_b3) == 0, "Batch 2 and Batch 3 do not repeat movies")

    # Batch 4 (items 16–20)
    res_b4 = client.get("/api/recommend/19995?offset=15&limit=5")
    batch4 = res_b4.get_json()
    assert_test(len(batch4) == 5, f"Batch 4 has 5 recommendations (got {len(batch4)})")
    batch4_ids = [m["id"] for m in batch4]
    overlap_b3_b4 = set(batch3_ids).intersection(set(batch4_ids))
    assert_test(len(overlap_b3_b4) == 0, "Batch 3 and Batch 4 do not repeat movies")

    # Wrap-around: offset=20 reaches total (20), wraps back to beginning (Batch 1)
    res_wrap = client.get("/api/recommend/19995?offset=20&limit=5")
    assert_test(res_wrap.status_code == 200, "Offset=20 (at total) returns HTTP 200")
    assert_test(res_wrap.headers.get("X-Offset") == "0", "Header X-Offset wraps to 0")
    batch_wrap = res_wrap.get_json()
    assert_test(len(batch_wrap) == 5, "Wrap-around returns 5 recommendations")
    wrap_ids = [m["id"] for m in batch_wrap]
    assert_test(wrap_ids == batch1_ids, "Wrap-around returns recommendations 1–5 from beginning")
    overlap_b4_wrap = set(batch4_ids).intersection(set(wrap_ids))
    assert_test(len(overlap_b4_wrap) == 0, "Batch 4 and wrapped batch do not repeat movies")

    # Partial batch (fewer than 5 remaining recommendations)
    res_partial = client.get("/api/recommend/19995?offset=18&limit=5")
    assert_test(res_partial.status_code == 200, "Offset=18 (partial batch) returns HTTP 200")
    partial_data = res_partial.get_json()
    assert_test(len(partial_data) == 2, f"Partial batch returns exactly 2 remaining items (got {len(partial_data)})")

    # Offset beyond total wraps around to beginning
    res_beyond = client.get("/api/recommend/19995?offset=99&limit=5")
    assert_test(res_beyond.status_code == 200, "Offset beyond total returns HTTP 200")
    assert_test(res_beyond.headers.get("X-Offset") == "0", "Offset beyond total wraps to 0")
    beyond_ids = [m["id"] for m in res_beyond.get_json()]
    assert_test(beyond_ids == batch1_ids, "Offset beyond total returns beginning batch")

    # Negative / non-integer offset safely clamped to 0
    res_neg = client.get("/api/recommend/19995?offset=-10&limit=5")
    assert_test(res_neg.status_code == 200, "Negative offset returns HTTP 200")
    assert_test(res_neg.headers.get("X-Offset") == "0", "Negative offset clamped to 0")
    res_inv = client.get("/api/recommend/19995?offset=invalid&limit=5")
    assert_test(res_inv.status_code == 200, "Invalid offset returns HTTP 200")
    assert_test(res_inv.headers.get("X-Offset") == "0", "Invalid offset clamped to 0")

    # -------------------------------------------------------------------------
    # 4. Poster Endpoint & Target Movies Validation
    # -------------------------------------------------------------------------
    print("\n[TEST GROUP 4] GET /api/poster/<movie_id> (Target Movies)")
    target_movies = [
        {"id": 19995, "name": "Avatar"},
        {"id": 109445, "name": "Frozen"},
        {"id": 7450, "name": "Titan A.E."},
        {"id": 812, "name": "Aladdin (1992)"}
    ]

    for target in target_movies:
        m_id = target["id"]
        res = client.get(f"/api/poster/{m_id}")
        assert_test(res.status_code == 200, f"Poster endpoint returns HTTP 200 for {target['name']} ({m_id})")
        data = res.get_json()
        assert_test("poster_path" in data, f"Response includes 'poster_path' for {target['name']}")
        assert_test("poster_url" in data, f"Response includes 'poster_url' for {target['name']}")

        poster_path = data.get("poster_path")
        poster_url = data.get("poster_url")

        if poster_path:
            assert_test(poster_path.startswith("/"), f"poster_path starts with '/' ({poster_path})")
            assert_test(poster_url.startswith("https://image.tmdb.org/t/p/w500/"), f"poster_url has correct TMDB CDN base ({poster_url})")

        # Test caching on second query
        res2 = client.get(f"/api/poster/{m_id}")
        assert_test(res2.status_code == 200, f"Second poster query returns HTTP 200 (cache hit)")
        data2 = res2.get_json()
        assert_test(data2.get("poster_path") == poster_path, "Cached poster_path matches previous response")

    # -------------------------------------------------------------------------
    # 5. Error Handling
    # -------------------------------------------------------------------------
    print("\n[TEST GROUP 5] Error Handling")
    res = client.get("/api/recommend/99999999")
    assert_test(res.status_code == 404, "Non-existent movie ID returns HTTP 404")

    res = client.get("/api/recommend/not-an-id")
    assert_test(res.status_code == 400, "Invalid movie ID returns HTTP 400")

    res = client.get("/api/poster/99999999")
    assert_test(res.status_code == 404, "Poster endpoint for non-existent movie returns HTTP 404")

    res = client.get("/api/poster/bad-id")
    assert_test(res.status_code == 400, "Poster endpoint for bad ID returns HTTP 400")

    print("\n==================================================")
    print(f"      ALL {passed}/{total} TESTS PASSED SUCCESSFULLY!       ")
    print("==================================================")


if __name__ == "__main__":
    try:
        run_tests()
    except Exception as e:
        print(f"\n[ERROR] Test suite failed: {e}", file=sys.stderr)
        sys.exit(1)
