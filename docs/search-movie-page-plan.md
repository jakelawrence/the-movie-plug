# Movie Search Page — Implementation Plan

A new `/search` page where the user looks up a specific film, sees its poster and
high-level details (the same information the spin page reveals after a spin), saves
it to their movies, and browses films that are similar to it.

## Decisions (locked)

| Decision | Choice |
| --- | --- |
| Route | `/search`, with the focused film in `?movie=<slug>` |
| Home page search bar | Re-routed from `/discover?movie=X&fromSearch=true` → `/search?movie=X` |
| Clicking a similar film | Opens `MovieDetailsModal`, which gains an "explore this film" action that navigates to `/search?movie=<that slug>` |
| Filters on similar films | None — the ranked list as returned, with a client-side "show more" |

## Page anatomy

```text
┌──────────────────────────────────────────────┐
│ Navbar                                       │
├──────────────────────────────────────────────┤
│ look up a film                     (h1)      │
│ [ Search for movies...                  🔍 ] │
├──────────────────────────────────────────────┤
│  ▓▓▓▓▓▓                                      │
│  ▓▓▓▓▓▓    PARASITE                          │
│  ▓▓▓▓▓▓    2019 · 132m · ★ 4.6               │
│  ▓▓▓▓▓▓    Dark  Intense  Slow Burn          │
│  ▓▓▓▓▓▓    Bong Joon-ho · Thriller, Drama    │
│  ▓▓▓▓▓▓    [ Save to My Movies ] [ Details ] │
├──────────────────────────────────────────────┤
│ MORE LIKE THIS                               │
│ ▓▓▓  ▓▓▓  ▓▓▓  ▓▓▓                           │
│ ▓▓▓  ▓▓▓  ▓▓▓  ▓▓▓                           │
│              [ show more ]                   │
└──────────────────────────────────────────────┘
```

---

## Existing pieces this builds on

Everything needed already exists. No new API routes, no schema changes.

### `GET /api/movies?slug=<slug>&limit=1`

`src/app/api/movies/route.js:83` — direct primary-key lookup, no scan. Returns

```json
{ "movies": [ { "slug": "...", "title": "...", "year": 1999, "duration": 132,
                "averageRating": 4.6, "director": "...", "genres": [...],
                "posterUrl": "...", "darknessLevel": 8, "intensenessLevel": 7,
                "funninessLevel": 3, "slownessLevel": 5, "tagline": "...",
                "streamingProviders": [...] } ],
  "total": 1, "page": 1, "limit": 1, "hasMore": false }
```

A miss returns `{ "movies": [], "total": 0 }` with a **200**, not a 404 — the page
must treat the empty array as "not found" itself.

### `POST /api/suggestions`

`src/app/api/suggestions/route.js:170`. Body for our use:

```json
{ "mode": "collaborative", "inputSlugs": ["<focused-slug>"] }
```

Returns `{ recommendations: [...up to 50 hydrated movies...], userInteractions, ... }`.
Each recommendation carries `recommendationScore`, `recommendationRank`, and
`isBookmarkedByUser`. Server-side embedding results are cached for 5 minutes keyed
on the seed slug (`embedding:<slug>:250`), so revisiting a film is cheap.

### `GET` / `POST` / `DELETE /api/user/saved-movies`

`src/app/api/user/saved-movies/route.js`. `POST`/`DELETE` take `{ movieSlug }` and
read the username from the session — `/discover` also sends `username` in the body
(`src/app/discover/page.js:550`) but the route ignores it. All three return 401 when
signed out. `GET` returns fully hydrated saved movies.

### `GET /api/user/streaming-services`

Returns `{ streamingServices: [<providerId>, ...] }`. Feeds `myServiceIds` on
`MovieDetailsModal` so it can group providers under "Available On Your Services".

### Components

- `SearchBar` (`src/app/components/SearchBar.js`) — the home-page search. Currently
  used **only** by `src/app/page.js:89`, so it is safe to extend.
