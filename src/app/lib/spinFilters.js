// Shared, pure filter helpers used by the saved-movies page and the /spin page.
// Keeping these in one place ensures the two surfaces filter identically.

import { SEARCH_FILTERS, getLanguageLabel, normalizeLanguageCode } from "@/app/api/lib/search-filters";

// Vibe filters use the numeric mood fields on each movie.
export const VIBE_FILTERS = [
  { key: "dark", label: "Dark", field: "darknessLevel", op: ">", val: 6 },
  { key: "light", label: "Light", field: "darknessLevel", op: "<", val: 4 },
  { key: "intense", label: "Intense", field: "intensenessLevel", op: ">", val: 6 },
  { key: "chill", label: "Chill", field: "intensenessLevel", op: "<", val: 4 },
  { key: "funny", label: "Funny", field: "funninessLevel", op: ">", val: 6 },
  { key: "slow-burn", label: "Slow Burn", field: "slownessLevel", op: ">", val: 6 },
];

// Runtime buckets come from the canonical SEARCH_FILTERS so /spin and search agree.
export const DURATION_FILTERS = SEARCH_FILTERS.durations;

// A movie matches a duration bucket when its runtime falls within [min, max).
// Buckets partition cleanly: short (<100), medium (100–150), long (>=150).
function matchesDuration(duration, durationKeys) {
  if (!durationKeys || durationKeys.length === 0) return true;
  if (duration == null) return false;
  return durationKeys.some((key) => {
    const bucket = DURATION_FILTERS.find((d) => d.key === key);
    if (!bucket) return false;
    if (bucket.min != null && duration < bucket.min) return false;
    if (bucket.max != null && duration >= bucket.max) return false;
    return true;
  });
}

// Filter a list of movies by vibes, genres, languages, minimum rating, runtime
// buckets, and streaming services. All provided dimensions must match (AND);
// within genres/languages/durations/services, any selected value matches (OR).
// When serviceIds is null/empty the streaming dimension is skipped — mirrors the
// server-side filterByStreamingServices so /spin and search agree.
export function applyFilters(
  movies,
  { vibes = [], genres = [], languages = [], ratingMin = 0, durationKeys = [], serviceIds = null } = {},
) {
  const serviceIdSet = serviceIds && serviceIds.length > 0 ? new Set(serviceIds.map(Number)) : null;
  const languageSet = languages.length > 0 ? new Set(languages.map(normalizeLanguageCode)) : null;
  return movies.filter((m) => {
    // Vibe filters (all selected must match)
    for (const key of vibes) {
      const vibe = VIBE_FILTERS.find((v) => v.key === key);
      if (!vibe) continue;
      const val = m[vibe.field] ?? 5;
      if (vibe.op === ">" && !(val > vibe.val)) return false;
      if (vibe.op === "<" && !(val < vibe.val)) return false;
    }

    // Genre filter (movie must have at least one of the selected genres)
    if (genres.length > 0) {
      const movieGenres = m.genres || m.genreNames || [];
      const hasGenre = genres.some((g) => movieGenres.map((mg) => mg.toLowerCase()).includes(g.toLowerCase()));
      if (!hasGenre) return false;
    }

    // Language — a film carries one original_language code, so films still
    // missing it drop out as soon as a language is selected.
    if (languageSet && !languageSet.has(normalizeLanguageCode(m.original_language))) return false;

    // Min rating
    if (ratingMin > 0 && (m.averageRating ?? 0) < ratingMin) return false;

    // Runtime buckets
    if (!matchesDuration(m.duration, durationKeys)) return false;

    // Streaming services — movie must be available on at least one selected service.
    if (serviceIdSet) {
      const providers = m.streamingProviders || [];
      if (!providers.some((p) => serviceIdSet.has(Number(p.providerId)))) return false;
    }

    return true;
  });
}

// Collect all unique genres present across a list of movies, sorted.
export function collectGenres(movies) {
  const all = new Set();
  movies.forEach((m) => {
    (m.genres || m.genreNames || []).forEach((g) => all.add(g));
  });
  return Array.from(all).sort();
}

// Collect the languages present across a list of movies as { code, label },
// most common first, so /spin only offers languages that can actually win.
export function collectLanguages(movies) {
  const counts = new Map();
  movies.forEach((m) => {
    const code = normalizeLanguageCode(m.original_language);
    if (!code) return;
    counts.set(code, (counts.get(code) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([code, count]) => ({ code, count, label: getLanguageLabel(code) }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
