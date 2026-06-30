import { FC } from "react";
import { Link } from "react-router-dom";
import { m } from "framer-motion";
import { LuPlay, LuInfo, LuHeart } from "react-icons/lu";

import { VelaMovie } from "@/services/velaApi";
import { maxWidth } from "@/styles";
import { cn, imageUrl } from "@/utils/helper";

interface ForYouHeroProps {
  /** the headline movie — usually the first item of the first "For You" row. */
  movie: VelaMovie;
  /** small eyebrow above the title, e.g. "Top pick for you". */
  eyebrow?: string;
}

/**
 * Cinematic, single-title hero for the personalized consumer home. Uses the
 * movie's `backdrop_url` (falling back to its poster) behind a dark gradient,
 * with a couple of friendly CTAs — no algorithm jargon.
 */
const ForYouHero: FC<ForYouHeroProps> = ({
  movie,
  eyebrow = "Top pick for you",
}) => {
  const bg = imageUrl(movie.backdrop_url || movie.poster_url);

  return (
    <section className="relative h-[78vh] max-h-[760px] min-h-[460px] w-full overflow-hidden">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url('${bg}')` }}
      />
      {/* gradients for legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/20" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/40 to-transparent" />

      <div
        className={cn(
          maxWidth,
          "relative flex h-full max-w-[1140px] flex-col justify-end pb-14 sm:justify-center sm:pb-0"
        )}
      >
        <m.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex max-w-[620px] flex-col gap-4"
        >
          <span className="flex items-center gap-2 text-[12.5px] font-semibold uppercase tracking-[0.18em] text-accent">
            <LuHeart className="fill-current text-[13px]" />
            {eyebrow}
          </span>

          <h1 className="text-[32px] font-extrabold leading-[1.1] tracking-tight text-primary sm:text-[52px]">
            {movie.title}
          </h1>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-gray-300">
            {movie.year && <span>{movie.year}</span>}
            {movie.genres?.length > 0 && (
              <>
                <span className="text-muted">•</span>
                <span>{movie.genres.slice(0, 3).join(" · ")}</span>
              </>
            )}
          </div>

          {movie.overview && (
            <p className="max-w-[540px] text-[14.5px] leading-relaxed text-gray-200 line-clamp-3 sm:text-[15.5px]">
              {movie.overview}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Link
              to={`/movie/${movie.id}`}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-[10px] text-[15px] font-semibold text-accent-text shadow-glow transition-all duration-300 hover:-translate-y-[2px] active:translate-y-[1px]"
            >
              <LuPlay className="fill-current" /> View
            </Link>
            <Link
              to={`/movie/${movie.id}`}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background/40 px-6 py-[10px] text-[15px] font-medium text-gray-100 backdrop-blur-sm transition-all duration-300 hover:border-accent/60 hover:text-primary"
            >
              <LuInfo /> More info
            </Link>
          </div>
        </m.div>
      </div>
    </section>
  );
};

export default ForYouHero;
