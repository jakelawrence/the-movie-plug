export const SEARCH_FILTERS = {
  genres: [
    "Action",
    "Adventure",
    "Animation",
    "Comedy",
    "Crime",
    "Documentary",
    "Drama",
    "Family",
    "Fantasy",
    "History",
    "Horror",
    "Music",
    "Mystery",
    "Romance",
    "Science Fiction",
    "Thriller",
    "War",
    "Western",
  ],
  vibes: [
    { key: "dark", label: "Dark", field: "darknessLevel", op: ">", val: 6 },
    { key: "light", label: "Light", field: "darknessLevel", op: "<", val: 4 },
    { key: "intense", label: "Intense", field: "intensenessLevel", op: ">", val: 6 },
    { key: "chill", label: "Chill", field: "intensenessLevel", op: "<", val: 4 },
    { key: "funny", label: "Funny", field: "funninessLevel", op: ">", val: 6 },
    { key: "slow-burn", label: "Slow Burn", field: "slownessLevel", op: ">", val: 6 },
    { key: "fast-pace", label: "Fast Paced", field: "slownessLevel", op: "<", val: 4 },
  ],
  durations: [
    { key: "short", label: "Short  < 100m", max: 100 },
    { key: "medium", label: "Medium  100–150m", min: 100, max: 150 },
    { key: "long", label: "Long   > 150m", min: 150 },
  ],
  decades: [
    { key: "2020s", label: "2020s", min: 2020 },
    { key: "2010s", label: "2010s", min: 2010, max: 2019 },
    { key: "2000s", label: "2000s", min: 2000, max: 2009 },
    { key: "1990s", label: "1990s", min: 1990, max: 1999 },
    { key: "1980s", label: "1980s", min: 1980, max: 1989 },
    { key: "classic", label: "Classic  pre‑1980", max: 1979 },
  ],
};

// Language filters key off movies.original_language, which TMDB fills with a
// single ISO 639-1 code per film. Intl.DisplayNames covers nearly all of them,
// so we only spell out the ones it gets wrong: TMDB deviates from the standard
// by using "cn" for Cantonese (the standard has no code for it), which leaves
// "zh" meaning Mandarin specifically.
const LANGUAGE_LABEL_OVERRIDES = {
  cn: "Cantonese",
  zh: "Mandarin",
  xx: "No Dialogue",
};

let languageDisplayNames = null;

export function normalizeLanguageCode(code) {
  return String(code || "")
    .trim()
    .toLowerCase();
}

export function getLanguageLabel(code) {
  const normalized = normalizeLanguageCode(code);
  if (!normalized) return "";
  if (LANGUAGE_LABEL_OVERRIDES[normalized]) return LANGUAGE_LABEL_OVERRIDES[normalized];

  try {
    languageDisplayNames = languageDisplayNames || new Intl.DisplayNames(["en"], { type: "language" });
    const label = languageDisplayNames.of(normalized);
    // Intl echoes the code back when it has no data for it — fall through then.
    if (label && label.toLowerCase() !== normalized) return label;
  } catch {
    // Structurally invalid code. Show it raw rather than crashing the filter.
  }

  return normalized.toUpperCase();
}
