import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { m } from "framer-motion";
import { LuHeart, LuArrowRight, LuRotateCcw } from "react-icons/lu";

import { BackendOfflineState } from "@/components/vela";
import SelectablePoster from "./SelectablePoster";

import { getPopular, VelaMovie } from "@/services/velaApi";
import {
  clearProfile,
  getProfile,
  saveProfile,
  type Rating,
} from "@/utils/profile";
import { accentButton, ghostButton, maxWidth } from "@/styles";
import { cn } from "@/utils/helper";
import logoIcon from "@/assets/svg/vela-icon.svg";

const MIN_PICKS = 5;
const GRID_SIZE = 40;

/** Poster-shaped shimmer used while the popular grid loads. */
const PosterSkeleton = () => (
  <div className="aspect-[2/3] w-full animate-pulse rounded-xl border border-border bg-surface-2/60" />
);

const Welcome = () => {
  const navigate = useNavigate();

  const [movies, setMovies] = useState<VelaMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Seed selection from any existing profile so "Refine taste" pre-checks picks.
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(getProfile().ratings.map((r) => r.id))
  );

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    getPopular(GRID_SIZE, controller.signal)
      .then((res) => setMovies(res.items))
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setError(err?.message ?? "Could not load movies.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const count = selected.size;
  const ready = count >= MIN_PICKS;
  const remaining = Math.max(0, MIN_PICKS - count);

  const ctaLabel = useMemo(() => {
    if (ready) return `See my picks (${count})`;
    if (count === 0) return `Pick ${MIN_PICKS} to continue`;
    return `Pick ${remaining} more`;
  }, [ready, count, remaining]);

  const handleContinue = () => {
    if (!ready) return;
    const ratings: Rating[] = Array.from(selected).map((id) => ({
      id,
      rating: 5,
    }));
    saveProfile(ratings);
    navigate("/");
  };

  const handleReset = () => {
    setSelected(new Set());
    clearProfile();
  };

  return (
    <>
      {/* Hero / intro */}
      <section
        className="relative w-full overflow-hidden pt-28 sm:pt-32"
        style={{
          background:
            "radial-gradient(1100px 520px at 75% -10%, rgba(242,193,78,0.12), transparent 60%), radial-gradient(800px 460px at 5% 0%, rgba(127,181,255,0.06), transparent 60%)",
        }}
      >
        <div className={cn(maxWidth, "flex flex-col items-start gap-4 pb-8")}>
          <m.img
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            src={logoIcon}
            alt="Vela"
            className="h-12 w-12 rounded-xl"
          />
          <m.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="text-[28px] font-extrabold leading-tight tracking-tight text-primary sm:text-[40px]"
          >
            Tell us what you love.
          </m.h1>
          <m.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="max-w-[560px] text-[15px] leading-relaxed text-gray-300 sm:text-[16px]"
          >
            Heart at least {MIN_PICKS} films you enjoy and Vela will build a home
            screen around your taste. You can refine it any time.
          </m.p>
        </div>
      </section>

      {/* Grid */}
      <div className={cn(maxWidth, "pb-36")}>
        {error ? (
          <BackendOfflineState detail={error} />
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
            {loading
              ? Array.from({ length: GRID_SIZE }).map((_, i) => (
                  <PosterSkeleton key={i} />
                ))
              : movies.map((movie) => (
                  <SelectablePoster
                    key={movie.id}
                    movie={movie}
                    selected={selected.has(movie.id)}
                    onToggle={toggle}
                  />
                ))}
          </div>
        )}
      </div>

      {/* Sticky CTA bar */}
      {!error && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/85 backdrop-blur-md">
          <div
            className={cn(
              maxWidth,
              "flex items-center justify-between gap-4 py-3.5 sm:py-4"
            )}
          >
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border text-[16px] transition-colors",
                  ready
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-border bg-surface-2 text-muted"
                )}
              >
                <LuHeart className={cn(count > 0 && "fill-current")} />
              </span>
              <div className="flex flex-col leading-tight">
                <span className="text-[14px] font-semibold text-primary tabular-nums">
                  {count} selected
                </span>
                <span className="hidden text-[12px] text-muted sm:block">
                  {ready
                    ? "Looking good — ready when you are."
                    : `Pick ${remaining} more to continue.`}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {count > 0 && (
                <button
                  type="button"
                  onClick={handleReset}
                  className={cn(ghostButton, "px-3 sm:px-4")}
                  title="Clear selection"
                >
                  <LuRotateCcw />
                  <span className="hidden sm:inline">Start over</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleContinue}
                disabled={!ready}
                className={accentButton}
              >
                {ctaLabel}
                {ready && <LuArrowRight />}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Welcome;
