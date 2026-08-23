#!/usr/bin/env node

import postgres from "postgres";
import { getDatabaseUrl } from "../lib/postgres-url.mjs";

import { getArg, hasArg, mapWithConcurrency, nowIso, parseIntegerArg, parseListArg, writeJsonFile } from "../lib/script-utils.mjs";

const TMDB_MOVIE_DETAILS_URL = "https://api.themoviedb.org/3/movie";

function usage() {
  console.log(`
Usage:
  node scripts/maintenance/sync-tmdb-languages.mjs

Fetches TMDB movie details for movies with tmdb_id and updates
public.movies.original_language from the returned original_language code.

That column powers the language filter on /discover and /spin. Movies without a
tmdb_id cannot be resolved here — run scripts/maintenance/audit-tmdb-ids.mjs
first to give them one.

Options:
  --limit N             Movies to refresh in this run. Defaults to 100
  --offset N            Offset into movie list. Defaults to 0
  --movie-slugs A,B     Refresh explicit movie slugs instead of limit/offset
  --concurrency N       Concurrent TMDB requests. Defaults to 2
  --only-missing        Only update rows where original_language is null or empty
  --dry-run             Fetch and report without writing to Postgres
  --report PATH         Write a JSON report. Defaults to docs/migration/tmdb-language-sync-report.json
  --help                Show this help
`);
}

function createSql() {
  return postgres(getDatabaseUrl({ direct: true }), {
    ssl: "require",
    prepare: false,
  });
}

