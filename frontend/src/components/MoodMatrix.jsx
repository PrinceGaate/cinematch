import React, { useState } from 'react';

const MOODS = [
  {
    id: 'mind-bending',
    label: 'Mind-bending',
    emoji: '🌀',
    description: 'Non-linear timelines, cerebral twists, and philosophical paradoxes.',
    seedSuggestions: ['Inception', 'Memento', 'Fight Club', 'The Prestige']
  },
  {
    id: 'feel-good',
    label: 'Feel-good',
    emoji: '✨',
    description: 'Heartwarming narratives, uplifting human spirit, and optimism.',
    seedSuggestions: ['Forrest Gump', 'Back to the Future', 'Up', 'Toy Story']
  },
  {
    id: 'dark-gritty',
    label: 'Dark & gritty',
    emoji: '⚡',
    description: 'Atmospheric neo-noir tension, visceral stakes, and moral ambiguity.',
    seedSuggestions: ['The Dark Knight', 'Pulp Fiction', 'Se7en', 'Fight Club']
  },
  {
    id: 'epic-adventures',
    label: 'Epic adventures',
    emoji: '🚀',
    description: 'Vast cinematic canvases, interstellar expeditions, and grand world-building.',
    seedSuggestions: ['Avatar', 'Interstellar', 'Gladiator', 'The Avengers']
  },
  {
    id: 'sci-fi-worlds',
    label: 'Sci-fi worlds',
    emoji: '🪐',
    description: 'Deep cosmic exploration, artificial intelligence, and speculative futures.',
    seedSuggestions: ['Interstellar', 'The Matrix', 'The Martian', 'Blade Runner']
  },
  {
    id: 'emotional-stories',
    label: 'Emotional stories',
    emoji: '🎭',
    description: 'Profound character arcs, evocative drama, and intimate human bonds.',
    seedSuggestions: ['Titanic', 'The Shawshank Redemption', 'Good Will Hunting', 'Cast Away']
  }
];

export default function MoodMatrix({ onSelectMoodMovie, initialMovies = [] }) {
  const [activeMoodId, setActiveMoodId] = useState('epic-adventures');

  const currentMood = MOODS.find(m => m.id === activeMoodId) || MOODS[0];

  const handleChipClick = (mood) => {
    setActiveMoodId(mood.id);
  };

  const handleSeedClick = (title) => {
    // Try to find the exact movie from initialMovies catalog
    const matched = initialMovies.find(
      m => m.title.toLowerCase() === title.toLowerCase()
    );
    if (matched && onSelectMoodMovie) {
      onSelectMoodMovie(matched);
    } else if (onSelectMoodMovie) {
      onSelectMoodMovie({ title, id: null });
    }
  };

  return (
    <section className="mood-matrix-section" id="mood-matrix" aria-label="Explore by Mood">
      <div className="section-container">
        {/* Header */}
        <div className="mood-matrix-header">
          <div>
            <div className="mood-section-eyebrow">
              <span className="material-symbols-outlined text-sm">movie_filter</span>
              <span>CURATED COLLECTIONS</span>
            </div>
            <h2 className="mood-matrix-title">
              Explore by mood
            </h2>
            <p className="mood-matrix-subtitle">
              Browse popular movies tailored to different cinematic feelings and atmospheres.
            </p>
          </div>
          <span className="mood-matrix-hint">Select a mood to browse suggestions</span>
        </div>

        {/* Interactive Mood Chips */}
        <div className="mood-chips-container" role="tablist">
          {MOODS.map((mood) => {
            const isActive = mood.id === activeMoodId;
            return (
              <button
                key={mood.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`mood-chip-btn ${isActive ? 'is-active-mood glow-amber' : ''}`}
                onClick={() => handleChipClick(mood)}
              >
                <span className="mood-chip-label">{mood.label}</span>
                <span className="mood-chip-emoji" aria-hidden="true">{mood.emoji}</span>
                {isActive && <span className="mood-active-dot" />}
              </button>
            );
          })}
        </div>

        {/* Active Mood Drawer */}
        <div className="mood-detail-drawer">
          <div className="mood-detail-info">
            <span className="mood-detail-emoji">{currentMood.emoji}</span>
            <div>
              <h4 className="mood-detail-title">{currentMood.label} Movies</h4>
              <p className="mood-detail-desc">{currentMood.description}</p>
            </div>
          </div>

          <div className="mood-suggestion-group">
            <span className="mood-suggestion-label">Featured Movies:</span>
            <div className="mood-seed-pills">
              {currentMood.seedSuggestions.map((title) => (
                <button
                  key={title}
                  type="button"
                  className="mood-seed-button"
                  onClick={() => handleSeedClick(title)}
                  title={`Find movies similar to "${title}"`}
                >
                  <span className="material-symbols-outlined text-xs">play_arrow</span>
                  <span>{title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
