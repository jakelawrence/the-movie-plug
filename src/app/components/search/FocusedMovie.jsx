"use client";

import React, { useEffect, useState } from "react";
import { Bookmark, BookmarkCheck, Info } from "lucide-react";
import { FALLBACK_POSTER_URL, getPosterUrl } from "@/app/utils/posters";
import { MetaRow } from "./MetaRow";

// The focused film on /search — poster left, details right on sm+, stacked and
// centered on mobile. Shows what a spin reveals, minus the spin framing. Every
// field is optional, so nothing here renders a label or separator it can't fill.

// Returns null rather than an empty row: a film whose levels clear no threshold
// would otherwise leave a badge-sized hole between the meta and credit rows.
function VibeBadges({ movie }) {
  const tag = "font-dmSans text-[9px] uppercase tracking-[0.1em] text-fadedBlack/70 border border-fadedBlack/15 px-2 py-0.5";
  const badges = [
    movie.darknessLevel > 6 && "Dark",
    movie.darknessLevel < 4 && "Light",
    movie.intensenessLevel > 7 && "Intense",
    movie.funninessLevel > 6 && "Funny",
    movie.slownessLevel > 6 && "Slow Burn",
  ].filter(Boolean);

  if (badges.length === 0) return null;

  return (
    <div className="flex gap-1.5 flex-wrap justify-center sm:justify-start mt-4">
      {badges.map((label) => (
        <span key={label} className={tag}>
          {label}
        </span>
      ))}
    </div>
  );
}

export function FocusedMovie({ movie, onDetails, onToggleSave, isSaved, savePending, isSignedIn, saveError }) {
  const [posterLoaded, setPosterLoaded] = useState(false);
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Under reduced motion, fade only — no translate.
  const entrance = reduce
    ? shown
      ? "opacity-100"
      : "opacity-0"
    : shown
      ? "opacity-100 translate-y-0"
      : "opacity-0 translate-y-4";

  const genres = movie.genres || movie.genreNames;

  return (
    <div
      className={`flex flex-col items-center sm:flex-row sm:items-start gap-8 sm:gap-10 transition-all duration-500 ease-out ${entrance}`}
    >
      {/* Poster */}
      <div className="relative w-44 sm:w-56 flex-shrink-0 aspect-[2/3] border border-fadedBlack/10 bg-fadedBlack/5 overflow-hidden">
        {!posterLoaded && <div className="absolute inset-0 bg-fadedBlack/5 animate-pulse" />}
        <img
          src={getPosterUrl(movie, "large")}
          alt={`${movie.title} poster`}
          width="1000"
          height="1500"
          decoding="async"
          className={`w-full h-full object-cover transition-opacity duration-300 ${posterLoaded ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setPosterLoaded(true)}
          onError={(e) => {
            // A dead remote URL still 404s even though getPosterUrl screened the
            // known-empty ones, so swap in the placeholder rather than go blank.
            if (!e.currentTarget.src.endsWith(FALLBACK_POSTER_URL)) {
              e.currentTarget.src = FALLBACK_POSTER_URL;
            }
            setPosterLoaded(true);
          }}
        />
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0 text-center sm:text-left">
        {/* Titles carry non-breaking spaces; swap them so long ones can wrap. */}
        <h2 className="font-dmSerifDisplay text-fadedBlack text-4xl sm:text-5xl leading-[0.95]">
          {movie.title?.replace(/\u00A0/g, " ")}
        </h2>

        {movie.tagline && (
          <p className="font-dmSans font-light text-xs text-fadedBlack/45 mt-3 italic border-l border-fadedBlack/15 pl-2.5 text-left inline-block">
            {movie.tagline}
          </p>
        )}

        <MetaRow
          className="justify-center sm:justify-start gap-3 mt-4 text-fadedBlack/70 font-dmSans text-sm tabular-nums"
          parts={[
            movie.year ? String(movie.year) : null,
            movie.duration != null ? `${movie.duration}m` : null,
            movie.averageRating != null ? `★ ${movie.averageRating.toFixed(1)}` : null,
          ]}
        />

        <VibeBadges movie={movie} />

        <MetaRow
          className="justify-center sm:justify-start gap-3 mt-4 font-dmSans text-sm text-fadedBlack/70"
          parts={[movie.director || null, genres?.length > 0 ? genres.join(", ") : null]}
        />

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-8">
          {savePending ? (
            // Placeholder rather than a label: guessing "Save" or "Remove" before
            // the saved slugs land would flash the wrong one. Same box as the real
            // button — hidden content holds the geometry, so nothing shifts.
            <div
              aria-hidden
              className="flex items-center gap-2 px-8 py-3.5 border border-fadedBlack/10 bg-fadedBlack/5 animate-pulse font-dmSans text-[10px] uppercase tracking-[0.12em]"
            >
              <Bookmark size={14} strokeWidth={2.5} className="opacity-0" />
              <span className="opacity-0">Save to My Movies</span>
            </div>
          ) : (
            // Signed out this stays live and routes to login — a dead primary
            // button is a worse first impression than a redirect.
            <button
              onClick={onToggleSave}
              className={`flex items-center gap-2 px-8 py-3.5 font-dmSans text-[10px] uppercase tracking-[0.12em] border transition-colors duration-200 ${
                isSaved
                  ? "bg-fadedBlack text-background border-fadedBlack hover:bg-background hover:text-fadedBlack"
                  : "bg-fadedBlack text-background border-fadedBlack hover:bg-fadedBlue hover:border-fadedBlue"
              }`}
            >
              {isSaved ? <BookmarkCheck size={14} strokeWidth={2.5} /> : <Bookmark size={14} strokeWidth={2.5} />}
              {isSaved ? "Remove from Saved" : "Save to My Movies"}
            </button>
          )}

          <button
            onClick={onDetails}
            className="flex items-center gap-2 bg-background text-fadedBlack px-8 py-3.5 font-dmSans text-[10px] uppercase tracking-[0.12em] border border-fadedBlack/15 hover:bg-backgroundSecondary transition-colors duration-200"
          >
            <Info size={14} strokeWidth={2} />
            Details
          </button>
        </div>

        {!savePending && !isSignedIn && (
          <p className="font-dmSans text-fadedBlack/40 text-[10px] uppercase tracking-wide mt-3">Sign in to save.</p>
        )}

        {saveError && (
          <p role="alert" className="font-dmSans text-danger text-xs mt-3">
            {saveError}
          </p>
        )}
      </div>
    </div>
  );
}
