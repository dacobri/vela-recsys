import { FC, useState } from "react";
import { Link } from "react-router-dom";
import { m, AnimatePresence } from "framer-motion";
import { LuInfo, LuStar } from "react-icons/lu";

import Image from "@/common/Image";
import { VelaMovie } from "@/services/velaApi";
import { cn, imageUrl } from "@/utils/helper";

interface MoviePosterCardProps {
  movie: VelaMovie;
  /** show the ranking score badge. */
  showScore?: boolean;
  /** rank index (1-based) to display as a chip. */
  rank?: number;
  className?: string;
}

/**
 * Rich poster card for recommendation grids: poster, title, year, optional score
 * badge and a click-to-reveal "reason" popover. Links to the TMDB detail page
 * by movie id (`/movie/{id}`).
 */
const MoviePosterCard: FC<MoviePosterCardProps> = ({
  movie,
  showScore = true,
  rank,
  className,
}) => {
  const [showReason, setShowReason] = useState(false);
  const hasScore =
    showScore && typeof movie.score === "number" && !Number.isNaN(movie.score);

  return (
    <div className={cn("group relative w-full", className)}>
      <div className="relative overflow-hidden rounded-xl border border-border bg-surface aspect-[2/3]">
        <Link to={`/movie/${movie.id}`} aria-label={movie.title}>
          <Image
            width="100%"
            height="100%"
            src={imageUrl(movie.poster_url)}
            alt={movie.title}
            effect="zoomIn"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent opacity-80" />
        </Link>

        {typeof rank === "number" && (
          <div className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-background/80 text-[13px] font-bold text-accent ring-1 ring-border">
            {rank}
          </div>
        )}

        {hasScore && (
          <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-accent px-2 py-[2px] text-[11px] font-bold text-accent-text shadow-glow">
            <LuStar className="text-[10px]" />
            {movie.score!.toFixed(2)}
          </div>
        )}

        {movie.reason && (
          <>
            <button
              type="button"
              aria-label="Why this recommendation?"
              onClick={() => setShowReason((p) => !p)}
              className={cn(
                "absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/80 text-accent transition-all duration-300 hover:bg-accent hover:text-accent-text",
                showReason && "bg-accent text-accent-text"
              )}
            >
              <LuInfo />
            </button>
            <AnimatePresence>
              {showReason && (
                <m.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-x-2 bottom-12 z-10 rounded-lg border border-border bg-surface-2/95 p-3 text-left shadow-xl backdrop-blur-sm"
                >
                  <p className="text-[12px] leading-snug text-gray-200">
                    <span className="font-semibold text-accent">Why: </span>
                    {movie.reason}
                  </p>
                </m.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      <div className="mt-2 px-[2px]">
        <Link
          to={`/movie/${movie.id}`}
          className="line-clamp-1 text-[14px] font-medium text-gray-100 transition-colors hover:text-accent"
          title={movie.title}
        >
          {movie.title}
        </Link>
        <div className="mt-[2px] flex items-center gap-2 text-[12px] text-muted">
          {movie.year && <span>{movie.year}</span>}
          {movie.genres?.length > 0 && (
            <span className="line-clamp-1">{movie.genres.slice(0, 2).join(" · ")}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default MoviePosterCard;