- `MovieDetailsModal` (`src/app/components/MovieDetailsModal.js`) — already used by
  `/discover` and `/spin`. Has an uncommitted z-index/padding fix in the working tree.
- `SpinResult` (`src/app/components/spin/SpinResult.jsx`) — the visual reference for
  the focused-film panel (poster, title, meta row, vibe badges, action row).
- `ResultCard` (`src/app/discover/page.js:277`) — the visual reference for the
  similar-films grid card.
- Design tokens: `background`, `backgroundSecondary`, `fadedBlack`, `fadedBlue`,
  `danger`; fonts `dmSerifDisplay`, `dmSans`, `bigShouldersDisplay`.

---

## Gotchas found while reading the code

These are the things most likely to cost time if not planned for.

1. **The focused film is never in its own similar list.**
   `getMultiSeedEmbeddingRecommendations` excludes seeds from their own results
   (`src/app/api/lib/movieRepository.js:592`). So `isBookmarkedByUser` — which the
   suggestions route attaches to recommendations — will **never** tell us whether the
   focused film is saved. Its saved state must be resolved from a separate
   `GET /api/user/saved-movies` call. This is Phase 4's core problem.

2. **`/api/suggestions` computes a rate limit but never enforces it.**
   `route.js:177-180` calls `checkRateLimit` and only `console.log`s the result; no
   429 is ever returned. The anonymous budget in config is 8/day. Re-routing home
   search here means one POST per focused film, so volume rises. Behavior is
   unchanged by this feature and enforcement stays **out of scope** — noted so it is a
   deliberate choice rather than an oversight.

3. **The rate-limit key is wrong for signed-in users.** It reads an `x-user-id`
   request header (`route.js:174`) that no client sends, so every user falls back to
   the anonymous IP bucket. Also out of scope; noted for the same reason.

4. **`useSearchParams()` needs a Suspense boundary.** `/discover` uses it without one
   (`src/app/discover/page.js:410`). The new page will wrap its searchParams consumer
   in `<Suspense>` so the production build can prerender the shell cleanly.

5. **`SearchBar` never closes on outside click** and never clears after a selection.
   On the home page it navigates away immediately, so neither is visible. On `/search`
   the user stays put, so both become real bugs. Phase 2 fixes them.

6. **Poster URL sizes.** Use `getPosterUrl(movie, "large")` from
   `src/app/utils/posters.js` for the big poster and the grid cards; it swaps the
   Letterboxd thumbnail dimensions and falls back to `/placeholder-poster.svg` for
   missing or `empty-poster-*` URLs. `SpinResult` has its own local `upsize()` that
   handles only one of the two size patterns and has no fallback — do not copy it.

7. **Middleware does not protect `/search`** (`src/middleware.js` matcher covers
   `/home`, `/profile`, `/scenario`). Signed-out users can browse the page; only
   saving requires auth. This is what we want.

---

## Phase 1 — Route scaffold and URL state

**Goal:** `/search` renders, reads and writes `?movie=<slug>`, and shows an empty
state. No data fetching yet.

### Files

- **New** `src/app/search/page.js`

### Work

1. Create the page as a client component. Split it in two so `useSearchParams` sits
   behind a Suspense boundary:

   ```jsx
   "use client";
   import { Suspense } from "react";
   // ...
   export default function SearchPage() {
     return (
       <Suspense fallback={<SearchPageFallback />}>
         <SearchPageInner />
       </Suspense>
     );
   }
   ```

   `SearchPageFallback` renders the Navbar plus a centered `<Loading />` so the shell
   never flashes empty.

2. In `SearchPageInner`:

   ```jsx
   const router = useRouter();
   const searchParams = useSearchParams();
   const slug = searchParams.get("movie");
   const [isLoaded, setIsLoaded] = useState(false);
   useEffect(() => setIsLoaded(true), []);
   ```

