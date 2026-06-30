import { FC, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LuChevronRight } from "react-icons/lu";

import MoviesSlides from "@/common/Section/MoviesSlides";
import { SkelatonLoader } from "@/common/Loader";
import {
  getRecommendations,
  RecMethod,
  toIMovies,
} from "@/services/velaApi";
import { IMovie } from "@/types";

interface VelaRailProps {
  title: string;
  userId: number;
  method: RecMethod;
  k?: number;
}

/**
 * A single recommendation rail on the Home page, backed by the Vela backend.
 * Renders nothing if the backend is unreachable or returns no items, so the
 * Home page degrades gracefully when the backend is offline.
 */
const VelaRail: FC<VelaRailProps> = ({ title, userId, method, k = 12 }) => {
  const [movies, setMovies] = useState<IMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);

    getRecommendations(userId, method, k, undefined, controller.signal)
      .then((res) => setMovies(toIMovies(res.items)))
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setFailed(true);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [userId, method, k]);

  // Hide the rail entirely when offline / empty.
  if (failed || (!loading && movies.length === 0)) return null;

  return (
    <section className="sm:py-[20px] xs:py-[18.75px] py-[16.75px]">
      <div className="mb-[22.75px] flex flex-row items-center justify-between">
        <div className="relative">
          <h3 className="text-primary sm:text-[22.25px] xs:text-[20px] text-[18.75px] sm:font-bold font-semibold">
            {title}
          </h3>
          <div className="line" />
        </div>
        <Link
          to="/recommend"
          className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-[13px] text-gray-300 transition-all duration-300 hover:-translate-y-1 hover:border-accent/60 hover:text-primary"
        >
          Tune <LuChevronRight className="text-[14px]" />
        </Link>
      </div>
      <div className="sm:h-[312px] xs:h-[309px] h-[266px]">
        {loading ? (
          <SkelatonLoader />
        ) : (
          <MoviesSlides movies={movies} category="movie" />
        )}
      </div>
    </section>
  );
};

export default VelaRail;
