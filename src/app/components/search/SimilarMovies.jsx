"use client";

import React from "react";
import { SimilarMovieCard } from "./SimilarMovieCard";

const GRID = "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-9";

// The ranked "more like this" grid. Its states are scoped to the section on
// purpose: a recommender outage must leave the focused film above it intact.

function SkeletonGrid() {
  return (
    <div className={GRID} aria-hidden>
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i}>
          <div className="w-full aspect-[2/3] bg-fadedBlack/5 animate-pulse" />
          <div className="h-3 w-3/4 bg-fadedBlack/5 animate-pulse mt-3" />
        </div>
      ))}
    </div>
  );
}

export function SimilarMovies({ movies, state, visibleCount, onShowMore, onOpen, onRetry }) {
  const visible = movies.slice(0, visibleCount);
  const hasMore = visibleCount < movies.length;

  return (
    <section className="border-t border-fadedBlack/10 mt-16 pt-10">
      <p className="font-dmSans text-[9px] uppercase tracking-[0.22em] text-fadedBlack/70 mb-6">More Like This</p>

      {state === "loading" && <SkeletonGrid />}

      {state === "ready" && movies.length > 0 && (
        <>
          <div className={GRID}>
            {visible.map((m) => (
              <SimilarMovieCard key={m.slug} movie={m} onOpen={() => onOpen(m)} />
            ))}
          </div>

          {/* The route already hydrated up to 50, so this is a pure reveal. */}
          {hasMore && (
            <div className="flex justify-center mt-12">
              <button
                onClick={onShowMore}
                className="min-h-[44px] px-8 font-dmSans text-[10px] uppercase tracking-[0.12em] text-fadedBlack border border-fadedBlack/15 hover:bg-backgroundSecondary transition-colors duration-200"
              >
                Show More
              </button>
            </div>
          )}
        </>
      )}

      {/* Realistic for films with thin embedding coverage. */}
      {state === "ready" && movies.length === 0 && (
        <p className="font-dmSans text-fadedBlack/70 text-sm leading-relaxed py-8">
          Nothing similar yet — we haven&apos;t mapped enough around this one.
        </p>
      )}

      {state === "error" && (
        <div className="py-8">
          <p className="font-dmSans text-fadedBlack/70 text-sm leading-relaxed mb-6">
            We couldn&apos;t load films like this one.
          </p>
          <button
            onClick={onRetry}
            className="min-h-[44px] px-8 font-dmSans text-[10px] uppercase tracking-[0.12em] text-fadedBlack border border-fadedBlack/15 hover:bg-backgroundSecondary transition-colors duration-200"
          >
            Try Again
          </button>
        </div>
      )}
    </section>
  );
}
