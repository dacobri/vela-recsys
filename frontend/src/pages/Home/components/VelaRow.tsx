import { FC } from "react";

import MoviesSlides from "@/common/Section/MoviesSlides";
import { ForYouRow, toIMovies } from "@/services/velaApi";

/**
 * One labelled, Netflix-style row in the consumer "For You" feed. Thin wrapper
 * over the template's `MoviesSlides` so rows match the rest of the app.
 */
const VelaRow: FC<{ row: ForYouRow }> = ({ row }) => {
  if (!row.items || row.items.length === 0) return null;
  return (
    <section className="sm:py-[18px] xs:py-[16px] py-[14px]">
      <div className="mb-[18px] flex flex-row items-center justify-between">
        <div className="relative">
          <h3 className="text-primary sm:text-[22.25px] xs:text-[20px] text-[18.75px] sm:font-bold font-semibold">
            {row.title}
          </h3>
          <div className="line" />
        </div>
      </div>
      <div className="sm:h-[312px] xs:h-[309px] h-[266px]">
        <MoviesSlides movies={toIMovies(row.items)} category="movie" />
      </div>
    </section>
  );
};

/** Shimmer placeholder for a single row while the feed loads. */
export const VelaRowSkeleton: FC<{ width?: string }> = ({ width = "180px" }) => (
  <section className="sm:py-[18px] xs:py-[16px] py-[14px]">
    <div
      className="mb-[18px] h-[24px] animate-pulse rounded-md bg-surface-2/70"
      style={{ width }}
    />
    <div className="flex gap-[15px] overflow-hidden">
      {Array.from({ length: 7 }).map((_, i) => (
        <div
          key={i}
          className="h-[250px] w-[170px] shrink-0 animate-pulse rounded-lg border border-border bg-surface-2/60"
        />
      ))}
    </div>
  </section>
);

export default VelaRow;
