import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { m } from "framer-motion";
import { LuHeart, LuArrowLeft, LuSparkles } from "react-icons/lu";

import Image from "@/common/Image";
import MoviesSlides from "@/common/Section/MoviesSlides";
import { Loader } from "@/common";
import { BackendOfflineState, PanelState } from "@/components/vela";

import {
  getMovie,
  getSimilar,
  toIMovies,
  type VelaMovie,
} from "@/services/velaApi";
import { useProfile } from "@/hooks/useProfile";
import { toggleInProfile } from "@/utils/profile";
import { accentButton, ghostButton, maxWidth } from "@/styles";
import { cn, imageUrl } from "@/utils/helper";

/** "Rate / add to my taste" heart toggle, wired to the localStorage profile. */
const TasteToggle = ({ movie }: { movie: VelaMovie }) => {
  const { ratings } = useProfile();
  const saved = ratings.some((r) => r.id === movie.id);

  return (
    <button
      type="button"
      onClick={() => toggleInProfile(movie.id)}
      aria-pressed={saved}
      className={cn(
        saved ? ghostButton : accentButton,
        saved && "border-accent/60 text-primary"
      )}
    >
      <LuHeart className={cn(saved && "fill-accent text-accent")} />
      {saved ? "In your taste" : "Add to my taste"}
    </button>
  );
};

/** "More like this" rail from GET /movies/{id}/similar. */
const SimilarRail = ({ id }: { id: number }) => {
  const [items, setItems] = useState<VelaMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    getSimilar(id, 14, controller.signal)
      .then((res) => setItems(res.items ?? []))
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setFailed(true);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [id]);

  if (failed) return null;

  return (
    <section className="sm:py-[18px] py-[14px]">
      <div className="mb-[18px] relative">
        <h3 className="text-primary sm:text-[22.25px] xs:text-[20px] text-[18.75px] sm:font-bold font-semibold">
          More like this
        </h3>
        <div className="line" />
      </div>
      <div className="sm:h-[312px] xs:h-[309px] h-[266px]">
        {loading ? (
          <div className="flex gap-[15px] overflow-hidden">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="h-[250px] w-[170px] shrink-0 animate-pulse rounded-lg border border-border bg-surface-2/60"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-[14px] text-muted">
            No similar titles to show yet.
          </p>
        ) : (
          <MoviesSlides movies={toIMovies(items)} category="movie" />
        )}
      </div>
    </section>
  );
};

const MovieDetail = () => {
  const { id } = useParams();
  const movieId = Number(id);

  const [movie, setMovie] = useState<VelaMovie | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(movieId)) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setNotFound(false);
    setExpanded(false);
    getMovie(movieId, controller.signal)
      .then(setMovie)
      .catch((err) => {
        if (err?.name === "AbortError") return;
        if (err?.status === 404) setNotFound(true);
        else setError(err?.message ?? "Something went wrong.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [movieId]);

  useEffect(() => {
    document.title = movie ? `${movie.title} — Vela` : "Vela";
    return () => {
      document.title = "Vela — your personal map of cinema";
    };
  }, [movie]);

  if (loading) return <Loader />;

  if (notFound) {
    return (
      <div className={cn(maxWidth, "pt-32 pb-20 min-h-screen")}>
        <PanelState
          title="We couldn't find that title"
          message="It may not be in Vela's catalog. Head back home and keep exploring."
          action={
            <Link to="/" className={accentButton}>
              Back to home
            </Link>
          }
        />
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className={cn(maxWidth, "pt-32 pb-20 min-h-screen")}>
        <BackendOfflineState detail={error ?? undefined} />
      </div>
    );
  }

  const backdrop = imageUrl(movie.backdrop_url || movie.poster_url);
  const longOverview = (movie.overview?.length ?? 0) > 320;

  return (
    <>
      {/* Backdrop hero */}
      <section className="relative w-full overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url('${backdrop}')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/85 to-background/40" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/85 via-background/30 to-transparent" />

        <div
          className={cn(
            maxWidth,
            "relative flex flex-col gap-8 pt-28 pb-10 sm:pt-36 sm:pb-14 md:flex-row md:gap-12"
          )}
        >
          {/* poster */}
          <m.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="hidden w-[230px] shrink-0 md:block"
          >
            <div className="aspect-[2/3] overflow-hidden rounded-2xl border border-border shadow-xl">
              <Image
                width="100%"
                height="100%"
                src={imageUrl(movie.poster_url)}
                alt={movie.title}
                effect="zoomIn"
                className="h-full w-full object-cover"
              />
            </div>
          </m.div>

          {/* meta */}
          <m.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="flex max-w-[620px] flex-col gap-4"
          >
            <Link
              to="/"
              className="inline-flex w-fit items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-primary"
            >
              <LuArrowLeft /> Back
            </Link>

            <h1 className="text-[30px] font-extrabold leading-[1.1] tracking-tight text-primary sm:text-[44px]">
              {movie.title}
            </h1>

            <div className="flex flex-wrap items-center gap-2">
              {movie.year && (
                <span className="text-[14px] text-muted">{movie.year}</span>
              )}
              {movie.genres?.map((g) => (
                <span
                  key={g}
                  className="rounded-full border border-border bg-surface/70 px-3 py-[3px] text-[12px] text-muted"
                >
                  {g}
                </span>
              ))}
            </div>

            {movie.overview && (
              <p className="text-[15px] leading-relaxed text-primary">
                {longOverview && !expanded
                  ? `${movie.overview.slice(0, 320)}… `
                  : movie.overview}
                {longOverview && (
                  <button
                    type="button"
                    onClick={() => setExpanded((p) => !p)}
                    className="ml-1 font-semibold text-accent hover:underline"
                  >
                    {expanded ? "show less" : "show more"}
                  </button>
                )}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <TasteToggle movie={movie} />
              <Link to="/chat" className={cn(ghostButton)}>
                <LuSparkles /> Ask Vela for similar moods
              </Link>
            </div>
          </m.div>
        </div>
      </section>

      {/* More like this */}
      <div className={cn(maxWidth, "pb-16")}>
        <SimilarRail id={movieId} />
      </div>
    </>
  );
};

export default MovieDetail;
