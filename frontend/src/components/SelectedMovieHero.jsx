import React from 'react';
import MoviePoster from './MoviePoster';

// Helper to infer genre tags
function inferGenrePills(movie) {
  if (!movie) return ['Cinema'];
  const text = `${movie.title} ${movie.overview || ''}`.toLowerCase();
  const genres = [];

  if (/space|sci-fi|alien|future|robot|planet|interstellar/.test(text)) genres.push('Sci-Fi');
  if (/journey|adventure|explore|mission|quest/.test(text)) genres.push('Adventure');
  if (/drama|emotional|family|relationship|life/.test(text)) genres.push('Drama');
  if (/action|fight|war|battle|agent|hero/.test(text)) genres.push('Action');
  if (/mystery|detective|secret|murder|clue/.test(text)) genres.push('Mystery');
  if (/crime|cop|gangster|heist|prison/.test(text)) genres.push('Crime');

  return genres.length > 0 ? genres.slice(0, 3) : ['Featured'];
}

export default function SelectedMovieHero({
  movie,
  onGetRecommendations,
  isLoadingRecommendations,
  onChangeSeedClick
}) {
  if (!movie) {
    return (
      <section className="selected-movie-empty-card" id="seed-showcase">
        <div className="empty-card-inner">
          <div className="empty-icon-ring">
            <span className="material-symbols-outlined text-3xl text-primary">adjust</span>
          </div>
          <div className="empty-text-group">
            <h3 className="empty-card-title">Ready to discover your next favorite?</h3>
            <p className="empty-card-desc">
              Search for a movie you love above to explore similar recommendations.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const ratingFormatted = movie.rating != null ? Number(movie.rating).toFixed(1) : null;
  const genres = inferGenrePills(movie);

  return (
    <section className="seed-showcase-section" id="seed-showcase" aria-label="Selected Movie">
      <div className="seed-showcase-panel">
        {/* Subtle ambient atmospheric glow */}
        <div className="ambient-radial-glow" aria-hidden="true" />

        <div className="seed-grid-layout">
          {/* Left Column: Movie Content Details */}
          <div className="seed-content-column">
            <div>
              {/* Eyebrow Pill */}
              <div className="seed-eyebrow-pill">
                <span className="material-symbols-outlined text-sm">movie</span>
                <span>SELECTED MOVIE</span>
              </div>

              {/* Title & Release Year */}
              <div className="seed-title-header">
                <h2 className="seed-movie-title">{movie.title}</h2>
                {movie.release_year && (
                  <span className="seed-movie-year">({movie.release_year})</span>
                )}
              </div>

              {/* Metadata Row */}
              <div className="seed-meta-row">
                {ratingFormatted && (
                  <>
                    <span className="meta-rating-highlight">
                      <span className="material-symbols-outlined fill-icon text-sm">star</span>
                      <span>{ratingFormatted}/10</span>
                    </span>
                    <span className="meta-separator">•</span>
                  </>
                )}
                {movie.release_year && (
                  <span>Released {movie.release_year}</span>
                )}
              </div>

              {/* Genre Pills */}
              <div className="seed-genre-pills">
                {genres.map((g) => (
                  <span key={g} className="genre-pill-chip">
                    {g}
                  </span>
                ))}
              </div>

              {/* Synopsis */}
              <p className="seed-synopsis-text">
                {movie.overview
                  ? movie.overview
                  : 'Plot summary unavailable for this title.'}
              </p>
            </div>

            {/* Actions Row */}
            <div className="seed-actions-row">
              <button
                type="button"
                className="btn-find-similar glow-amber"
                onClick={onGetRecommendations}
                disabled={isLoadingRecommendations}
                title="Find movies similar to this title"
              >
                {isLoadingRecommendations ? (
                  <>
                    <span className="spinner-ring-sm" />
                    <span>Finding movies you'll love...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base">auto_awesome</span>
                    <span>Find Similar</span>
                  </>
                )}
              </button>

              <button
                type="button"
                className="btn-change-seed"
                onClick={onChangeSeedClick}
                title="Search for a different movie"
              >
                <span className="material-symbols-outlined text-base">search</span>
                <span>Choose Another Movie</span>
              </button>
            </div>
          </div>

          {/* Right Column: Poster */}
          <div className="seed-media-column group">
            <div className="seed-media-frame">
              <MoviePoster movie={movie} className="seed-hero-poster" />
              <div className="media-gradient-overlay" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
