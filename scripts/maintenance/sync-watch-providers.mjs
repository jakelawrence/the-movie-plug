#!/usr/bin/env node

import postgres from "postgres";
import { getDatabaseUrl } from "../lib/postgres-url.mjs";

import {
  WATCH_AVAILABILITY_TYPES,
  getArg,
  hasArg,
  mapWithConcurrency,
  normalizeWatchProviderForPostgres,
  nowIso,
  parseIntegerArg,
  parseListArg,
  writeJsonFile,
} from "../lib/script-utils.mjs";

const PROVIDER_COLUMNS = ["provider_id", "provider_name", "logo_path", "display_priority", "raw_tmdb"];
const MOVIE_PROVIDER_COLUMNS = ["movie_slug", "tmdb_id", "region", "provider_id", "availability_type", "tmdb_link", "fetched_at", "raw_tmdb"];
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/original";

function usage() {
  console.log(`
Usage:
  node scripts/maintenance/sync-watch-providers.mjs

Syncs TMDB Watch Providers data into Neon Postgres.

Each movie is written to two places from the same TMDB response:
  - movies.watch_providers      the country-keyed JSONB the app reads
  - movie_watch_providers       normalized rows for the selected --region

Options:
  --region US           Watch-provider region. Defaults to US
  --limit N             Movies to refresh in this run. Defaults to 100
  --offset N            Offset into movie list. Defaults to 0
  --movie-slugs A,B     Refresh explicit movie slugs instead of limit/offset
  --concurrency N       Concurrent TMDB movie requests. Defaults to 2
  --catalog-only        Only refresh watch_providers catalog
  --skip-catalog        Do not refresh watch_providers catalog before movies
  --dry-run             Fetch and report without writing to Postgres
  --explain             Print how each movie's providers were derived, ending
                        with the list the app will actually render. Pair with
                        --movie-slugs (or a small --limit) — it is ~1 screen
                        per movie. Combines well with --dry-run
  --report PATH         Write a JSON report. Defaults to docs/migration/phase-3-watch-provider-sync-report.json
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

async function fetchProviderCatalog(region) {
  const url = `https://api.themoviedb.org/3/watch/providers/movie?language=en-US&watch_region=${encodeURIComponent(region)}`;
  const body = await fetchTmdbJson(url);
  return Array.isArray(body.results) ? body.results : [];
}

async function upsertProviderCatalog(sql, providers, dryRun) {
  const rows = providers
    .map(normalizeWatchProviderForPostgres)
    .filter((provider) => provider.provider_id && provider.provider_name)
    .map((provider) => ({
      ...provider,
      raw_tmdb: JSON.stringify(provider.raw_tmdb),
    }));

  if (dryRun || rows.length === 0) return rows.length;

  await sql`
    insert into public.watch_providers ${sql(rows, PROVIDER_COLUMNS)}
    on conflict (provider_id) do update set
      provider_name = excluded.provider_name,
      logo_path = excluded.logo_path,
      display_priority = excluded.display_priority,
      raw_tmdb = excluded.raw_tmdb,
      updated_at = now()
  `;

  return rows.length;
}

async function initializeSyncState(sql, region, dryRun) {
  if (dryRun) return null;

  const result = await sql`
    insert into public.movie_watch_provider_sync_state (movie_slug, tmdb_id, region, status)
    select movie_slug, tmdb_id, ${region}, 'never_fetched'
    from public.movies
    where tmdb_id is not null
    on conflict (movie_slug, region) do update set
      tmdb_id = excluded.tmdb_id
  `;

  return result.count ?? result.length;
}

async function selectMovies(sql, { region, limit, offset, movieSlugs }) {
  const params = [];
  const clauses = ["tmdb_id is not null"];

  if (movieSlugs.length > 0) {
    const placeholders = movieSlugs.map((slug) => {
      params.push(slug);
      return `$${params.length}`;
    });
    clauses.push(`movie_slug in (${placeholders.join(", ")})`);
  }

  params.push(limit);
  const limitPlaceholder = `$${params.length}`;
  params.push(offset);
  const offsetPlaceholder = `$${params.length}`;

  const rows = await sql.unsafe(
    `
      select movie_slug, tmdb_id
      from public.movies
      where ${clauses.join(" and ")}
      order by movie_slug
      limit ${limitPlaceholder}
      offset ${offsetPlaceholder}
    `,
    params,
  );

  return rows.map((row) => ({
    movie_slug: row.movie_slug,
    tmdb_id: Number(row.tmdb_id),
    region,
  }));
}

async function fetchMovieAvailability(tmdbId) {
  const url = `https://api.themoviedb.org/3/movie/${tmdbId}/watch/providers`;
  return fetchTmdbJson(url);
}

function buildAvailabilityRows(movie, body, region, fetchedAt) {
  const regionPayload = body.results?.[region] ?? null;
  const rows = [];

  if (!regionPayload) {
    return {
      status: "not_available",
      tmdb_link: null,
      rows,
    };
  }

  for (const availabilityType of WATCH_AVAILABILITY_TYPES) {
    const providers = Array.isArray(regionPayload[availabilityType]) ? regionPayload[availabilityType] : [];
    for (const provider of providers) {
      const providerId = Number.parseInt(provider.provider_id, 10);
      if (!Number.isFinite(providerId)) continue;

      rows.push({
        movie_slug: movie.movie_slug,
        tmdb_id: movie.tmdb_id,
        region,
        provider_id: providerId,
        availability_type: availabilityType,
        tmdb_link: regionPayload.link ?? null,
        fetched_at: fetchedAt,
        raw_tmdb: JSON.stringify(provider),
      });
    }
  }

  return {
    status: "ok",
    tmdb_link: regionPayload.link ?? null,
    rows,
  };
}

// TMDB gives us every country in one response, so we rebuild the whole
// movies.watch_providers blob rather than patching a single region into it —
// patching would leave the other ~75 countries at whatever staleness they had.
function toJsonProvider(provider) {
  const providerId = Number.parseInt(provider.provider_id, 10);
  if (!Number.isFinite(providerId)) return null;

  const displayPriority = Number.parseInt(provider.display_priority, 10);

  return {
    providerId,
    providerName: provider.provider_name ?? null,
    logoUrl: provider.logo_path ? `${TMDB_IMAGE_BASE}${provider.logo_path}` : null,
    displayPriority: Number.isFinite(displayPriority) ? displayPriority : null,
  };
}

// Shape the app expects (movieRepository.flattenWatchProviders): country ->
// { link, flatrate[], free[], ads[], rent[], buy[] } with camelCased providers.
// Returns null when TMDB knows of no availability anywhere, matching the JSON
// null already stored for those movies.
function buildWatchProvidersJson(body) {
  const results = body.results && typeof body.results === "object" ? body.results : null;
  if (!results) return null;

  const countries = {};

  for (const [country, payload] of Object.entries(results)) {
    if (!payload || typeof payload !== "object") continue;

    const countryPayload = {};
    if (payload.link) countryPayload.link = payload.link;

    for (const availabilityType of WATCH_AVAILABILITY_TYPES) {
      const providers = Array.isArray(payload[availabilityType]) ? payload[availabilityType] : [];
      const normalized = providers.map(toJsonProvider).filter(Boolean);
      if (normalized.length === 0) continue;

      // TMDB already returns these in priority order; sort anyway so repeated
      // syncs produce byte-identical JSON.
      normalized.sort((a, b) => (a.displayPriority ?? Number.MAX_SAFE_INTEGER) - (b.displayPriority ?? Number.MAX_SAFE_INTEGER));
      countryPayload[availabilityType] = normalized;
    }

    if (Object.keys(countryPayload).length === 0) continue;
    countries[country] = countryPayload;
  }

  return Object.keys(countries).length > 0 ? countries : null;
}

// Mirrors movieRepository.flattenWatchProviders: the app de-duplicates by
// providerId and keeps the FIRST bucket a provider appears in, walking the
// buckets in WATCH_AVAILABILITY_TYPES order. That is why a title you can both
// rent and buy shows up once, tagged "rent". Also records the buckets that lost
// so --explain can show what was folded away.
//
// Kept in sync by hand with the app's WATCH_PROVIDER_BUCKETS — if that order
// changes and this does not, --explain will confidently describe the wrong UI.
function flattenForDisplay(countryPayload) {
  const winners = new Map();
  const alsoIn = new Map();

  for (const availabilityType of WATCH_AVAILABILITY_TYPES) {
    const list = Array.isArray(countryPayload?.[availabilityType]) ? countryPayload[availabilityType] : [];
    for (const provider of list) {
      if (provider?.providerId == null) continue;

      if (winners.has(provider.providerId)) {
        alsoIn.get(provider.providerId).push(availabilityType);
        continue;
      }

      winners.set(provider.providerId, { ...provider, type: availabilityType });
      alsoIn.set(provider.providerId, []);
    }
  }

  return Array.from(winners.values()).map((provider) => ({
    ...provider,
    alsoIn: alsoIn.get(provider.providerId),
  }));
}

function formatProviderRow(provider) {
  const id = String(provider.providerId).padStart(5);
  const name = (provider.providerName ?? "(unnamed)").padEnd(32).slice(0, 32);
  return { id, name };
}

// Built as one string and logged in a single call: with --concurrency > 1 the
// per-movie blocks would otherwise interleave into nonsense.
function explainMovie(movie, region, availability, dryRun) {
  const lines = [];
  const watchProviders = availability.watch_providers;
  const countries = watchProviders ? Object.keys(watchProviders) : [];
  const countryPayload = watchProviders?.[region] ?? null;
  const verb = dryRun ? "would write" : "wrote";

  lines.push("─".repeat(78));
  lines.push(`${movie.movie_slug}  (tmdb ${movie.tmdb_id}, region ${region})`);
  lines.push(`  TMDB returned availability in ${countries.length} countries`);

  if (!countryPayload) {
    lines.push(`  No ${region} entry in the response — status "${availability.status}".`);
    lines.push(
      countries.length === 0
        ? `  ${verb} movies.watch_providers = JSON null (TMDB has no availability for this film anywhere), and 0 ${region} rows.`
        : `  ${verb} movies.watch_providers with the ${countries.length} non-${region} countries, and 0 ${region} rows.`,
    );
    lines.push(`  The app will show no providers here, because it only reads watch_providers['${region}'].`);
    lines.push("");
    return lines.map((line) => line.trimEnd()).join("\n");
  }

  lines.push(`  ${region} link: ${countryPayload.link ?? "(none)"}`);
  lines.push("");
  lines.push(`  Step 1 — ${region} buckets exactly as TMDB grouped them:`);

  let bucketTotal = 0;
  for (const availabilityType of WATCH_AVAILABILITY_TYPES) {
    const list = countryPayload[availabilityType];
    if (!Array.isArray(list) || list.length === 0) continue;

    bucketTotal += list.length;
    for (const provider of list) {
      const { id, name } = formatProviderRow(provider);
      lines.push(`    ${availabilityType.padEnd(9)} ${id}  ${name}  priority ${provider.displayPriority ?? "—"}`);
    }
  }

  const flattened = flattenForDisplay(countryPayload);
  lines.push("");
  lines.push("  Step 2 — what the app renders, after de-duplicating by provider:");

  for (const provider of flattened) {
    const { id, name } = formatProviderRow(provider);
    const folded = provider.alsoIn.length > 0 ? `  <- also offered as ${provider.alsoIn.join(", ")}` : "";
    lines.push(`    ${provider.type.padEnd(9)} ${id}  ${name}${folded}`);
  }

  const foldedCount = bucketTotal - flattened.length;
  lines.push(
    `  ${flattened.length} provider${flattened.length === 1 ? "" : "s"} shown` +
      (foldedCount > 0 ? `, ${foldedCount} duplicate listing${foldedCount === 1 ? "" : "s"} folded into a higher bucket` : ""),
  );
  lines.push("");
  lines.push(`  ${verb}: movies.watch_providers = ${countries.length} countries, movie_watch_providers = ${availability.rows.length} ${region} rows`);
  lines.push("");

  return lines.map((line) => line.trimEnd()).join("\n");
}

async function updateErrorState(sql, movie, region, error, dryRun) {
  if (dryRun) return;

  await sql`
    insert into public.movie_watch_provider_sync_state
      (movie_slug, tmdb_id, region, fetched_at, status, provider_count, last_error)
    values
      (${movie.movie_slug}, ${movie.tmdb_id}, ${region}, now(), 'error', 0, ${error.message})
    on conflict (movie_slug, region) do update set
      tmdb_id = excluded.tmdb_id,
      fetched_at = excluded.fetched_at,
      status = excluded.status,
      provider_count = excluded.provider_count,
      last_error = excluded.last_error
  `;
}

async function replaceMovieAvailability(sql, movie, region, availability, dryRun) {
  if (dryRun) return;

  await sql.begin(async (tx) => {
    // ::text::jsonb, not ::jsonb — a bare ::jsonb cast makes Postgres type the
    // bind parameter as jsonb and store the payload double-encoded as a JSON
    // string. Going through text forces it to be parsed. It also means
    // JSON.stringify(null) ("null") lands as JSON null rather than SQL NULL,
    // matching how unavailable movies are already stored.
    await tx`
      update public.movies
      set watch_providers = ${JSON.stringify(availability.watch_providers)}::text::jsonb,
          updated_at = now()
      where movie_slug = ${movie.movie_slug}
    `;

    await tx`
      delete from public.movie_watch_providers
      where movie_slug = ${movie.movie_slug}
        and region = ${region}
    `;

    if (availability.rows.length > 0) {
      await tx`
        insert into public.movie_watch_providers ${tx(availability.rows, MOVIE_PROVIDER_COLUMNS)}
        on conflict (movie_slug, region, provider_id, availability_type) do update set
          tmdb_id = excluded.tmdb_id,
          tmdb_link = excluded.tmdb_link,
          fetched_at = excluded.fetched_at,
          raw_tmdb = excluded.raw_tmdb
      `;
    }

    await tx`
      insert into public.movie_watch_provider_sync_state
        (movie_slug, tmdb_id, region, fetched_at, status, provider_count, last_error)
      values
        (${movie.movie_slug}, ${movie.tmdb_id}, ${region}, ${availability.fetched_at}, ${availability.status}, ${availability.rows.length}, null)
      on conflict (movie_slug, region) do update set
        tmdb_id = excluded.tmdb_id,
        fetched_at = excluded.fetched_at,
        status = excluded.status,
        provider_count = excluded.provider_count,
        last_error = null
    `;
  });
}

async function refreshMovie(sql, movie, region, { dryRun, explain }) {
  try {
    const body = await fetchMovieAvailability(movie.tmdb_id);
    const fetchedAt = nowIso();
    const watchProviders = buildWatchProvidersJson(body);
    const availability = {
      ...buildAvailabilityRows(movie, body, region, fetchedAt),
      watch_providers: watchProviders,
      fetched_at: fetchedAt,
    };

    if (explain) {
      console.log(explainMovie(movie, region, availability, dryRun));
    }

    await replaceMovieAvailability(sql, movie, region, availability, dryRun);

    return {
      movie_slug: movie.movie_slug,
      tmdb_id: movie.tmdb_id,
      status: availability.status,
      provider_count: availability.rows.length,
      country_count: watchProviders ? Object.keys(watchProviders).length : 0,
      tmdb_link: availability.tmdb_link,
    };
  } catch (error) {
    await updateErrorState(sql, movie, region, error, dryRun);
    return {
      movie_slug: movie.movie_slug,
      tmdb_id: movie.tmdb_id,
      status: "error",
      provider_count: 0,
      country_count: 0,
      error: error.message,
    };
  }
}

async function startRun(sql, region, dryRun) {
  if (dryRun) return null;
  const rows = await sql`
    insert into public.watch_provider_sync_runs (region, status)
    values (${region}, 'running')
    returning id
  `;
  return rows[0].id;
}

async function finishRun(sql, runId, { status, moviesChecked, moviesUpdated, error }, dryRun) {
  if (dryRun || !runId) return;
  await sql`
    update public.watch_provider_sync_runs
    set finished_at = now(),
        status = ${status},
        movies_checked = ${moviesChecked},
        movies_updated = ${moviesUpdated},
        error = ${error ?? null}
    where id = ${runId}
  `;
}

async function main() {
  if (hasArg("--help")) {
    usage();
    return;
  }

  const region = getArg("--region", "US").toUpperCase();
  const limit = parseIntegerArg("--limit", 100);
  const offset = parseIntegerArg("--offset", 0);
  const movieSlugs = parseListArg("--movie-slugs", []);
  const concurrency = parseIntegerArg("--concurrency", 2);
  const catalogOnly = hasArg("--catalog-only");
  const skipCatalog = hasArg("--skip-catalog");
  const dryRun = hasArg("--dry-run");
  const explain = hasArg("--explain");
  const reportPath = getArg("--report", "docs/migration/phase-3-watch-provider-sync-report.json");

  const sql = createSql();
  let runId = null;
  let runError = null;
  let movieResults = [];
  let providerCatalogCount = null;
  let initializedSyncRows = null;

  try {
    if (!skipCatalog) {
      console.log(`Fetching TMDB watch-provider catalog for ${region}...`);
      const providers = await fetchProviderCatalog(region);
      providerCatalogCount = await upsertProviderCatalog(sql, providers, dryRun);
      console.log(`  ${dryRun ? "checked" : "upserted"} ${providerCatalogCount} providers`);
    }

    if (!catalogOnly) {
      initializedSyncRows = await initializeSyncState(sql, region, dryRun);
      if (initializedSyncRows !== null) {
        console.log(`Initialized or refreshed ${initializedSyncRows} sync-state rows`);
      }

      const movies = await selectMovies(sql, { region, limit, offset, movieSlugs });
      console.log(`Refreshing ${movies.length} movies for ${region} availability...`);

      runId = await startRun(sql, region, dryRun);
      movieResults = await mapWithConcurrency(movies, concurrency, async (movie, index) => {
        const result = await refreshMovie(sql, movie, region, { dryRun, explain });
        console.log(
          `  ${index + 1}/${movies.length} ${movie.movie_slug}: ${result.status} (${result.provider_count} ${region} rows, ${result.country_count} countries)`,
        );
        return result;
      });
    }
  } catch (error) {
    runError = error;
    throw error;
  } finally {
    const moviesUpdated = movieResults.filter((result) => result.status !== "error").length;
    await finishRun(
      sql,
      runId,
      {
        status: runError ? "error" : "finished",
        moviesChecked: movieResults.length,
        moviesUpdated,
        error: runError?.message,
      },
      dryRun,
    ).catch(() => {});

    await sql.end({ timeout: 5 }).catch(() => {});
  }

  const report = {
    generated_at: nowIso(),
    phase: "phase-3-data-migration",
    dry_run: dryRun,
    region,
    limit,
    offset,
    movie_slugs: movieSlugs,
    provider_catalog_count: providerCatalogCount,
    initialized_sync_rows: initializedSyncRows,
    movie_results: movieResults,
    summary: {
      checked: movieResults.length,
      succeeded: movieResults.filter((result) => result.status !== "error").length,
      errored: movieResults.filter((result) => result.status === "error").length,
      provider_rows: movieResults.reduce((count, result) => count + (result.provider_count || 0), 0),
      jsonb_movies_written: movieResults.filter((result) => result.status !== "error" && result.country_count > 0).length,
    },
  };
  await writeJsonFile(reportPath, report);
  console.log(`Wrote watch-provider sync report to ${reportPath}`);
}

main().catch((error) => {
  console.error(`Phase 3 watch-provider sync failed: ${error.message}`);
  process.exit(1);
});
