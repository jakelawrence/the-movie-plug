import { NextResponse } from "next/server";
import { DatabaseError } from "../../lib/db";
import { cache } from "../../lib/cache";
import { getMovieLanguageFacets } from "../../lib/movieRepository";
import { toPostgresDatabaseError } from "../../lib/postgres";

const CACHE_KEY = "movies:languages";

// Powers the language filter on /discover: the distinct original_language codes
// in the catalog with their film counts, most common first.
export async function GET() {
  try {
    const cached = cache.get(CACHE_KEY);
    if (cached) {
      return NextResponse.json(cached);
    }

    const languages = await getMovieLanguageFacets();
    const result = { languages };
    cache.set(CACHE_KEY, result);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Database error:", error);

    const databaseError = error instanceof DatabaseError ? error : toPostgresDatabaseError(error);
    if (databaseError) {
      return NextResponse.json({ error: databaseError.message, code: databaseError.code }, { status: 503 });
    }

    return NextResponse.json({ error: "Failed to fetch languages" }, { status: 500 });
  }
}