3. Selecting a film pushes the URL rather than setting local state — the URL is the
   single source of truth for "which film is focused":

   ```jsx
   const focusMovie = useCallback(
     (movie) => router.push(`/search?movie=${encodeURIComponent(movie.slug)}`),
     [router],
   );
   ```

   Use `push`, not `replace`, so the browser back button walks back through the chain
   of films the user explored (this is what makes the Phase 6 "explore" link feel right).

4. Page chrome, matching `/spin` and `/discover`:

   ```jsx
   <div className="min-h-screen bg-background pb-24">
     <Navbar isLoaded={isLoaded} currentPage="search" />
     <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8">
       <h1 className="font-dmSerifDisplay text-fadedBlack text-4xl sm:text-5xl leading-[0.95]">
         look up a film
       </h1>
       {/* search bar slot (Phase 2) */}
       {/* focused film slot (Phase 3) */}
       {/* similar films slot (Phase 5) */}
     </div>
   </div>
   ```

   Header uses the same `transition-all duration-700` + `opacity/translate-y` entrance
   pattern as `src/app/spin/page.js:167`.

5. Empty state when `slug` is null — editorial, not a box:

   ```jsx
   <div className="border-t border-fadedBlack/10 py-24 text-center">
     <h3 className="font-dmSerifDisplay text-fadedBlack text-3xl leading-tight mb-3">
       search a title
     </h3>
     <p className="font-dmSans text-fadedBlack/70 text-sm max-w-xs mx-auto leading-relaxed">
       Find a film to see its details and what else is like it.
     </p>
   </div>
   ```

6. Add the navbar entry in `src/app/components/Navbar.js`: a `search` button in the
   desktop link row (before `discover`), and `"search"` at the front of the mobile
   drawer array on line 127 — the drawer already does `router.push(`/${page}`)`, so the
   label and the route line up with no other change.

### Acceptance

- `/search` renders with the empty state; no console errors.
- `/search?movie=parasite-2019` renders the same shell (data lands in Phase 3).
- `npm run build` succeeds — specifically, no "useSearchParams should be wrapped in a
  suspense boundary" error.
- Navbar `search` link is present on desktop and in the mobile drawer, and dims when
  active.

---

## Phase 2 — Wire up the search bar

**Goal:** the same search bar as the home page, reused, behaving correctly on a page
the user does not navigate away from. Home page search re-routed to `/search`.

### Files

- **Modify** `src/app/components/SearchBar.js`
- **Modify** `src/app/search/page.js`

### Work

1. Add an optional `onSelectMovie` prop, keeping the current navigation as the default
   so the home page needs no behavioral change beyond the new destination:

   ```jsx
   export const SearchBar = ({ disabled, onSelectMovie, autoFocus = false }) => {
     // ...
     const handleSearchMovie = (movie) => {
       setSearchQuery("");
       setDebouncedSearchQuery("");
       setSearchResults([]);
       setShowDropdown(false);
       if (onSelectMovie) {
         onSelectMovie(movie);
         return;
       }
       router.push(`/search?movie=${encodeURIComponent(movie.slug)}`);
     };
   ```

   This replaces `src/app/components/SearchBar.js:99-102`. The `/discover` destination
   and the `fromSearch=true` flag are dropped from this component.

2. Close the dropdown on outside click — port the handler from `MovieSearchInput`
   (`src/app/discover/page.js:67-75`), which already guards against both the input and
   the dropdown:

   ```jsx
   useEffect(() => {
     const handler = (e) => {
       if (!dropdownRef.current?.contains(e.target) && !searchInputRef.current?.contains(e.target)) {
         setShowDropdown(false);
       }
     };
     document.addEventListener("mousedown", handler);
     return () => document.removeEventListener("mousedown", handler);
   }, []);
   ```

3. Close on `Escape` from the input, and re-open the dropdown on focus when results
   are already in state.

4. Make the `handleFocus` `scrollIntoView` opt-in. It exists for the home page, where
   the search sits low in a tall hero; on `/search` the input is already near the top
   and scrolling on focus is disorienting. Gate it behind a
   `scrollIntoViewOnFocus = false` prop and pass `true` from the home page to preserve
   today's behavior exactly.

