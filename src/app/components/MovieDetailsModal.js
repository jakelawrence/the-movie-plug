import React, { useEffect } from "react";
import { RemoveScroll } from "react-remove-scroll";
import { X, Bookmark, BookmarkCheck, ArrowRight } from "lucide-react";

// A labelled grid of streaming-provider logos. Shared between the "your services"
// and "also available" groups so both render identically.
function ProviderGroup({ label, providers }) {
  return (
    <div>
      <p className="font-dmSans text-[9px] uppercase tracking-[0.22em] opacity-35 mb-3">{label}</p>
      <div className="flex flex-wrap gap-x-3 gap-y-4">
        {providers.map((p) => (
          <div key={p.providerId} className="flex flex-col items-center gap-1.5 w-14">
            {p.logoUrl ? (
              <img
                src={p.logoUrl}
                alt={p.providerName || "Streaming provider"}
                width="48"
                height="48"
                className="w-12 h-12 object-cover border border-fadedBlack/10 flex-shrink-0"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="w-12 h-12 border border-fadedBlack/10 bg-fadedBlack/5 flex-shrink-0" />
            )}
            <span className="font-dmSans text-[9px] text-fadedBlack/50 text-center leading-tight line-clamp-2 w-full">
              {p.providerName}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// `onExplore` is optional on purpose: /discover and /spin render this component
// too and must show no explore action. Only /search passes it.
export function MovieDetailsModal({ movie, onClose, onToggleSave, isSaved, canSave, myServiceIds = [], onExplore }) {
  // Escape closes. Declared above the early return so the hook order is stable,
  // and no-ops while closed so there's no stray listener on the document.
  useEffect(() => {
    if (!movie) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [movie, onClose]);

  if (!movie) return null;

  // Show every streaming site the movie is available on. The data layer already
  // de-duplicates by providerId and orders by availability priority (flatrate
  // first), so we render the list as-is.
  const visibleProviders = movie.streamingProviders ?? [];

  // Split providers into the ones the user subscribes to and the rest, so we can
  // surface "Available On Your Services" first. Provider IDs come from a JSON
  // blob on the movie and an int column on the user, so coerce both to Number
  // before comparing.
  const mine = new Set(myServiceIds.map(Number));
  const yourProviders = visibleProviders.filter((p) => mine.has(Number(p.providerId)));
  const otherProviders = visibleProviders.filter((p) => !mine.has(Number(p.providerId)));

  return (
    <RemoveScroll>
      <div
        className="fixed inset-0 bg-fadedBlack/50 flex items-end sm:items-center justify-center z-[300] backdrop-blur-sm cursor-pointer sm:p-6"
        onClick={onClose}
      >
        <div
          className="bg-background w-full sm:max-w-lg max-h-[88dvh] sm:max-h-full flex flex-col border-t sm:border border-fadedBlack/10 animate-slide-up"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Fixed header — always on-screen, never scrolls away */}
          <div className="flex-shrink-0 bg-background border-b border-fadedBlack/10 px-6 py-4 flex items-center justify-between">
            <p className="font-dmSans text-[9px] uppercase tracking-[0.25em] opacity-40">About This Film</p>
            <button
              onClick={onClose}
              className="relative text-fadedBlack/30 hover:text-fadedBlack transition-colors p-1 before:absolute before:content-[''] before:-inset-3"
              aria-label="Close"
            >
              <X size={18} strokeWidth={1.5} />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 pt-7 pb-[calc(1.75rem+env(safe-area-inset-bottom))] space-y-6">
            {/* Title + tagline */}
            <div>
              <h2 className="font-dmSerifDisplay text-2xl sm:text-3xl text-fadedBlack leading-tight">
                {movie.title?.replace(/\u00A0/g, " ")}
              </h2>
              {movie.tagline && (
                <p className="font-dmSans font-light text-xs text-fadedBlack/45 mt-2 italic border-l border-fadedBlack/15 pl-2.5">
                  {movie.tagline}
                </p>
              )}
            </div>

            {/* Stats — inline, no boxes */}
            <div className="flex gap-8">
              <div>
                <p className="font-dmSans text-[9px] uppercase tracking-[0.22em] opacity-35 mb-1">Year</p>
                <p className="font-dmSans font-black text-fadedBlack text-base">{movie.year || "—"}</p>
              </div>
              <div>
                <p className="font-dmSans text-[9px] uppercase tracking-[0.22em] opacity-35 mb-1">Runtime</p>
                <p className="font-dmSans font-black text-fadedBlack text-base">
                  {movie.duration ? `${movie.duration}m` : "—"}
                </p>
              </div>
              <div>
                <p className="font-dmSans text-[9px] uppercase tracking-[0.22em] opacity-35 mb-1">Rating</p>
                <p className="font-dmSans font-black text-fadedBlack text-base">
                  {movie.averageRating ? movie.averageRating.toFixed(1) : "—"}
                </p>
              </div>
            </div>

            {/* Vibe meters */}
            {[
              { label: "Darkness", val: movie.darknessLevel },
              { label: "Intensity", val: movie.intensenessLevel },
              { label: "Funniness", val: movie.funninessLevel },
              { label: "Slow Burn", val: movie.slownessLevel },
            ].some(({ val }) => val != null) && (
              <div className="border-t border-fadedBlack/10 pt-5">
                <p className="font-dmSans text-[9px] uppercase tracking-[0.22em] opacity-35 mb-4">Tone &amp; Mood</p>
                <div className="space-y-3">
                  {[
                    { label: "Darkness", val: movie.darknessLevel },
                    { label: "Intensity", val: movie.intensenessLevel },
                    { label: "Funniness", val: movie.funninessLevel },
                    { label: "Slow Burn", val: movie.slownessLevel },
                  ].map(
                    ({ label, val }) =>
                      val != null && (
                        <div key={label} className="flex items-center gap-4">
                          <span className="font-dmSans text-[9px] uppercase tracking-[0.08em] opacity-40 w-[60px]">
                            {label}
                          </span>
                          <div className="flex-1 h-[5px] bg-fadedBlack/8 rounded-none">
                            <div
                              className="h-full bg-fadedBlack/40 transition-all"
                              style={{ width: `${(val / 10) * 100}%` }}
                            />
                          </div>
                          <span className="font-dmSans text-[9px] w-5 text-right text-fadedBlack/40">{val}</span>
                        </div>
                      )
                  )}
                </div>
              </div>
            )}

            {/* Genre + Director */}
            <div className="border-t border-fadedBlack/10 pt-5 space-y-4">
              {(movie.genres?.length > 0 || movie.genreNames?.length > 0) && (
                <div>
                  <p className="font-dmSans text-[9px] uppercase tracking-[0.22em] opacity-35 mb-1">Genre</p>
                  <p className="font-dmSans font-bold text-fadedBlack text-sm">
                    {(movie.genres || movie.genreNames).join(", ")}
                  </p>
                </div>
              )}
              {movie.director && (
                <div>
                  <p className="font-dmSans text-[9px] uppercase tracking-[0.22em] opacity-35 mb-1">Director</p>
                  <p className="font-dmSans font-bold text-fadedBlack text-sm">{movie.director}</p>
                </div>
              )}
            </div>

            {/* Streaming */}
            {visibleProviders.length > 0 && (
              <div className="border-t border-fadedBlack/10 pt-5 space-y-5">
                {yourProviders.length > 0 ? (
                  <>
                    <ProviderGroup label="Available On Your Services" providers={yourProviders} />
                    {otherProviders.length > 0 && <ProviderGroup label="Also Available On" providers={otherProviders} />}
                  </>
                ) : (
                  <ProviderGroup label="Available On" providers={otherProviders} />
                )}
                <p className="font-dmSans text-[8px] uppercase tracking-[0.18em] opacity-30">Streaming data provided by JustWatch</p>
              </div>
            )}

            {/* Save button */}
            <button
              onClick={onToggleSave}
              disabled={!canSave}
              className={`w-full py-3.5 font-dmSans font-black text-[10px] uppercase tracking-[0.12em] border transition-colors flex items-center justify-center gap-2 ${
                !canSave
                  ? "bg-fadedBlack/5 text-fadedBlack/30 border-fadedBlack/15 cursor-not-allowed"
                  : isSaved
                    ? "bg-fadedBlack text-background border-fadedBlack hover:bg-background hover:text-fadedBlack"
                    : "bg-fadedBlack text-background border-fadedBlack hover:bg-fadedBlue hover:border-fadedBlue"
              }`}
            >
              {isSaved ? <BookmarkCheck size={14} strokeWidth={2.5} /> : <Bookmark size={14} strokeWidth={2.5} />}
              {isSaved ? "Remove from Saved" : "Save to My Movies"}
            </button>
            {!canSave && (
              <p className="font-dmSans text-fadedBlack/40 text-[10px] uppercase tracking-wide text-center">
                Sign in to save movies.
              </p>
            )}

            {onExplore && (
              <button
                onClick={onExplore}
                className="w-full py-3.5 font-dmSans text-[10px] uppercase tracking-[0.12em] bg-background text-fadedBlack border border-fadedBlack/15 hover:bg-backgroundSecondary transition-colors flex items-center justify-center gap-2"
              >
                Explore This Film
                <ArrowRight size={14} strokeWidth={2} />
              </button>
            )}
          </div>
        </div>
      </div>
    </RemoveScroll>
  );
}
