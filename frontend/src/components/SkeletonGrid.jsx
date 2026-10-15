import React from 'react';

export default function SkeletonGrid({ count = 5 }) {
  const items = Array.from({ length: count });

  return (
    <div
      className="stitch-recommendations-grid"
      aria-busy="true"
      aria-label="Finding similar movies"
    >
      {items.map((_, i) => (
        <div key={i} className="stitch-skeleton-card">
          <div className="skeleton-poster-box shimmer" />
          <div className="skeleton-body-box">
            <div className="skeleton-line-title shimmer" />
            <div className="skeleton-line-sub shimmer" />
            <div className="skeleton-line-desc shimmer" />
            <div className="skeleton-line-desc-2 shimmer" />
            <div className="skeleton-footer-split shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
}