5. In `src/app/search/page.js`, render it above the focused film:

   ```jsx
   <div className="mt-8 max-w-xl">
     <SearchBar onSelectMovie={focusMovie} />
   </div>
   ```

6. Leave `/discover` untouched. Its `?movie=&fromSearch=true` handling
   (`src/app/discover/page.js:611-638`) still works for existing links and for its own
   login `returnTo` round-trip — only the home page stops pointing at it.

### Acceptance

- Home page search selects a film → lands on `/search?movie=<slug>`.
- On `/search`, selecting a film swaps the focused film without a full page reload;
  the input clears and the dropdown closes.
- Clicking outside the dropdown closes it; `Escape` closes it.
- Home page focus-scroll behavior is unchanged.
- Existing `/discover?movie=X&fromSearch=true` links still auto-search.

---

## Phase 3 — Focused film panel

**Goal:** poster and high-level details for `?movie=<slug>`, at the level of detail
the spin result shows.

### Files

- **New** `src/app/components/search/FocusedMovie.jsx`
- **Modify** `src/app/search/page.js`

### Work

1. Fetch on slug change, aborting in-flight requests so fast successive searches can't
   land out of order:

   ```jsx
   const [movie, setMovie] = useState(null);
   const [movieState, setMovieState] = useState("idle"); // idle | loading | ready | missing | error

   useEffect(() => {
     if (!slug) { setMovie(null); setMovieState("idle"); return; }
     const controller = new AbortController();
     setMovieState("loading");
     setMovie(null);
     (async () => {
       try {
         const res = await fetch(`/api/movies?slug=${encodeURIComponent(slug)}&limit=1`,
                                 { signal: controller.signal });
         if (!res.ok) throw new Error("lookup failed");
         const data = await res.json();
         const found = data.movies?.[0];
         if (!found) { setMovieState("missing"); return; }   // 200 + empty array
         setMovie(found);
         setMovieState("ready");
       } catch (err) {
         if (err.name === "AbortError") return;
         setMovieState("error");
       }
     })();
     return () => controller.abort();
   }, [slug]);
   ```

2. `FocusedMovie.jsx` — a horizontal editorial layout: poster left, details right on
   `sm+`; stacked and centered on mobile. Content, mirroring `SpinResult`:

   - Poster — `getPosterUrl(movie, "large")`, `aspect-[2/3]`,
     `border border-fadedBlack/10`, `w-44 sm:w-56`. Track an `onLoad` flag and fade in
     over an `animate-pulse` placeholder, as `ResultCard` does
     (`src/app/discover/page.js:296-310`).
   - Title — `font-dmSerifDisplay text-4xl sm:text-5xl leading-[0.95]`, with
     `movie.title?.replace(/ /g, " ")` (the modal already does this — the data has
     non-breaking spaces in it).
   - Tagline, if present — italic, `border-l border-fadedBlack/15 pl-2.5`, as in
     `MovieDetailsModal:81-85`.
   - Meta row — year · runtime · ★ rating, `·` separators at `text-fadedBlack/25`,
     `tabular-nums`, each part rendered only when non-null.
   - Vibe badges — lift the `VibeBadges` block from `SpinResult.jsx:12-23` (Dark,
     Light, Intense, Funny, Slow Burn), left-aligned instead of centered.
   - Director and genres — `font-dmSans text-sm text-fadedBlack/70`; genres from
     `movie.genres || movie.genreNames` (both spellings appear in the data).
   - Actions — `Save to My Movies` (Phase 4) and a secondary `Details` button opening
     `MovieDetailsModal` for the focused film, reusing the button styling from
     `SpinResult.jsx:94-107`.

3. States:

   - `loading` — centered `<Loading />` in a `min-h-[420px]` block, so the similar
     section below does not jump when the panel resolves.
   - `missing` — "we don't have that film" heading, plus a line inviting another
     search. Keep the search bar mounted above it.
   - `error` — "something went wrong" with a `Try again` button that refetches.

