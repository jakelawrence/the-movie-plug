import { Search } from "lucide-react";
import { React, useRef, useState, useEffect, useId } from "react";
import { useRouter } from "next/navigation";
import { FALLBACK_POSTER_URL, getPosterUrl } from "../utils/posters";
import Loading from "./Loading";

function countNormalizedSearchCharacters(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/&/g, "and")
    .replace(/['']/g, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, "")
    .length;
}

// `onSelectMovie` lets a host page keep the user in place (e.g. /search swaps the
// focused film); without it the bar navigates to /search itself, which is what the
// home page relies on.
export const SearchBar = ({ disabled, onSelectMovie, autoFocus = false, scrollIntoViewOnFocus = false }) => {
  const router = useRouter();
  const searchInputRef = useRef(null);
  const dropdownRef = useRef(null);
  const listboxId = useId();
  const inputId = useId();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [loadedPosters, setLoadedPosters] = useState(new Set());
  const [searchId, setSearchId] = useState(0); // Unique ID for each search
  const [activeIndex, setActiveIndex] = useState(-1); // arrow-key cursor; -1 = none

  const optionId = (index) => `${listboxId}-option-${index}`;

  // A fresh result set invalidates the cursor.
  useEffect(() => {
    setActiveIndex(-1);
  }, [searchResults]);

  // Keep the arrowed-to option inside the scrollable dropdown.
  useEffect(() => {
    if (activeIndex < 0) return;
    dropdownRef.current?.children?.[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (!dropdownRef.current?.contains(e.target) && !searchInputRef.current?.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Debounce effect
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Search effect
  useEffect(() => {
    if (countNormalizedSearchCharacters(debouncedSearchQuery) < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      setLoadedPosters(new Set());
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();

    const searchMovies = async () => {
      setIsSearching(true);
      setSearchError(null);
      setLoadedPosters(new Set()); // Reset loaded posters for new search
      setSearchId((prev) => prev + 1); // Increment search ID to force image remount

      try {
        const response = await fetch(`/api/movies?title=${encodeURIComponent(debouncedSearchQuery)}&limit=10`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("Failed to search movies");
        }
        const data = await response.json();

        // Add a small delay before showing results to prevent poster flickering
        await new Promise((resolve) => setTimeout(resolve, 100));
        if (controller.signal.aborted) return;

        setSearchResults(data.movies || []);
        setShowDropdown(true);
      } catch (err) {
        if (err.name === "AbortError") return;
        setSearchError("Failed to search movies");
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    };

    searchMovies();

    return () => controller.abort();
  }, [debouncedSearchQuery]);

  const handleFocus = () => {
    // Opt-in: the home page search sits low in a tall hero and wants the scroll.
    // On pages where the input is already near the top it is just disorienting.
    if (scrollIntoViewOnFocus) {
      searchInputRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }

    // Re-open the dropdown when a previous query's results are still in state.
    if (searchResults.length > 0) setShowDropdown(true);
  };

  // Combobox keyboard model: focus stays in the input and the cursor moves via
  // aria-activedescendant. The options carry role="option", so arrow keys are
  // what a screen reader user expects — Tab alone left the pattern half-built.
  const handleKeyDown = (e) => {
    const isOpen = showDropdown && searchResults.length > 0;

    if (e.key === "Escape") {
      setShowDropdown(false);
      setActiveIndex(-1);
      return;
    }

    if (!isOpen) {
      // Re-open onto the first option when a previous query's results are still
      // in state, rather than making the user retype.
      if (e.key === "ArrowDown" && searchResults.length > 0) {
        e.preventDefault();
        setShowDropdown(true);
        setActiveIndex(0);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % searchResults.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => (i <= 0 ? searchResults.length - 1 : i - 1));
        break;
      case "Home":
        e.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        e.preventDefault();
        setActiveIndex(searchResults.length - 1);
        break;
      case "Enter":
        // Only when the user has arrowed to something — a bare Enter should not
        // guess at a pick.
        if (activeIndex >= 0 && searchResults[activeIndex]) {
          e.preventDefault();
          handleSearchMovie(searchResults[activeIndex]);
        }
        break;
      default:
        break;
    }
  };

  const handleSearchMovie = (movie) => {
    // Reset the input — on pages that don't navigate away, a stale query and an
    // open dropdown would sit on top of the film the user just picked.
    setSearchQuery("");
    setDebouncedSearchQuery("");
    setSearchResults([]);
    setShowDropdown(false);
    setActiveIndex(-1);

    if (onSelectMovie) {
      onSelectMovie(movie);
      return;
    }

    router.push(`/search?movie=${encodeURIComponent(movie.slug)}`);
  };

  const handlePosterLoad = (movieSlug) => {
    setLoadedPosters((prev) => new Set(prev).add(movieSlug));
  };

  const handlePosterError = (e, movieSlug) => {
    if (e.currentTarget.src.endsWith(FALLBACK_POSTER_URL)) {
      handlePosterLoad(movieSlug);
      return;
    }

    e.currentTarget.src = FALLBACK_POSTER_URL;
    handlePosterLoad(movieSlug);
  };

  return (
    <div className="relative w-full z-50">
      <form onSubmit={(e) => e.preventDefault()} className="relative">
        <label htmlFor={inputId} className="sr-only">
          Search for movies
        </label>
        <input
          type="text"
          value={searchQuery}
          ref={searchInputRef}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search for movies..."
          autoFocus={autoFocus}
          id={inputId}
          // aria-expanded/activedescendant are only valid on a combobox, not on
          // a plain textbox.
          role="combobox"
          aria-controls={listboxId}
          aria-expanded={showDropdown && searchResults.length > 0}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
          aria-describedby={searchError ? `${inputId}-error` : undefined}
          className={`w-full px-4 sm:px-6 py-3 sm:py-4 border-2 border-fadedBlack/50 bg-background text-fadedBlack placeholder-fadedBlack/65 font-bold text-base sm:text-lg outline-none focus:border-fadedBlack/70 transition-all ${
            disabled ? "opacity-50 pointer-events-none" : ""
          }`}
        />
        {isSearching ? (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <Loading size={22} className={disabled ? "opacity-50 pointer-events-none" : ""} />
          </div>
        ) : (
          <Search
            className={`absolute right-4 top-1/2 -translate-y-1/2 text-fadedBlack w-5 h-5 sm:w-6 sm:h-6 ${
              disabled ? "opacity-50 pointer-events-none" : ""
            }`}
            strokeWidth={3}
          />
        )}
      </form>

      {/* Dropdown */}
      {showDropdown && searchResults.length > 0 && (
        <div
          ref={dropdownRef}
          id={listboxId}
          role="listbox"
          aria-label="Movie search results"
          className={`absolute top-full left-0 w-full border-2 border-t-0 border-fadedBlack/50 bg-background overflow-y-auto max-h-[420px] z-50 ${
            disabled ? "opacity-50 pointer-events-none" : ""
          }`}
        >
          {searchResults.map((movie, index) => (
            <button
              key={`${searchId}-${movie.slug || movie.title}`} // Include searchId to force remount on new search
              onClick={() => handleSearchMovie(movie)}
              onMouseEnter={() => setActiveIndex(index)}
              id={optionId(index)}
              role="option"
              aria-selected={index === activeIndex}
              // Not tabbable: in a combobox the input keeps focus and arrows move
              // the cursor, so Tab should leave the widget rather than walk it.
              tabIndex={-1}
              aria-label={`Select ${movie.title}`}
              className={`w-full p-4 text-left border-b border-fadedBlack/10 last:border-b-0 transition-colors duration-100 flex items-center gap-3 ${
                index === activeIndex ? "bg-backgroundSecondary" : "hover:bg-backgroundSecondary"
              }`}
            >
              <div className="relative w-12 h-16 flex-shrink-0">
                {/* Loading placeholder */}
                {!loadedPosters.has(movie.slug) && <div className="absolute inset-0 bg-fadedBlack/8 animate-pulse" />}

                {/* Actual poster */}
                <img
                  key={`${searchId}-poster-${movie.slug}`} // Force new image element on search change
                  src={getPosterUrl(movie)}
                  alt={`${movie.title} poster`}
                  width="160"
                  height="240"
                  loading="eager"
                  decoding="async"
                  className={`w-12 h-16 object-cover border border-fadedBlack/15 transition-opacity duration-200 ${
                    loadedPosters.has(movie.slug) ? "opacity-100" : "opacity-0"
                  }`}
                  onLoad={() => handlePosterLoad(movie.slug)}
                  onError={(e) => handlePosterError(e, movie.slug)}
                />
              </div>

              <div className="flex-1">
                <div className="font-dmSerifDisplay text-fadedBlack text-lg leading-tight">{movie.title}</div>
                <div className="font-dmSans text-sm text-fadedBlack/70 mt-0.5 tabular-nums">{movie.year}</div>

                {/* Dev-only ranking readout. search_movies() scores on an additive
                    ~30–170 point scale (match-type base + similarity + year +
                    popularity), so this is a raw score, not a percentage. The
                    match_type is what decides the base, so it explains the rank. */}
                {movie.matchScore != null && process.env.NODE_ENV === "development" && (
                  <div className="text-xs text-gray-500 tabular-nums">
                    Score: {Number(movie.matchScore).toFixed(1)}
                    {movie.matchType ? ` · ${movie.matchType}` : ""}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {showDropdown && !isSearching && searchResults.length === 0 && debouncedSearchQuery && (
        <div className="absolute top-full left-0 w-full mt-2 p-4 bg-background border border-fadedBlack/20" aria-live="polite">
          <p className="font-dmSans text-fadedBlack">No movies found for "{debouncedSearchQuery}"</p>
          <p className="text-sm text-fadedBlack/70 mt-1">Try checking your spelling or using different keywords</p>
        </div>
      )}

      {/* Search error message */}
      {searchError && (
        <div
          id={`${inputId}-error`}
          className="absolute top-full left-0 w-full mt-2 p-2 bg-background border border-fadedBlack/20 font-dmSans text-fadedBlack text-sm"
          role="alert"
        >
          {searchError}
        </div>
      )}
    </div>
  );
};
