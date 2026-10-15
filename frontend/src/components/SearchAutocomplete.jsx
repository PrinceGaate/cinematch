import React, { useState, useEffect, useRef } from 'react';
import { fetchMovies } from '../services/api';
import MoviePoster from './MoviePoster';

export default function SearchAutocomplete({
  onSelectMovie,
  onDiscoverClick,
  selectedMovie,
  initialMovies = []
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [errorMsg, setErrorMsg] = useState('');

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const prevSelectedMovieId = useRef(selectedMovie?.id);

  // Sync search input only when a movie is explicitly selected externally or reset
  useEffect(() => {
    if (selectedMovie && selectedMovie.id !== prevSelectedMovieId.current) {
      prevSelectedMovieId.current = selectedMovie.id;
      setSearchTerm(selectedMovie.title);
    } else if (!selectedMovie && prevSelectedMovieId.current) {
      prevSelectedMovieId.current = null;
      setSearchTerm('');
    }
  }, [selectedMovie]);

  // Debounced search logic
  useEffect(() => {
    const trimmed = searchTerm.trim();

    // If query matches current selected movie title, show popular or cached list without refetch
    if (selectedMovie && trimmed.toLowerCase() === selectedMovie.title.toLowerCase()) {
      return;
    }

    if (!trimmed) {
      return;
    }

    let isMounted = true;

    const timer = setTimeout(async () => {
      setIsLoading(true);
      setErrorMsg('');
      try {
        const results = await fetchMovies(trimmed);
        if (isMounted) {
          setSuggestions(results);
          setActiveIndex(-1);
        }
      } catch {
        if (isMounted) {
          setErrorMsg('Search failed. Please try again.');
          setSuggestions([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [searchTerm, selectedMovie]);

  // Handle outside click & tap
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const displayedSuggestions = searchTerm.trim()
    ? suggestions
    : initialMovies.slice(0, 8);

  const handleSelect = (movie) => {
    setSearchTerm(movie.title);
    setIsOpen(false);
    setActiveIndex(-1);
    onSelectMovie(movie);
  };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev < displayedSuggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : displayedSuggestions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < displayedSuggestions.length) {
        handleSelect(displayedSuggestions[activeIndex]);
      } else if (displayedSuggestions.length > 0) {
        handleSelect(displayedSuggestions[0]);
      } else if (onDiscoverClick) {
        onDiscoverClick();
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    setSearchTerm('');
    setSuggestions([]);
    setActiveIndex(-1);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handlePrimaryButtonClick = () => {
    if (isOpen && activeIndex >= 0 && activeIndex < displayedSuggestions.length) {
      handleSelect(displayedSuggestions[activeIndex]);
    } else if (searchTerm.trim() && displayedSuggestions.length > 0) {
      handleSelect(displayedSuggestions[0]);
    } else if (selectedMovie) {
      if (onDiscoverClick) onDiscoverClick();
    } else if (inputRef.current) {
      inputRef.current.focus();
      setIsOpen(true);
    }
  };

  return (
    <div className="search-autocomplete" ref={containerRef}>
      {/* Search Input Bar */}
      <div className="search-input-shell focus-within-glow">
        <div className="search-leading-icon" aria-hidden="true">
          <span className="material-symbols-outlined">search</span>
        </div>

        <input
          id="movie-search-input"
          ref={inputRef}
          type="text"
          className="search-input-field"
          placeholder="Search for a movie you love..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-label="Search movie by title"
        />

        {isLoading && (
          <div className="search-loading-spinner" aria-label="Searching catalog">
            <span className="spinner-ring" />
          </div>
        )}

        {searchTerm && !isLoading && (
          <button
            type="button"
            className="search-clear-button"
            onClick={handleClear}
            aria-label="Clear search input"
            title="Clear search"
          >
            ✕
          </button>
        )}

        <button
          type="button"
          className="btn-discover-hero glow-amber"
          onClick={handlePrimaryButtonClick}
          title="Find similar movies"
        >
          <span className="material-symbols-outlined text-sm" aria-hidden="true">
            auto_awesome
          </span>
          <span className="btn-discover-label">Discover Similar Movies</span>
        </button>
      </div>

      {/* Autocomplete Dropdown Preview */}
      {isOpen && (
        <div className="autocomplete-dropdown-panel" role="listbox">
          <div className="dropdown-meta-header">
            <span className="meta-header-left">
              {searchTerm.trim()
                ? `Search Results (${displayedSuggestions.length})`
                : `Popular Movies (${displayedSuggestions.length})`}
            </span>
            <span className="meta-header-right">Movie Catalog</span>
          </div>

          {errorMsg ? (
            <div className="dropdown-state-message text-error">{errorMsg}</div>
          ) : displayedSuggestions.length > 0 ? (
            <ul className="suggestions-list-group">
              {displayedSuggestions.map((movie, index) => {
                const isActive = index === activeIndex;
                const isCurrentSeed = selectedMovie?.id === movie.id;
                const rating = movie.rating != null ? Number(movie.rating).toFixed(1) : null;

                return (
                  <li
                    key={movie.id}
                    role="option"
                    aria-selected={isActive}
                    className={`suggestion-row ${isActive ? 'is-active-row' : ''} ${isCurrentSeed ? 'is-current-seed' : ''}`}
                    onClick={() => handleSelect(movie)}
                    onMouseEnter={() => setActiveIndex(index)}
                  >
                    {/* Mini Poster Preview */}
                    <div className="suggestion-poster-thumbnail">
                      <MoviePoster movie={movie} className="thumbnail-poster" />
                    </div>

                    {/* Middle Info Column */}
                    <div className="suggestion-details">
                      <div className="suggestion-title-row">
                        <span className="movie-row-title">{movie.title}</span>
                        {movie.release_year && (
                          <span className="movie-row-year">({movie.release_year})</span>
                        )}
                        {isCurrentSeed && (
                          <span className="active-seed-pill">Selected</span>
                        )}
                      </div>
                      <p className="movie-row-snippet">
                        {movie.overview
                          ? movie.overview
                          : 'Feature film in movie catalog.'}
                      </p>
                    </div>

                    {/* Right Rating Column */}
                    {rating && (
                      <div className="suggestion-rating-badge">
                        <span className="material-symbols-outlined fill-icon text-xs">star</span>
                        <span>{rating}</span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="dropdown-state-message">
              No movies found matching "{searchTerm}". Try another title from the catalog.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