4. Add an entrance transition on the panel keyed by slug (`key={slug}`) so swapping
   films fades the new one in rather than mutating in place. Respect
   `prefers-reduced-motion` the way `SpinResult.jsx:28` does — fade only, no
   translate/scale.

### Acceptance

- `/search?movie=<valid-slug>` shows poster, title, year, runtime, rating, badges,
  director, genres.
- `/search?movie=not-a-real-slug` shows the "missing" state, not a crash or a spinner
  that never resolves.
- Typing a new film in the search bar swaps the panel; rapid selections settle on the
  last one chosen.
- Reduced-motion users get no translate/scale.

---

## Phase 4 — Save the focused film

**Goal:** save/unsave from the panel, with correct initial state and a sane signed-out
path.

### Files

- **Modify** `src/app/search/page.js`
- **Modify** `src/app/components/search/FocusedMovie.jsx`

### Work

1. Load the user's saved slugs once per session, not per film. Because of Gotcha 1 the
   suggestions response cannot answer this for the focused film:

   ```jsx
   const { user } = useAuth();
   const [savedSlugs, setSavedSlugs] = useState(new Set());

   useEffect(() => {
     if (!user?.username) { setSavedSlugs(new Set()); return; }
     let cancelled = false;
     (async () => {
       try {
         const res = await fetch("/api/user/saved-movies");
         if (!res.ok) return;
         const data = await res.json();
         if (!cancelled) setSavedSlugs(new Set((data.savedMovies || []).map((m) => m.slug)));
       } catch (err) {
         console.error("Failed to load saved movies:", err);
       }
     })();
     return () => { cancelled = true; };
   }, [user?.username]);
   ```

   Note this endpoint hydrates every saved movie in full to return slugs we then throw
   away. Acceptable at current library sizes and it matches what `/spin` already does.
   If it becomes slow, the clean fix is a `?slugsOnly=true` branch on the GET handler
   that skips the `getMovies()` hydration — deliberately **not** in this plan's scope.

2. Load streaming services once, same pattern as `src/app/discover/page.js:446-465`,
   into `myServiceIds` for the modal.

3. Toggle handler with an optimistic update and rollback on failure — the panel is the
   page's primary action, so a silently-failing button is worse here than on a grid:

   ```jsx
   const handleToggleSave = async (target) => {
     if (!target) return;
     if (!user?.username) {
       const returnTo = `/search?movie=${encodeURIComponent(target.slug)}`;
       router.push(`/login?returnTo=${encodeURIComponent(returnTo)}`);
       return;
     }
     const wasSaved = savedSlugs.has(target.slug);
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
       setSavedSlugs((prev) => {           // roll back
         const next = new Set(prev);
         wasSaved ? next.add(target.slug) : next.delete(target.slug);
         return next;
       });
       setSaveError("Couldn't update your saved movies. Try again.");
     }
   };
   ```

   `/login` reads `returnTo` and passes it as the Google `callbackUrl`
   (`src/app/login/page.js:38-43`), so the user comes back to the film they were on.

4. Button in `FocusedMovie` — primary weight, mirroring `MovieDetailsModal:178-191`:
   `Bookmark` / `Save to My Movies` when unsaved, `BookmarkCheck` /
   `Remove from Saved` when saved. Signed out, keep it enabled (it routes to login)
   with a quiet `Sign in to save` line beneath, rather than the modal's disabled
   treatment — a dead primary button on this page is a worse first impression.

5. Render `saveError` as a small `text-danger` line under the button with
   `role="alert"`. Clear it on the next successful toggle.

### Acceptance

- Signed in, on a film already in saved movies: the button reads "Remove from Saved"
  on first paint, without a flash of the wrong label once `savedSlugs` resolves
  (render the button in a neutral pending state until the saved-slugs fetch settles).
