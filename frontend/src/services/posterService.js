/**
 * services/posterService.js
 * 
 * Manages movie poster resolution:
 * 1. Uses existing poster_url or poster_path if already provided in the movie object.
 * 2. If missing, queries the backend endpoint `/api/poster/:id` (which handles TMDB lookups and caching safely on the server side).
 * 3. Never requires or exposes TMDB API keys on the frontend.
 * 4. Caches resolved URLs in-memory to minimize network calls.
 * 5. Provides deterministic gradient pairs for fallback card placeholders.
 */

import { API_BASE } from './api';

const posterCache = new Map();
const loadedImageUrls = new Set();
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// Curated cinematic gradient pairs for fallback posters
const GRADIENT_PALETTES = [
  ['#1e1b4b', '#4338ca'], // Indigo Night
  ['#172554', '#1d4ed8'], // Deep Blue
  ['#042f2e', '#0f766e'], // Emerald Teal
  ['#311042', '#7e22ce'], // Velvet Violet
  ['#450a0a', '#b91c1c'], // Crimson Noir
  ['#422006', '#b45309'], // Amber Bronze
  ['#18181b', '#3f3f46'], // Obsidian Steel
  ['#083344', '#0e7490'], // Cyber Cyan
];

/**
 * Returns a deterministic gradient pair based on the movie ID.
 */
export function getPlaceholderGradient(movieId) {
  const index = Math.abs(Number(movieId) || 0) % GRADIENT_PALETTES.length;
  return GRADIENT_PALETTES[index];
}

/**
 * Checks whether an image URL has already loaded in the current session.
 */
export function isImagePreloaded(url) {
  return Boolean(url && loadedImageUrls.has(url));
}

/**
 * Marks an image URL as loaded in the session cache.
 */
export function markImageLoaded(url) {
  if (url) {
    loadedImageUrls.add(url);
  }
}

/**
 * Synchronously resolves a full TMDB poster URL if available from props or cache.
 * Prevents unnecessary asynchronous delay and initial placeholder flashes.
 */
export function getImmediatePosterUrl(movieId, existingPosterPath = null) {
  if (!movieId) return null;

  if (existingPosterPath) {
    if (existingPosterPath.startsWith('http')) {
      return existingPosterPath;
    }
    if (existingPosterPath.startsWith('/')) {
      return `${TMDB_IMAGE_BASE_URL}${existingPosterPath}`;
    }
  }

  const idKey = String(movieId);
  if (posterCache.has(idKey)) {
    return posterCache.get(idKey);
  }

  return null;
}

/**
 * Resolves a full TMDB poster URL for a movie.
 * Uses cached data when available; queries backend /api/poster/<id> if missing.
 */
export async function getPosterUrl(movieId, existingPosterPath = null) {
  if (!movieId) return null;

  // 1. Check synchronous resolution first
  const immediate = getImmediatePosterUrl(movieId, existingPosterPath);
  if (immediate) {
    posterCache.set(String(movieId), immediate);
    return immediate;
  }

  const idKey = String(movieId);

  // 2. Query backend /api/poster/<movie_id>
  try {
    const res = await fetch(`${API_BASE}/api/poster/${encodeURIComponent(movieId)}`, {
      headers: { 'Accept': 'application/json' }
    });

    if (res.ok) {
      const data = await res.json();
      if (data.poster_url) {
        posterCache.set(idKey, data.poster_url);
        return data.poster_url;
      }
      if (data.poster_path) {
        const fullUrl = `${TMDB_IMAGE_BASE_URL}${data.poster_path}`;
        posterCache.set(idKey, fullUrl);
        return fullUrl;
      }
    }
  } catch {
    // Graceful fallback to placeholder on network error
  }

  posterCache.set(idKey, null);
  return null;
}
