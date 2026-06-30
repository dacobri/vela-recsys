import { FC } from "react";
import { m } from "framer-motion";
import { LuHeart } from "react-icons/lu";

import Image from "@/common/Image";
import { VelaMovie } from "@/services/velaApi";
import { cn, imageUrl } from "@/utils/helper";

interface SelectablePosterProps {
  movie: VelaMovie;
  selected: boolean;
  onToggle: (id: number) => void;
}

/**
 * A poster tile used in onboarding: tap/click to heart-toggle it into the taste
 * profile. Selected tiles get a gold ring, a filled heart, and a subtle lift.
 */
const SelectablePoster: FC<SelectablePosterProps> = ({
  movie,
  selected,
  onToggle,
}) => (
  <m.button
    type="button"
    layout
    onClick={() => onToggle(movie.id)}
    aria-pressed={selected}
    aria-label={`${selected ? "Remove" : "Add"} ${movie.title} ${
      selected ? "from" : "to"
    } your taste`}
    className={cn(
      "group relative block aspect-[2/3] w-full overflow-hidden rounded-xl border bg-surface text-left transition-all duration-300",
      selected
        ? "border-accent ring-2 ring-accent/70 shadow-glow"
        : "border-border hover:-translate-y-1 hover:border-accent/40"
    )}
  >
    <Image
      width="100%"
      height="100%"
      src={imageUrl(movie.poster_url)}
      alt={movie.title}
      effect="zoomIn"
      className={cn(
        "h-full w-full object-cover transition-all duration-500",
        selected ? "scale-105" : "group-hover:scale-105"
      )}
    />

    {/* legibility gradient */}
    <span
      className={cn(
        "pointer-events-none absolute inset-0 bg-gradient-to-t from-background/90 via-background/10 to-transparent transition-opacity duration-300",
        selected ? "opacity-90" : "opacity-70 group-hover:opacity-90"
      )}
    />

    {/* heart badge */}
    <span
      className={cn(
        "absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur-sm transition-all duration-300",
        selected
          ? "border-accent bg-accent text-accent-text"
          : "border-border bg-background/70 text-muted group-hover:border-accent/60 group-hover:text-accent"
      )}
    >
      <LuHeart className={cn(selected && "fill-current")} />
    </span>

    {/* title + year */}
    <span className="absolute inset-x-0 bottom-0 p-2.5">
      <span className="line-clamp-2 text-[12.5px] font-medium leading-tight text-primary">
        {movie.title}
      </span>
      {movie.year && (
        <span className="mt-0.5 block text-[11px] text-muted">{movie.year}</span>
      )}
    </span>
  </m.button>
);

export default SelectablePoster;
