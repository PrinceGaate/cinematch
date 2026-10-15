import React, { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import SearchAutocomplete from './components/SearchAutocomplete';
import SelectedMovieHero from './components/SelectedMovieHero';
import MovieCard from './components/MovieCard';
import SkeletonGrid from './components/SkeletonGrid';
import MoodMatrix from './components/MoodMatrix';
import { checkHealth, fetchMovies, fetchRecommendations } from './services/api';
import './App.css';

const HERO_BACKDROP_IMAGE = 'https://lh3.googleusercontent.com/aida-public/AB6AXuDyH43P1Hb5f87em9pwTbeIoW2RevHdF823wz0UWOIeL_qQyYbEq6VvCs-bZjBmA86kV62Q80Yks0TENn4ZJVKCkUl4YSxqRBVVF9i4DYTb9q8PQGMnBhfnb9SZB6JNUn5Cxj6X-bUCCFqdlNQvT1hd7iiJcHHYdr0XUJ0GyJW1B9yV88VE-t9v_wOHFaXga1J5-QttAgC31F2pl7kGL37JAExPvzZZG5cAyVFMys7_pBeB0tyz0ZQWrA';

const HERO_BACKDROP_STYLE = Object.freeze({
  backgroundImage: `url('${HERO_BACKDROP_IMAGE}')`
});

export default function App() {
  const [healthStatus, setHealthStatus] = useState(null);
  const [initialMovies, setInitialMovies] = useState([]);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const recommendationsRef = useRef(null);
  const searchInputAnchorRef = useRef(null);

  // Initialize: Healthcheck & Initial Popular Movies with auto-reconnection
  useEffect(() => {
    let isMounted = true;
    let pollTimer = null;

    async function checkBackendHealth() {
      try {
        const health = await checkHealth();
        if (isMounted) setHealthStatus(health);
        return health;
      } catch (err) {
        if (isMounted) setHealthStatus({ status: 'error', error: err.message, latency: 0 });
        return null;
      }
    }

    async function loadCatalog() {
      try {
        const movies = await fetchMovies('');
        if (isMounted) {
          setInitialMovies(movies);
        }
      } catch (err) {
        console.warn('Initial movies fetch error:', err.message);
      }
    }

    async function initApp() {
      const health = await checkBackendHealth();
      if (health?.status === 'healthy') {
        await loadCatalog();
      } else {
        // Polling retry only if backend was offline on mount
        pollTimer = setInterval(async () => {
          if (!isMounted) return;
          const h = await checkBackendHealth();
          if (h?.status === 'healthy') {
            await loadCatalog();
            clearInterval(pollTimer);
            pollTimer = null;
          }
        }, 4000);
      }
    }

    initApp();

    return () => {
      isMounted = false;
      if (pollTimer) clearInterval(pollTimer);
    };
  }, []);

  const currentSeedIdRef = useRef(null);
  const currentOffsetRef = useRef(0);

  // Smoothly scroll to the selected movie detail section with sticky header offset
  const scrollToSeedShowcase = () => {
    requestAnimationFrame(() => {
      const el = document.getElementById('seed-showcase');
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const headerOffset = 84;

      // Avoid unnecessary jump if already comfortably in view
      if (rect.top >= headerOffset - 20 && rect.top <= headerOffset + 140) {
        return;
      }

      const targetTop = rect.top + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: Math.max(0, targetTop),
        behavior: 'smooth'
      });
    });
  };

  // Fetch recommendations for the currently selected movie with offset pagination
  const handleGetRecommendations = async (targetMovie = selectedMovie) => {
    if (!targetMovie?.id) return;

    // Reset batch index if source movie has changed
    if (currentSeedIdRef.current !== targetMovie.id) {
      currentSeedIdRef.current = targetMovie.id;
      currentOffsetRef.current = 0;
    }

    const offsetToFetch = currentOffsetRef.current;

    setIsLoadingRecommendations(true);
    setErrorMessage('');

    try {
      const recs = await fetchRecommendations(targetMovie.id, 5, offsetToFetch);
      setRecommendations(recs);

      // Successfully connected; ensure online indicator is active
      if (healthStatus?.status !== 'healthy') {
        checkHealth().then(h => setHealthStatus(h)).catch(() => {});
      }

      // Advance batch offset for next click
      const batchCount = recs.length || 5;
      let nextOffset = offsetToFetch + batchCount;

      // Wrap around if all available recommendations have been shown
      const total = recs.totalCount;
      if (total != null && nextOffset >= total) {
        nextOffset = 0;
      } else if (recs.length < 5) {
        nextOffset = 0;
      }

      currentOffsetRef.current = nextOffset;
    } catch (err) {
      console.error('Error fetching recommendations:', err);
      // Handle recommendation error gracefully without marking backend offline
      setErrorMessage("We couldn't find recommendations right now. Please try again.");
      setRecommendations([]);
    } finally {
      setIsLoadingRecommendations(false);
    }
  };

  // When user selects a movie from autocomplete
  const handleSelectMovie = (movie) => {
    if (!movie) return;
    if (currentSeedIdRef.current !== movie.id) {
      currentSeedIdRef.current = movie.id;
      currentOffsetRef.current = 0;
      setRecommendations([]);
    }
    setSelectedMovie(movie);
    setErrorMessage('');
    scrollToSeedShowcase();
  };

  // When user selects a movie from Mood Matrix
  const handleSelectMoodMovie = async (movieLike) => {
    if (!movieLike?.title) return;
    setErrorMessage('');

    // Check if we already have full movie metadata in initialMovies or current recommendations
    let fullMovie = movieLike.id ? movieLike : null;
    if (!fullMovie) {
      const pool = [...initialMovies, ...recommendations];
      fullMovie = pool.find(
        (m) => m?.title?.toLowerCase() === movieLike.title.toLowerCase() && m?.id
      );
    }

    if (fullMovie) {
      currentSeedIdRef.current = fullMovie.id;
      currentOffsetRef.current = 0;
      setSelectedMovie(fullMovie);
      scrollToSeedShowcase();
      await handleGetRecommendations(fullMovie);
      return;
    }

    // Query backend for exact title match without flashing a dummy movie state
    setIsLoadingRecommendations(true);
    setRecommendations([]);

    try {
      const results = await fetchMovies(movieLike.title);
      if (results && results.length > 0) {
        const exactMatch = results.find(
          (m) => m.title.toLowerCase() === movieLike.title.toLowerCase()
        ) || results[0];

        // Successfully connected; ensure online indicator is active
        if (healthStatus?.status !== 'healthy') {
          checkHealth().then(h => setHealthStatus(h)).catch(() => {});
        }

        currentSeedIdRef.current = exactMatch.id;
        currentOffsetRef.current = 0;
        setSelectedMovie(exactMatch);
        scrollToSeedShowcase();
        await handleGetRecommendations(exactMatch);
      } else {
        setErrorMessage("We couldn't find recommendations right now. Please try again.");
        setIsLoadingRecommendations(false);
      }
    } catch (err) {
      console.error('Search error:', err);
      // Handle search error gracefully without marking backend offline
      setErrorMessage("We couldn't find recommendations right now. Please try again.");
      setIsLoadingRecommendations(false);
    }
  };

  // When user clicks "Find Similar" on any recommendation card
  const handlePivotMovie = (recMovie) => {
    currentSeedIdRef.current = recMovie.id;
    currentOffsetRef.current = 0;
    setSelectedMovie(recMovie);
    scrollToSeedShowcase();
    handleGetRecommendations(recMovie);
  };

  const handleReset = () => {
    currentSeedIdRef.current = null;
    currentOffsetRef.current = 0;
    setSelectedMovie(null);
    setRecommendations([]);
    setErrorMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleChangeSeedClick = () => {
    const inputEl = document.getElementById('movie-search-input');
    if (inputEl) {
      inputEl.focus();
      inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div className="stitch-app-layout">
      {/* Sticky Stitch Navigation Bar */}
      <Navbar onReset={handleReset} />

      <main className="stitch-main-container">
        {/* 1. HERO SECTION WITH ATMOSPHERIC BACKDROP */}
        <section className="stitch-hero-section" aria-label="Cinematic Discovery Hero">
          {/* Atmospheric Cinematic Backdrop with stable memoized style and CSS fallback */}
          <div
            className="hero-backdrop-image"
            style={HERO_BACKDROP_STYLE}
            aria-hidden="true"
          >
            <div className="hero-dark-overlay-vertical" />
            <div className="hero-dark-overlay-radial" />
          </div>

          <div className="hero-content-wrapper">
            {/* Eyebrow Pill */}
            <div className="hero-eyebrow-pill">
              <span className="hero-pulse-dot" />
              <span className="hero-eyebrow-text">YOUR NEXT FAVORITE FILM AWAITS</span>
            </div>

            {/* Display Headline */}
            <h1 className="hero-display-headline">
              Find your next <span className="hero-gradient-emphasis">obsession.</span>
            </h1>

            {/* Subtitle */}
            <p className="hero-lead-text">
              Discover films with matching themes, storylines, atmospheres, and styles across thousands of titles.
            </p>

            {/* Hero Search Box */}
            <div className="hero-search-wrapper" ref={searchInputAnchorRef}>
              <SearchAutocomplete
                onSelectMovie={handleSelectMovie}
                onDiscoverClick={() => handleGetRecommendations(selectedMovie)}
                selectedMovie={selectedMovie}
                initialMovies={initialMovies}
              />
            </div>

            {/* Trust Indicator Badge */}
            <div className="hero-trust-badge">
              <span className="trust-star">✦</span>
              <span>Explore 4,800+ movies ready for discovery</span>
            </div>
          </div>
        </section>

        {/* Global Error Alert Banner */}
        {errorMessage && (
          <div className="section-container">
            <div className="stitch-alert-banner alert-error" role="alert">
              <span className="material-symbols-outlined text-xl">error</span>
              <div className="alert-body">
                <strong>Notice: </strong> {errorMessage}
              </div>
              <button
                type="button"
                className="alert-close-btn"
                onClick={() => setErrorMessage('')}
                aria-label="Dismiss message"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* 2. SELECTED MOVIE SHOWCASE PANEL */}
        <SelectedMovieHero
          movie={selectedMovie}
          onGetRecommendations={() => handleGetRecommendations(selectedMovie)}
          isLoadingRecommendations={isLoadingRecommendations}
          onChangeSeedClick={handleChangeSeedClick}
        />

        {/* 3. RECOMMENDATION RESULTS SECTION */}
        <section
          className="recommendations-section"
          id="discover"
          ref={recommendationsRef}
          aria-label="Recommendation Results"
        >
          <div className="section-container">
            {/* Section Header */}
            <div className="recommendations-header-row">
              <div className="header-titles-group">
                <h2 className="recommendations-title">
                  {selectedMovie ? (
                    <>
                      Movies similar to <span className="highlight-seed-title">{selectedMovie.title}</span>
                    </>
                  ) : (
                    'Recommended Movies'
                  )}
                </h2>
                <p className="recommendations-subtext">
                  Hand-picked titles sharing themes, storyline, and cinematic style.
                </p>
              </div>
            </div>

            {/* Results Grid / Loading / Empty State */}
            {isLoadingRecommendations ? (
              <div className="recommendations-loading-wrap">
                <div className="recommendations-loading-banner">
                  <span className="spinner-ring-sm" />
                  <span>Finding movies you'll love...</span>
                </div>
                <SkeletonGrid count={5} />
              </div>
            ) : recommendations.length > 0 ? (
              <div className="stitch-recommendations-grid">
                {recommendations.map((recMovie, idx) => (
                  <MovieCard
                    key={recMovie.id}
                    movie={recMovie}
                    index={idx}
                    onSelect={handlePivotMovie}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-recommendations-panel">
                <div className="empty-target-icon-wrap">
                  <span className="material-symbols-outlined text-4xl text-primary-container">
                    auto_awesome
                  </span>
                </div>
                <h3 className="empty-state-title">Ready to discover your next favorite?</h3>
                <p className="empty-state-desc">
                  Search for a movie you love above or pick a title to find similar recommendations.
                </p>
                {selectedMovie && (
                  <button
                    type="button"
                    className="btn-generate-empty glow-amber"
                    onClick={() => handleGetRecommendations(selectedMovie)}
                    disabled={isLoadingRecommendations}
                  >
                    <span className="material-symbols-outlined text-sm">auto_awesome</span>
                    <span>Find Movies Similar to {selectedMovie.title}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        {/* 4. EXPLORE BY MOOD */}
        <MoodMatrix
          onSelectMoodMovie={handleSelectMoodMovie}
          initialMovies={initialMovies}
        />
      </main>

      {/* Site Footer */}
      <footer className="stitch-site-footer">
        <div className="section-container">
          <div className="footer-layout-row">
            <div className="footer-brand-info">
              <span className="footer-brand-name">CineMatch</span>
              <span className="footer-separator">•</span>
              <span className="footer-tagline">Movie Discovery &amp; Recommendations</span>
            </div>

            <div className="footer-nav-links">
              <a href="#discover" className="footer-link">Discover</a>
              <a href="#mood-matrix" className="footer-link">Explore by Mood</a>
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="footer-link"
              >
                GitHub
              </a>
            </div>

            <p className="footer-copyright">
              © 2025 CineMatch. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
