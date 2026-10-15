/**
 * services/api.js
 * 
 * Client for the Flask REST API backend.
 * Reads base URL from VITE_API_BASE_URL with fallback to http://127.0.0.1:5000.
 */

export const API_BASE = (
  import.meta.env.DEV
    ? (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000')
    : (import.meta.env.VITE_API_BASE_URL || '')
).replace(/\/+$/, '');

export async function checkHealth() {
  const startTime = performance.now();
  try {
    const res = await fetch(`${API_BASE}/api/health`, {
      headers: { 'Accept': 'application/json' }
    });
    const latency = Math.max(1, Math.round(performance.now() - startTime));
    if (!res.ok) {
      throw new Error(`API responded with status ${res.status}`);
    }
    const data = await res.json();
    return { ...data, latency };
  } catch (err) {
    const latency = Math.max(1, Math.round(performance.now() - startTime));
    throw new Error(`Cannot connect to backend at ${API_BASE || 'current origin'}: ${err.message} (${latency}ms)`);
  }
}

export async function fetchMovies(searchQuery = '') {
  try {
    const url = searchQuery.trim()
      ? `${API_BASE}/api/movies?q=${encodeURIComponent(searchQuery.trim())}`
      : `${API_BASE}/api/movies`;

    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    throw new Error(`Failed to fetch movies: ${err.message}`);
  }
}

export async function fetchRecommendations(movieId, limit = 5, offset = 0) {
  try {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset)
    });
    const res = await fetch(`${API_BASE}/api/recommend/${encodeURIComponent(movieId)}?${params.toString()}`, {
      headers: { 'Accept': 'application/json' }
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const err = new Error(errorData.error || `Failed to fetch recommendations (HTTP ${res.status})`);
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    if (Array.isArray(data)) {
      const totalHeader = res.headers.get('X-Total-Count');
      if (totalHeader != null) {
        data.totalCount = parseInt(totalHeader, 10);
      }
      const offsetHeader = res.headers.get('X-Offset');
      if (offsetHeader != null) {
        data.offset = parseInt(offsetHeader, 10);
      }
    }
    return data;
  } catch (err) {
    if (err.status) {
      throw err;
    }
    throw new Error(`Failed to fetch recommendations: ${err.message}`);
  }
}