- Save → the film appears in `/profile/saved-movies` and in the `/spin` pool.
- Unsave → it disappears from both.
- Signed out → clicking Save goes to `/login?returnTo=/search?movie=<slug>`, and after
  signing in the user is returned to that film.
- A forced network failure reverts the button and shows the error line.

---

## Phase 5 — Similar films

**Goal:** the ranked similar-films grid under the focused film.

### Files

- **New** `src/app/components/search/SimilarMovies.jsx`
- **New** `src/app/components/search/SimilarMovieCard.jsx`
- **Modify** `src/app/search/page.js`

### Work

1. Fetch alongside the focused film — the two requests are independent, so fire them
   in parallel rather than chaining; the panel should not wait on the recommender.

   ```jsx
   const [similar, setSimilar] = useState([]);
   const [similarState, setSimilarState] = useState("idle");

   useEffect(() => {
     if (!slug) { setSimilar([]); setSimilarState("idle"); return; }
     const controller = new AbortController();
     setSimilarState("loading");
     setSimilar([]);
     setVisibleCount(12);
     (async () => {
       try {
         const res = await fetch("/api/suggestions", {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({ mode: "collaborative", inputSlugs: [slug] }),
           signal: controller.signal,
         });
         if (!res.ok) throw new Error("suggestions failed");
         const data = await res.json();
         setSimilar(data.recommendations || []);
         setSimilarState("ready");
       } catch (err) {
         if (err.name === "AbortError") return;
         setSimilarState("error");
       }
     })();
     return () => controller.abort();
   }, [slug]);
   ```

   Per the locked decision, no filter keys are sent — the route defaults `genres: []`,
   `vibes: []`, `duration: null`, `decade: null`, `minRating: 0`,
   `filterStreamingServices: false` (`src/app/api/suggestions/route.js:183-194`), so an
   omitted field is already the "no filter" case.

2. **Seed the saved set from the response.** Recommendations *do* carry
   `isBookmarkedByUser`, so merge those slugs into `savedSlugs` when the response
   lands. This keeps the grid and the modal in sync for signed-in users even before the
   `GET /api/user/saved-movies` call resolves. Merge — never replace — so the focused
   film's state (which is never in this list) is not clobbered.

3. `SimilarMovies.jsx` — section header and grid:

   ```jsx
   <section className="border-t border-fadedBlack/10 mt-16 pt-10">
     <p className="font-dmSans text-[9px] uppercase tracking-[0.22em] text-fadedBlack/70 mb-6">
       More Like This
     </p>
     <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
       {movies.slice(0, visibleCount).map((m) => (
         <SimilarMovieCard key={m.slug} movie={m} onOpen={() => onOpen(m)} />
       ))}
     </div>
   </section>
   ```

4. Show 12 initially. The route returns up to 50 already hydrated
   (`route.js:334`), so "show more" is a pure client-side reveal in steps of 12 — no
   extra request. Hide the button once everything is visible.

5. `SimilarMovieCard.jsx` — modelled on `ResultCard` (`src/app/discover/page.js:277`)
   but trimmed: poster with fade-in, title, and a `year · runtime · ★ rating` line.
   The whole card is one `<button>` that opens the modal, so no nested-interactive
   problem and keyboard activation comes free — this is cleaner than `ResultCard`'s
   `role="button"` div with a manual `onKeyDown`. No hover bookmark overlay: saving a
   similar film happens in the modal, per the locked decision.

6. States:

   - `loading` — a skeleton grid of 12 `aspect-[2/3]` `bg-fadedBlack/5 animate-pulse`
     tiles, so the page height is stable while the embedding query runs.
   - empty (`ready` with zero results) — "nothing similar yet" in the same quiet
     editorial voice; realistic for films lacking embeddings.
   - `error` — one line plus a `Try again` button that refires the request. Keep this
     failure scoped to the section: a recommender outage must not take down the
     focused film panel above it.

### Acceptance

- A focused film shows a grid of similar films that does **not** include itself.
- "Show more" reveals the rest with no network request; it disappears at the end of
  the list.
