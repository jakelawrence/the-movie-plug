"use client";

import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Navbar } from "../components/Navbar";
import Loading from "../components/Loading";
import { SearchBar } from "../components/SearchBar";
import { FocusedMovie } from "../components/search/FocusedMovie";
import { SimilarMovies } from "../components/search/SimilarMovies";
import { MovieDetailsModal } from "@/app/components/MovieDetailsModal";
import { useAuth } from "../hooks/useAuth";

// ─── Search — Look Up a Film ─────────────────────────────────────────────────
// `?movie=<slug>` is the single source of truth for which film is focused. The
// panel below the search bar and the similar films grid both hang off it, and
// both fetch in parallel so the panel never waits on the recommender.

const SIMILAR_PAGE_SIZE = 12;

function SearchPageFallback() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar isLoaded={true} currentPage="search" />
      <div className="flex-1 flex items-center justify-center">
        <Loading />
      </div>
    </div>
  );
}

function SearchPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = searchParams.get("movie");
  const { user, isLoading: authLoading } = useAuth();
  const [isLoaded, setIsLoaded] = useState(false);

  const [movie, setMovie] = useState(null);
  const [movieState, setMovieState] = useState("idle"); // idle | loading | ready | missing | error
  const [retryToken, setRetryToken] = useState(0);
  const [selectedMovie, setSelectedMovie] = useState(null); // film shown in the details modal

  const [similar, setSimilar] = useState([]);
  const [similarState, setSimilarState] = useState("idle"); // idle | loading | ready | error
  const [similarRetryToken, setSimilarRetryToken] = useState(0);
  const [visibleCount, setVisibleCount] = useState(SIMILAR_PAGE_SIZE);

  const [savedSlugs, setSavedSlugs] = useState(new Set());
  const [savedLoaded, setSavedLoaded] = useState(false); // has the saved-slugs fetch settled?
  const [saveError, setSaveError] = useState(null);
  const [myServiceIds, setMyServiceIds] = useState([]); // provider IDs the user subscribes to

  const panelRef = useRef(null);
  const pendingHandoff = useRef(null); // null | "search" | "explore" — see the handoff effect

  useEffect(() => setIsLoaded(true), []);

  // Resolve the focused slug. Aborting on change keeps rapid successive searches
  // from landing out of order and leaving a stale film on screen.
  useEffect(() => {
    // A failed save belongs to the film it happened on, not the next one.
    setSaveError(null);

    if (!slug) {
      setMovie(null);
      setMovieState("idle");
      return;
    }

    const controller = new AbortController();
    setMovieState("loading");
    setMovie(null);

    (async () => {
      try {
        const res = await fetch(`/api/movies?slug=${encodeURIComponent(slug)}&limit=1`, { signal: controller.signal });
        if (!res.ok) throw new Error("lookup failed");
        const data = await res.json();
        const found = data.movies?.[0];
        // A miss is a 200 with an empty array, not a 404 — treat it as "missing".
        if (!found) {
          setMovieState("missing");
          return;
        }
        setMovie(found);
        setMovieState("ready");
      } catch (err) {
        if (err.name === "AbortError") return;
        setMovieState("error");
      }
    })();

    return () => controller.abort();
  }, [slug, retryToken]);

  // Films like this one. Fires on the same slug change as the lookup above
  // rather than chaining off it — the two are independent requests.
  useEffect(() => {
    if (!slug) {
      setSimilar([]);
      setSimilarState("idle");
      return;
    }

    const controller = new AbortController();
    setSimilarState("loading");
    setSimilar([]);
    setVisibleCount(SIMILAR_PAGE_SIZE);

    (async () => {
      try {
        // No filter keys: the route already defaults every one of them to the
        // "no filter" case, so an omitted field says exactly what we mean.
        const res = await fetch("/api/suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "collaborative", inputSlugs: [slug] }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("suggestions failed");
        const data = await res.json();
        const recommendations = data.recommendations || [];
        setSimilar(recommendations);
        setSimilarState("ready");

        // Recommendations carry their own bookmark state, so the grid and its
        // modal are in sync before the saved-movies fetch lands. Merge only —
        // the focused film is never in this list, so replacing would drop it.
        const bookmarked = recommendations.filter((m) => m.isBookmarkedByUser).map((m) => m.slug);
        if (bookmarked.length > 0) {
          setSavedSlugs((prev) => new Set([...prev, ...bookmarked]));
        }
      } catch (err) {
        if (err.name === "AbortError") return;
        setSimilarState("error");
      }
    })();

    return () => controller.abort();
  }, [slug, similarRetryToken]);

  // The focused film is never in its own similar list, so the recommendations
  // response can't tell us whether it's saved. Load the user's saved slugs once
  // per session instead — one fetch covers every film they focus.
  useEffect(() => {
    if (!user?.username) {
      setSavedSlugs(new Set());
      setSavedLoaded(false);
      return;
    }
    let cancelled = false;
    setSavedLoaded(false);
    (async () => {
      try {
        const res = await fetch("/api/user/saved-movies");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setSavedSlugs(new Set((data.savedMovies || []).map((m) => m.slug)));
      } catch (err) {
        console.error("Failed to load saved movies:", err);
      } finally {
        // Settled either way — the button must stop waiting even on failure.
        if (!cancelled) setSavedLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.username]);

  // Streaming services let the details modal group providers under "Available On
  // Your Services". Failure is non-fatal — the modal falls back to a plain list.
  useEffect(() => {
    if (!user?.username) {
      setMyServiceIds([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/user/streaming-services");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setMyServiceIds(Array.isArray(data.streamingServices) ? data.streamingServices : []);
      } catch (err) {
        console.error("Failed to load streaming services:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.username]);

  // Push, not replace — the back button then walks back through the chain of
  // films the user explored.
  const focusMovie = useCallback(
    (movie) => router.push(`/search?movie=${encodeURIComponent(movie.slug)}`),
    [router],
  );

  // Picked from the search bar. Flagged so the effect below can hand focus over —
  // the film appears well below the input, out of a screen reader user's view.
  const selectMovieFromSearch = useCallback(
    (target) => {
      pendingHandoff.current = "search";
      focusMovie(target);
    },
    [focusMovie],
  );

  // Explore: make the film in the modal the new focus. Close first, then push —
  // otherwise RemoveScroll unmounts mid-navigation and can leave the body locked.
  const exploreMovie = useCallback(
    (target) => {
      if (!target) return;
      pendingHandoff.current = "explore";
      setSelectedMovie(null);
      focusMovie(target);
    },
    [focusMovie],
  );

  // Hand the user over to the new film. Focus moves on both paths — after an
  // explore the modal that had focus is gone, and after a search pick focus would
  // otherwise sit in a now-empty input. Only the explore path scrolls: that user
  // clicked a card partway down the page, while the search user is already at the
  // top and would be yanked past the header. A deep link or a back/forward move
  // sets no flag, so neither steals focus.
  useEffect(() => {
    const handoff = pendingHandoff.current;
    if (!handoff) return;
    pendingHandoff.current = null;

    if (handoff === "explore") {
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      panelRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }
    // preventScroll so this never fights the smooth scroll above, and never
    // scrolls at all on the search path.
    panelRef.current?.focus({ preventScroll: true });
  }, [slug]);

  // Optimistic, with rollback: saving is this page's primary action, so a button
  // that silently does nothing is worse here than it would be on a grid.
  const handleToggleSave = async (target) => {
    if (!target) return;

    if (!user?.username) {
      const returnTo = `/search?movie=${encodeURIComponent(target.slug)}`;
      router.push(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }

    const wasSaved = savedSlugs.has(target.slug);
    setSaveError(null);
    setSavedSlugs((prev) => {
      const next = new Set(prev);
      wasSaved ? next.delete(target.slug) : next.add(target.slug);
      return next;
    });

    try {
      const res = await fetch("/api/user/saved-movies", {
        method: wasSaved ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movieSlug: target.slug }),
      });
      if (!res.ok) throw new Error("save failed");
    } catch (err) {
      console.error("Failed to update saved movies:", err);
      setSavedSlugs((prev) => {
        const next = new Set(prev);
        wasSaved ? next.add(target.slug) : next.delete(target.slug);
        return next;
      });
      setSaveError("Couldn't update your saved movies. Try again.");
    }
  };

  // Signed out, there's nothing to wait for — the button routes to login. Signed
  // in, hold a neutral state until the saved slugs land so the label can't flip.
  const savePending = authLoading || (!!user?.username && !savedLoaded);

  return (
    <div className="min-h-screen bg-background pb-24">
      <Navbar isLoaded={isLoaded} currentPage="search" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8">
        {/* ── Header ── */}
        <div className={`transition-all duration-700 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
          <h1 className="font-dmSerifDisplay text-fadedBlack text-4xl sm:text-5xl leading-[0.95]">look up a film</h1>
        </div>

        {/* ── Search ── */}
        {/* Fade only, no translate: a lingering transform on this wrapper would
            make it a containing block for the absolutely-positioned dropdown. */}
        <div
          className={`mt-8 max-w-xl transition-opacity duration-700 ${isLoaded ? "opacity-100" : "opacity-0"}`}
          style={{ transitionDelay: "150ms" }}
        >
          <SearchBar onSelectMovie={selectMovieFromSearch} />
        </div>

        {/* A dedicated live region rather than one wrapping the panel: role="status"
            on the panel itself is aria-atomic, so every poster fade-in and button
            label change would re-read the whole film. This announces the one thing
            that actually changed. */}
        <p role="status" aria-live="polite" className="sr-only">
          {movieState === "ready" && movie
            ? `Now showing ${movie.title}`
            : movieState === "missing"
              ? "That film was not found"
              : movieState === "error"
                ? "That film could not be loaded"
                : ""}
        </p>

        {/* ── Focused film ── */}
        {/* Focus target after a search pick or an explore; scroll-mt keeps an
            explore landing off the very top edge. No outline override — the
            global :focus-visible ring in globals.css is the app-wide indicator,
            and a keyboard user needs to see where focus went. */}
        <div ref={panelRef} tabIndex={-1} className="mt-12 scroll-mt-8">
          {movieState === "idle" && (
            // Nothing focused yet
            <div
              className={`border-t border-fadedBlack/10 py-24 text-center transition-all duration-700 ${
                isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
              }`}
              style={{ transitionDelay: "300ms" }}
            >
              <h3 className="font-dmSerifDisplay text-fadedBlack text-3xl leading-tight mb-3">search a title</h3>
              <p className="font-dmSans text-fadedBlack/70 text-sm max-w-xs mx-auto leading-relaxed">
                Find a film to see its details and what else is like it.
              </p>
            </div>
          )}

          {/* Fixed height so the similar films section below doesn't jump on resolve */}
          {movieState === "loading" && (
            <div className="min-h-[420px] flex items-center justify-center">
              <Loading />
            </div>
          )}

          {movieState === "ready" && movie && (
            <FocusedMovie
              key={slug}
              movie={movie}
              onDetails={() => setSelectedMovie(movie)}
              onToggleSave={() => handleToggleSave(movie)}
              isSaved={savedSlugs.has(movie.slug)}
              savePending={savePending}
              isSignedIn={!!user?.username}
              saveError={saveError}
            />
          )}

          {movieState === "missing" && (
            <div className="border-t border-fadedBlack/10 py-24 text-center">
              <h3 className="font-dmSerifDisplay text-fadedBlack text-3xl leading-tight mb-3">we don&apos;t have that film</h3>
              <p className="font-dmSans text-fadedBlack/70 text-sm max-w-xs mx-auto leading-relaxed">
                Try another title — search above.
              </p>
            </div>
          )}

          {movieState === "error" && (
            <div className="border-t border-fadedBlack/10 py-24 text-center">
              <h3 className="font-dmSerifDisplay text-fadedBlack text-3xl leading-tight mb-3">something went wrong</h3>
              <p className="font-dmSans text-fadedBlack/70 text-sm max-w-xs mx-auto leading-relaxed mb-8">
                We couldn&apos;t load that film.
              </p>
              <button
                onClick={() => setRetryToken((n) => n + 1)}
                className="font-dmSans text-[10px] uppercase tracking-[0.12em] text-fadedBlack border border-fadedBlack px-8 py-3.5 hover:bg-fadedBlack hover:text-background transition-colors duration-200"
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* ── Similar films ── */}
        {/* Only under a film we actually resolved — no "more like this" hanging
            under a missing-film message. */}
        {movieState === "ready" && (
          <SimilarMovies
            movies={similar}
            state={similarState}
            visibleCount={visibleCount}
            onShowMore={() => setVisibleCount((n) => n + SIMILAR_PAGE_SIZE)}
            onOpen={setSelectedMovie}
            onRetry={() => setSimilarRetryToken((n) => n + 1)}
          />
        )}
      </div>

      {/* ── Details modal ── */}
      {selectedMovie && (
        <MovieDetailsModal
          movie={selectedMovie}
          onClose={() => setSelectedMovie(null)}
          onToggleSave={() => handleToggleSave(selectedMovie)}
          isSaved={savedSlugs.has(selectedMovie.slug)}
          canSave={!!user?.username}
          myServiceIds={myServiceIds}
          // Omitted for the focused film's own Details — it is already the focus.
          onExplore={selectedMovie.slug === slug ? undefined : () => exploreMovie(selectedMovie)}
        />
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchPageFallback />}>
      <SearchPageInner />
    </Suspense>
  );
}
