import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LuSearch, LuSparkles } from "react-icons/lu";

import { MoviePosterCard, BackendOfflineState } from "@/components/vela";

import { getPopular, VelaMovie } from "@/services/velaApi";
import { accentButton, inputBase, maxWidth } from "@/styles";
import { cn } from "@/utils/helper";

const PosterSkeleton = () => (
  <div className="aspect-[2/3] w-full animate-pulse rounded-xl border border-border bg-surface-2/60" />
);

/**
 * Vela-backed browse page: a searchable, genre-filterable wall of popular
 * catalog titles. Every poster links to the rich Vela detail (`/movie/:id`),
 * so the consumer browse experience is fully coherent with the rest of the app.
 */
const Browse = () => {
  const [movies, setMovies] = useState<VelaMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState<string>("All");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    getPopular(60, controller.signal)
      .then((res) => setMovies(res.items))
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setError(err?.message ?? "Could not load the catalog.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const genres = useMemo(() => {
    const set = new Set<string>();
    movies.forEach((m) => m.genres?.forEach((g) => set.add(g)));
    return ["All", ...Array.from(set).sort()];
  }, [movies]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return movies.filter((m) => {
      const matchesQuery = !q || m.title.toLowerCase().includes(q);
      const matchesGenre = genre === "All" || m.genres?.includes(genre);
      return matchesQuery && matchesGenre;
    });
  }, [movies, query, genre]);

  return (
    <div className={cn(maxWidth, "pt-28 sm:pt-32 pb-20 min-h-screen")}>
      <header className="mb-8 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-[28px] font-extrabold tracking-tight text-primary sm:text-[36px]">
            Browse the catalog
          </h1>
          <p className="max-w-[560px] text-[14.5px] leading-relaxed text-muted">
            Explore the films Vela knows. Search by title or filter by genre —
            tap any poster to dive in.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-[360px]">
            <LuSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search titles…"
              className={cn(inputBase, "w-full pl-11")}
            />
          </div>
        </div>

        {genres.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {genres.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGenre(g)}
                className={cn(
                  "vela-chip rounded-full px-3.5 py-[6px] text-[13px] font-medium text-muted",
                  g === genre && "vela-chip--active"
                )}
              >
                {g}
              </button>
            ))}
          </div>
        )}
      </header>

      {error ? (
        <BackendOfflineState detail={error} />
      ) : loading ? (
        <div className="grid grid-cols-3 gap-x-4 gap-y-7 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {Array.from({ length: 24 }).map((_, i) => (
            <PosterSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="surface-panel flex flex-col items-center gap-3 px-6 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface-2 text-accent">
            <LuSparkles />
          </span>
          <h3 className="text-[16.5px] font-semibold text-primary">
            Nothing matches that
          </h3>
          <p className="max-w-[360px] text-[13.5px] text-muted">
            Try a different title or genre — or let Vela suggest something.
          </p>
          <Link to="/welcome" className={cn(accentButton, "mt-1")}>
            <LuSparkles /> Build your taste
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-x-4 gap-y-7 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {filtered.map((movie) => (
            <MoviePosterCard key={movie.id} movie={movie} showScore={false} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Browse;