- The focused-film panel renders even when `/api/suggestions` fails.
- Revisiting a film within 5 minutes returns fast (server cache hit — visible as
  `Cache hit: embedding:<slug>:250` in the server log).
- A film with no embedding coverage shows the empty state, not a permanent spinner.

---

## Phase 6 — Details modal and the explore chain

**Goal:** clicking a similar film opens `MovieDetailsModal`; the modal gains an
action that makes that film the new focus.

### Files

- **Modify** `src/app/components/MovieDetailsModal.js`
- **Modify** `src/app/search/page.js`

### Work

1. Add an optional `onExplore` prop to `MovieDetailsModal`. It must stay optional —
   `/discover` (`src/app/discover/page.js:842`) and `/spin`
   (`src/app/spin/page.js:252`) both render this component and must be unaffected.

   ```jsx
   export function MovieDetailsModal({ movie, onClose, onToggleSave, isSaved, canSave,
                                       myServiceIds = [], onExplore }) {
   ```

2. Render a secondary action directly under the existing Save button
   (`MovieDetailsModal.js:191`), only when `onExplore` is supplied:

   ```jsx
   {onExplore && (
     <button
       onClick={onExplore}
       className="w-full py-3.5 font-dmSans text-[10px] uppercase tracking-[0.12em]
                  bg-background text-fadedBlack border border-fadedBlack/15
                  hover:bg-backgroundSecondary transition-colors flex items-center justify-center gap-2"
     >
       Explore This Film
       <ArrowRight size={14} strokeWidth={2} />
     </button>
   )}
   ```

   `ArrowRight` from `lucide-react`, alongside the existing `X`/`Bookmark` imports.

3. Wire it on the search page:

   ```jsx
   <MovieDetailsModal
     movie={selectedMovie}
     onClose={() => setSelectedMovie(null)}
     onToggleSave={() => handleToggleSave(selectedMovie)}
     isSaved={selectedMovie ? savedSlugs.has(selectedMovie.slug) : false}
     canSave={!!user?.username}
     myServiceIds={myServiceIds}
     onExplore={() => { setSelectedMovie(null); focusMovie(selectedMovie); }}
   />
   ```

   Close first, then navigate — otherwise `RemoveScroll` unmounts mid-navigation and
   can leave `overflow: hidden` on `<body>`.

4. The focused film's own `Details` button (Phase 3) opens the same modal with
   `onExplore` omitted — it is already the focused film.

5. After `focusMovie`, scroll to the top of the panel. The user clicked from a grid
   partway down the page; landing them mid-page on the new film is disorienting. Use
   `scrollIntoView({ behavior: "smooth", block: "start" })` on the panel, guarded by
   `prefers-reduced-motion` → `behavior: "auto"`.

### Acceptance

- Clicking any similar film opens the modal with title, stats, tone meters, providers.
- Saving from the modal updates that card's state and persists to saved movies.
- "Explore This Film" closes the modal, swaps the focused film, updates the URL, and
  scrolls to the panel; the new film gets its own similar list.
- Browser back returns to the previous film in the chain.
- Body scroll is never left locked after navigating from the modal.
- `/discover` and `/spin` modals show **no** explore button and behave exactly as before.

---

## Phase 7 — Polish, accessibility, and QA

### Work

1. **Announce results.** Wrap the focused-film heading region in
   `role="status" aria-live="polite"` so screen-reader users hear the film change when
   they pick from the dropdown — the visual change is off-screen from the input.
2. **Focus management.** After selecting from the search bar, move focus to the
   focused-film panel (`tabIndex={-1}` + `.focus()`), the pattern `SpinResult.jsx:34`
   already uses.
3. **Modal focus trap.** `MovieDetailsModal` has no `Escape` handler or focus trap
   today. Add `Escape`-to-close in this phase — it is a small, shared win. A full focus
   trap is a larger change across three call sites; note it as follow-up rather than
   doing it here.
