"use client";

import React, { useState } from "react";
import { FALLBACK_POSTER_URL, getPosterUrl } from "@/app/utils/posters";
import { MetaRow } from "./MetaRow";

// One card in the "more like this" grid. The whole card is a single button, so
// keyboard activation comes free and there's nothing interactive nested inside
// it — saving happens in the details modal, not here.

export function SimilarMovieCard({ movie, onOpen }) {
  const [posterLoaded, setPosterLoaded] = useState(false);

  return (
    <button
      onClick={onOpen}
      aria-label={`View details for ${movie.title}`}
      className="group text-left flex flex-col"
    >
      <div className="relative w-full aspect-[2/3] border border-fadedBlack/10 bg-fadedBlack/5 overflow-hidden">
        {!posterLoaded && <div className="absolute inset-0 bg-fadedBlack/5 animate-pulse" />}
        <img
          src={getPosterUrl(movie, "large")}
          alt={`${movie.title} poster`}
          width="1000"
          height="1500"
          loading="lazy"
          decoding="async"
          className={`w-full h-full object-cover transition-all duration-300 group-hover:scale-[1.03] ${
            posterLoaded ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => setPosterLoaded(true)}
          onError={(e) => {
            // getPosterUrl screens the known-empty URLs, but a live one can still
            // 404 — swap in the placeholder rather than leave a hole in the grid.
            if (!e.currentTarget.src.endsWith(FALLBACK_POSTER_URL)) {
              e.currentTarget.src = FALLBACK_POSTER_URL;
            }
            setPosterLoaded(true);
          }}
        />
      </div>

      {/* Titles carry non-breaking spaces; swap them so long ones can wrap. */}
      <p className="font-dmSerifDisplay text-fadedBlack text-sm leading-tight line-clamp-2 mt-3 group-hover:text-fadedBlue transition-colors duration-200">
        {movie.title?.replace(/\u00A0/g, " ")}
      </p>

      <MetaRow
        className="gap-1.5 mt-1.5 font-dmSans text-fadedBlack/70 text-[11px] tabular-nums"
        parts={[
          movie.year ? String(movie.year) : null,
          movie.duration != null ? `${movie.duration}m` : null,
          movie.averageRating != null ? `★ ${movie.averageRating.toFixed(1)}` : null,
        ]}
      />
    </button>
  );
}