function tmdbHeaders() {
  if (!process.env.TMDB_AUTH_TOKEN) {
    throw new Error("TMDB_AUTH_TOKEN is not set");
  }

  return {
    Authorization: `Bearer ${process.env.TMDB_AUTH_TOKEN}`,
    Accept: "application/json",
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchTmdbJson(url, { maxRetries = 5 } = {}) {
  let attempt = 0;

  while (true) {
    attempt += 1;
    const response = await fetch(url, { headers: tmdbHeaders() });

    if (response.ok) {
      return response.json();
    }

    const retryAfterSeconds = Number.parseInt(response.headers.get("retry-after") || "", 10);
    const shouldRetry = response.status === 429 || response.status >= 500;
    if (!shouldRetry || attempt > maxRetries) {
      const text = await response.text().catch(() => "");
      throw new Error(`TMDB returned ${response.status} for ${url}${text ? `: ${text.slice(0, 200)}` : ""}`);
    }

    const backoffMs = Number.isFinite(retryAfterSeconds) ? retryAfterSeconds * 1000 : Math.min(30000, 1000 * 2 ** (attempt - 1));
    await sleep(backoffMs);
  }
}

// TMDB returns a single ISO 639-1 code (lowercase, occasionally with stray
// whitespace). "xx" is TMDB's marker for a film with no dialogue — a real value
// worth storing, not a gap, so it is kept as-is.
function normalizeLanguageCode(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

async function selectMovies(sql, { limit, offset, movieSlugs, onlyMissing }) {
  const params = [];
  const clauses = ["tmdb_id is not null"];

  if (movieSlugs.length > 0) {
    const placeholders = movieSlugs.map((slug) => {
      params.push(slug);
      return `$${params.length}`;
    });
    clauses.push(`movie_slug in (${placeholders.join(", ")})`);
  }

  if (onlyMissing) {
    clauses.push(`(original_language is null or original_language = '')`);
  }

  params.push(limit);
  const limitPlaceholder = `$${params.length}`;
  params.push(offset);
  const offsetPlaceholder = `$${params.length}`;

  return sql.unsafe(
    `
      select movie_slug, title, tmdb_id, original_language
      from public.movies
      where ${clauses.join(" and ")}
      order by movie_slug
      limit ${limitPlaceholder}
      offset ${offsetPlaceholder}
    `,
    params,
  );
}

async function fetchMovieLanguage(movie) {
  const url = `${TMDB_MOVIE_DETAILS_URL}/${movie.tmdb_id}?language=en-US`;
  const body = await fetchTmdbJson(url);
  const originalLanguage = normalizeLanguageCode(body.original_language);

  return {
    movie_slug: movie.movie_slug,
    title: movie.title,
    tmdb_id: Number(movie.tmdb_id),
    previous_original_language: movie.original_language,
    original_language: originalLanguage,
    status: originalLanguage ? "ok" : "missing_original_language",
  };
}

async function updateMovieLanguage(sql, result, dryRun) {
  if (dryRun || result.status !== "ok" || result.previous_original_language === result.original_language) {
    return;
  }

  await sql`
    update public.movies
    set original_language = ${result.original_language},
        updated_at = now()
    where movie_slug = ${result.movie_slug}
  `;
}

async function refreshMovie(sql, movie, options) {
  try {
    const result = await fetchMovieLanguage(movie);
    await updateMovieLanguage(sql, result, options.dryRun);
    return result;
  } catch (error) {
    return {
      movie_slug: movie.movie_slug,
      title: movie.title,
      tmdb_id: Number(movie.tmdb_id),
      previous_original_language: movie.original_language,
      status: "error",
      error: error.message,
    };
  }
}

async function main() {
  if (hasArg("--help")) {
    usage();
    return;
  }

  const limit = parseIntegerArg("--limit", 100);
  const offset = parseIntegerArg("--offset", 0);
  const movieSlugs = parseListArg("--movie-slugs", []);
  const concurrency = parseIntegerArg("--concurrency", 2);
  const onlyMissing = hasArg("--only-missing");
  const dryRun = hasArg("--dry-run");
  const reportPath = getArg("--report", "docs/migration/tmdb-language-sync-report.json");

  const sql = createSql();
  let results = [];
  let unresolvableCount = 0;

  try {
    // Reported rather than fixed: filling these needs a tmdb_id first, which is
    // audit-tmdb-ids.mjs's job.
    const unresolvable = await sql`
      select count(*)::int as count
      from public.movies
      where tmdb_id is null
        and (original_language is null or original_language = '')
    `;
    unresolvableCount = Number(unresolvable[0]?.count || 0);

    const movies = await selectMovies(sql, { limit, offset, movieSlugs, onlyMissing });
    console.log(`Refreshing TMDB languages for ${movies.length} movies...`);

    results = await mapWithConcurrency(movies, concurrency, async (movie, index) => {
      const result = await refreshMovie(sql, movie, { dryRun });
      const changed = result.status === "ok" && result.previous_original_language !== result.original_language;
      console.log(
        `  ${index + 1}/${movies.length} ${movie.movie_slug}: ${result.status}` +
          (changed ? ` ${result.previous_original_language ?? "(none)"} -> ${result.original_language}` : ""),
      );
      return result;
    });

    if (unresolvableCount > 0) {
      console.log(
        `\n${unresolvableCount} movie${unresolvableCount === 1 ? " has" : "s have"} no tmdb_id and no language. ` +
          `Run scripts/maintenance/audit-tmdb-ids.mjs to resolve their IDs, then re-run with --only-missing.`,
      );
    }
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }

  const report = {
    generated_at: nowIso(),
    phase: "tmdb-language-sync",
    dry_run: dryRun,
    limit,
    offset,
    movie_slugs: movieSlugs,
    only_missing: onlyMissing,
    summary: {
      checked: results.length,
      succeeded: results.filter((result) => result.status === "ok").length,
      missing_original_language: results.filter((result) => result.status === "missing_original_language").length,
      errored: results.filter((result) => result.status === "error").length,
      changed: results.filter((result) => result.status === "ok" && result.previous_original_language !== result.original_language).length,
      unresolvable_without_tmdb_id: unresolvableCount,
    },
    movie_results: results,
  };

  await writeJsonFile(reportPath, report);
  console.log(`Wrote TMDB language sync report to ${reportPath}`);
}

main().catch((error) => {
  console.error(`TMDB language sync failed: ${error.message}`);
  process.exit(1);
});