4. **Alt text and labels.** Poster `alt={`${movie.title} poster`}`; the grid card
   button gets `aria-label={`View details for ${movie.title}`}`.
5. **Tap targets.** Grid cards and the show-more button at ≥44px on touch.
6. **Long titles.** Verify a very long title wraps in the panel and clamps to two lines
   on the card (`line-clamp-2`) without pushing the meta row out of the card.
7. **Missing data.** Every field on the panel is conditional — a film with no runtime,
   rating, director, tagline, or genres must render a clean panel with no stray
   separators or empty labels.
8. **Missing poster.** Confirm `getPosterUrl` falls back for both null and
   `empty-poster-*` URLs, in the panel and the grid.

### Manual QA checklist

| # | Scenario | Expected |
| --- | --- | --- |
| 1 | Home → search → select film | Lands on `/search?movie=<slug>`, panel + similar render |
| 2 | Direct-load `/search?movie=<slug>` | Same as above, no flash of empty state |
| 3 | Direct-load `/search` | Empty state, search bar focusable |
| 4 | Bad slug | "Missing" state, search bar still usable |
| 5 | Signed out, click Save | `/login?returnTo=...`; after sign-in, back on the same film |
| 6 | Signed in, save then reload | Button reads "Remove from Saved" on first paint |
| 7 | Unsave, then open `/profile/saved-movies` | Film is gone |
| 8 | Click a similar film | Modal opens with full details |
| 9 | Save from the modal | Persists; card state stays in sync after closing |
| 10 | Explore from the modal | New film focused, URL updated, scrolled to panel |
| 11 | Back button after exploring twice | Walks back through both films |
| 12 | Show more | Reveals the rest, no request, button disappears at the end |
| 13 | Offline / throttled `/api/suggestions` | Panel still renders; section shows its own error |
| 14 | Rapid successive searches | Settles on the last selection, no stale panel |
| 15 | Mobile 375px | Panel stacks, grid is 2-up, modal is a bottom sheet |
| 16 | Reduced motion | No translate/scale entrances, instant scroll |
| 17 | Keyboard only | Tab to search, arrow/enter through results, reach and operate Save, open and Escape the modal |
| 18 | `/discover` and `/spin` regression | Unchanged: modals have no explore button, discover deep links still auto-search |

---

## Out of scope (deliberate)

- **Enforcing the `/api/suggestions` rate limit** and fixing its `x-user-id` key
  (Gotchas 2 and 3). Both are pre-existing; changing them would alter behavior for
  `/discover` too and belongs in its own change.
- **Per-film SEO metadata.** `/search` is a client component with the film in a query
  param, so it gets the app-level Open Graph tags. Real per-film metadata needs a
  server component and a path segment — a different route shape than the one chosen.
- **A `?slugsOnly=true` variant of `GET /api/user/saved-movies`** (Phase 4 note).
- **De-duplicating the three near-identical movie cards** (`ResultCard` in
  `/discover`, `MovieCard` in `/profile/saved-movies`, and the new `SimilarMovieCard`).
  Worth doing, but folding it in would put a refactor of two shipped pages inside a
  new-feature change.
- **A focus trap in `MovieDetailsModal`** (Phase 7, item 3) — `Escape`-to-close is
  included; the full trap is follow-up.

## File summary

**New**

- `src/app/search/page.js`
- `src/app/components/search/FocusedMovie.jsx`
- `src/app/components/search/SimilarMovies.jsx`
- `src/app/components/search/SimilarMovieCard.jsx`

**Modified**

- `src/app/components/SearchBar.js` — `onSelectMovie` prop, clear-on-select,
  outside-click and Escape close, opt-in focus scroll, `/search` destination
- `src/app/components/MovieDetailsModal.js` — optional `onExplore` action,
  Escape-to-close
- `src/app/components/Navbar.js` — `search` link, desktop and mobile

**Unchanged**

- All API routes, `src/app/discover/page.js`, `src/app/spin/page.js`,
  `src/middleware.js`, database schema
