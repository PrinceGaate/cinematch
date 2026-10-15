import React, { useState, useEffect } from 'react';
import {
  getPosterUrl,
  getImmediatePosterUrl,
  getPlaceholderGradient,
  isImagePreloaded,
  markImageLoaded
} from '../services/posterService';

export default function MoviePoster({ movie, className = '', alt = '' }) {
  const movieId = movie?.id;
  const title = movie?.title || 'Unknown Movie';
  const year = movie?.release_year || '';
  const providedPath = movie?.poster_url || movie?.poster_path || null;

  // 1. Resolve URL synchronously if available in props or cache
  const initialUrl = getImmediatePosterUrl(movieId, providedPath);

  const [currentMovieId, setCurrentMovieId] = useState(movieId);
  const [posterUrl, setPosterUrl] = useState(initialUrl);
  const [isLoaded, setIsLoaded] = useState(() => isImagePreloaded(initialUrl));
  const [hasError, setHasError] = useState(false);

  // Synchronously reset/sync state when movie prop changes during render
  // This prevents briefly displaying the previous movie's poster or stale state
  if (movieId !== currentMovieId) {
    setCurrentMovieId(movieId);
    const resolvedUrl = getImmediatePosterUrl(movieId, providedPath);
    setPosterUrl(resolvedUrl);
    setIsLoaded(isImagePreloaded(resolvedUrl));
    setHasError(false);
  }

  useEffect(() => {
    let isMounted = true;

    // If no movie ID or if the poster is already preloaded, no async fetch needed
    if (!movieId || (posterUrl && isImagePreloaded(posterUrl))) {
      return;
    }

    getPosterUrl(movieId, providedPath)
      .then(url => {
        if (!isMounted) return;
        setPosterUrl(url);
        if (url && isImagePreloaded(url)) {
          setIsLoaded(true);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setHasError(true);
      });

    return () => {
      isMounted = false;
    };
  }, [movieId, providedPath, posterUrl]);

  const [gradStart, gradEnd] = getPlaceholderGradient(movieId);
  const showImage = Boolean(posterUrl && !hasError);

  const handleImageLoad = () => {
    if (posterUrl) {
      markImageLoaded(posterUrl);
    }
    setIsLoaded(true);
  };

  const handleImageError = () => {
    setHasError(true);
    setIsLoaded(false);
  };

  return (
    <div
      className={`poster-container ${className}`}
      style={{
        background: `linear-gradient(135deg, ${gradStart}, ${gradEnd})`
      }}
    >
      {/* 1. Underlying persistent placeholder: never unmounts, preventing void/black flash */}
      <div className="placeholder-pattern" aria-hidden="true" />
      <div className={`placeholder-content ${isLoaded ? 'is-faded' : ''}`}>
        <FilmIcon />
        <span className="placeholder-title">{title}</span>
        {year && <span className="placeholder-year">{year}</span>}
      </div>

      {/* 2. Image layer on top: smoothly fades in over the placeholder without layout shift */}
      {showImage && (
        <img
          src={posterUrl}
          alt={alt || `${title} (${year || 'Film'})`}
          className={`poster-image ${isLoaded ? 'loaded' : 'loading'}`}
          onLoad={handleImageLoad}
          onError={handleImageError}
          loading="lazy"
        />
      )}
    </div>
  );
}

function FilmIcon() {
  return (
    <svg
      className="placeholder-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="3" ry="3" />
      <line x1="7" y1="2" x2="7" y2="22" />
      <line x1="17" y1="2" x2="17" y2="22" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <line x1="2" y1="7" x2="7" y2="7" />
      <line x1="2" y1="17" x2="7" y2="17" />
      <line x1="17" y1="7" x2="22" y2="7" />
      <line x1="17" y1="17" x2="22" y2="17" />
    </svg>
  );
}
