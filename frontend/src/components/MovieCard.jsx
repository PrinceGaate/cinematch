import React from 'react';
import MoviePoster from './MoviePoster';

// Helper to infer genre/category
function inferGenre(movie) {
  if (!movie) return 'Drama';
  const text = `${movie.title} ${movie.overview || ''}`.toLowerCase();
  if (/space|sci-fi|alien|future|robot|planet/.test(text)) return 'Sci-Fi';
  if (/journey|adventure|explore|mission|quest/.test(text)) return 'Adventure';
  if (/comedy|funny|humor|laugh/.test(text)) return 'Comedy';
  if (/action|fight|war|battle|agent|hero/.test(text)) return 'Action';
  if (/mystery|detective|secret|murder|thriller/.test(text)) return 'Thriller';
  if (/crime|cop|gangster|heist/.test(text)) return 'Crime';
  if (/romance|love|romantic/.test(text)) return 'Romance';
  return 'Drama';
}



export default function MovieCard({
  movie,
  _index = 0,
  onSelect,
  isSelected = false
}) {
  if (!movie) return null;

  const ratingFormatted = movie.rating != null ? Number(movie.rating).toFixed(1) : null;

  const genre = inferGenre(movie);
  const subtitle = [movie.release_year, genre].filter(Boolean).join(' • ');

  return (
    <article
      className={`stitch-movie-card ${isSelected ? 'is-selected-card' : ''}`}
      aria-label={`Recommended movie: ${movie.title}`}
    >
      {/* 2:3 Media Container */}
      <div className="card-poster-stage">
        <MoviePoster movie={movie} className="card-stage-img" />



        {/* Floating Star Rating Badge */}
        {ratingFormatted && (
          <div className="badge-rating-pill" title={`Rating: ${ratingFormatted}/10`}>
            <span className="material-symbols-outlined fill-icon text-xs">star</span>
            <span>{ratingFormatted}</span>
          </div>
        )}

        {/* Hover Quick Action Overlay */}
        <div className="card-hover-overlay">
          <button
            type="button"
            className="btn-overlay-seed glow-amber"
            onClick={() => onSelect && onSelect(movie)}
            title={`Find movies similar to ${movie.title}`}
          >
            <span className="material-symbols-outlined text-sm">auto_awesome</span>
            <span>Find Similar</span>
          </button>
          <button
            type="button"
            className="btn-overlay-details"
            onClick={() => onSelect && onSelect(movie)}
            title={`View details for ${movie.title}`}
          >
            <span>View Details</span>
          </button>
        </div>
      </div>

      {/* Card Info Body */}
      <div className="card-info-body">
        <div className="card-info-top">
          <div className="card-title-row">
            <h3 className="card-title-text" title={movie.title}>
              {movie.title}
            </h3>
            {movie.release_year && (
              <span className="card-year-text">{movie.release_year}</span>
            )}
          </div>

          <p className="card-subtitle-line">{subtitle}</p>

          <p className="card-overview-text">
            {movie.overview || 'No synopsis available for this title.'}
          </p>
        </div>

        {/* Card Footer: Genre & Quick Action */}
        <div className="card-metrics-footer">
          <span className="footer-theme-tag">{genre}</span>
          <button
            type="button"
            className="card-quick-find-btn"
            onClick={() => onSelect && onSelect(movie)}
            title={`Find movies similar to ${movie.title}`}
          >
            Similar &rarr;
          </button>
        </div>
      </div>
    </article>
  );
}
