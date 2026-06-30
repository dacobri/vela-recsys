import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { m } from "framer-motion";
import { LuSparkles, LuHeart, LuArrowRight, LuFlaskConical } from "react-icons/lu";

import MoviesSlides from "@/common/Section/MoviesSlides";
import { ForYouHero, VelaRow, VelaRowSkeleton } from "./components";

import {
  getPopular,
  sessionForYou,
  toIMovies,
  type ForYouRow as ForYouRowType,
  type VelaMovie,
} from "@/services/velaApi";
import { useProfile } from "@/hooks/useProfile";
import { accentButton, ghostButton, maxWidth } from "@/styles";
import { IMovie } from "@/types";
import { cn } from "@/utils/helper";
import logoIcon from "@/assets/svg/vela-icon.svg";

// ── Branded hero for first-time / no-profile visitors ────────────────────────
const WelcomeHero = ({ hasProfile }: { hasProfile: boolean }) => (
  <section
    className="relative flex items-center lg:h-[82vh] sm:h-[600px] xs:h-[500px] h-[460px] w-full overflow-hidden"
    style={{
      background:
        "radial-gradient(1200px 600px at 72% -10%, rgba(242,193,78,0.12), transparent 60%), radial-gradient(900px 520px at 8% 110%, rgba(127,181,255,0.06), transparent 60%)",
    }}
  >
    <div className={cn(maxWidth, "flex flex-col gap-6")}>
      <m.img
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        src={logoIcon}
        alt="Vela"
        className="h-14 w-14 rounded-xl"
      />
      <m.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.05 }}
        className="max-w-[640px] text-[30px] font-extrabold leading-[1.12] tracking-tight text-primary sm:text-[48px]"
      >
        Films chosen for you, not for everyone.
      </m.h1>
      <m.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="max-w-[560px] text-[15.5px] leading-relaxed text-gray-300"
      >
        Tell Vela a handful of movies you love and it builds a home screen around
        your taste — then keeps learning as you explore.
      </m.p>
      <m.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="mt-2 flex flex-wrap gap-3"
      >
        <Link to="/welcome" className={accentButton}>
          <LuSparkles /> {hasProfile ? "Refine your taste" : "Build your taste"}
        </Link>
        <Link to="/movie" className={ghostButton}>
          Browse the catalog <LuArrowRight />
        </Link>
      </m.div>
    </div>
  </section>
);

// ── "Trending" rail from /popular (no-profile state) ─────────────────────────
const TrendingRail = () => {
  const [movies, setMovies] = useState<IMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getPopular(20, controller.signal)
      .then((res) => setMovies(toIMovies(res.items)))
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setFailed(true);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  if (failed) return null;
  if (loading) return <VelaRowSkeleton width="160px" />;
  if (movies.length === 0) return null;

  return (
    <section className="sm:py-[18px] xs:py-[16px] py-[14px]">
      <div className="mb-[18px] flex flex-row items-center justify-between">
        <div className="relative">
          <h3 className="text-primary sm:text-[22.25px] xs:text-[20px] text-[18.75px] sm:font-bold font-semibold">
            Trending now
          </h3>
          <div className="line" />
        </div>
      </div>
      <div className="sm:h-[312px] xs:h-[309px] h-[266px]">
        <MoviesSlides movies={movies} category="movie" />
      </div>
    </section>
  );
};

// ── "Refine taste" strip shown above the personalized feed ───────────────────
const RefineStrip = ({ count }: { count: number }) => (
  <div className="mb-2 flex flex-col gap-3 rounded-2xl border border-border bg-surface/60 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
        <LuHeart className="fill-current" />
      </span>
      <div className="leading-tight">
        <p className="text-[14.5px] font-semibold text-primary">
          Tuned to {count} film{count === 1 ? "" : "s"} you love
        </p>
        <p className="text-[13px] text-muted">
          Add more favourites to sharpen your recommendations.
        </p>
      </div>
    </div>
    <Link
      to="/welcome"
      className={cn(ghostButton, "shrink-0 self-start sm:self-auto")}
    >
      <LuSparkles /> Refine taste
    </Link>
  </div>
);

// ── Personalized "For You" feed ──────────────────────────────────────────────
const ForYouFeed = ({ count }: { count: number }) => {
  const { ratings } = useProfile();
  const [rows, setRows] = useState<ForYouRowType[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    sessionForYou(ratings, controller.signal)
      .then((res) => setRows(res.rows ?? []))
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setFailed(true);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
    // Re-fetch whenever the set of rated movies changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ratings.length]);

  // Headline movie for the cinematic hero = first item of the first non-empty row.
  const heroMovie: VelaMovie | undefined = rows
    .flatMap((r) => r.items)
    .find((m) => Boolean(m.backdrop_url || m.poster_url));

  if (loading) {
    return (
      <>
        <div className="h-[78vh] max-h-[760px] min-h-[460px] w-full animate-pulse bg-gradient-to-b from-surface-2/40 to-background" />
        <div className={cn(maxWidth, "lg:mt-10 mt-6")}>
          <VelaRowSkeleton width="220px" />
          <VelaRowSkeleton width="180px" />
          <VelaRowSkeleton width="200px" />
        </div>
      </>
    );
  }

  // Backend offline / empty — never crash; offer the catalog + refine instead.
  if (failed || rows.length === 0) {
    return (
      <>
        <WelcomeHero hasProfile />
        <div className={cn(maxWidth, "lg:mt-10 mt-6")}>
          <div className="surface-panel mb-6 flex flex-col items-center gap-3 px-6 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface-2 text-accent">
              <LuSparkles />
            </span>
            <h3 className="text-[16.5px] font-semibold text-primary">
              {failed
                ? "Your personalized feed is offline right now"
                : "We couldn't build a feed yet"}
            </h3>
            <p className="max-w-[440px] text-[13.5px] text-muted">
              {failed
                ? "We can't reach Vela's engine at the moment. Browse the catalog below, or refine your taste and try again."
                : "Add a few more favourites and we'll have plenty to recommend."}
            </p>
            <Link to="/welcome" className={cn(accentButton, "mt-1")}>
              <LuSparkles /> Refine your taste
            </Link>
          </div>
          <TrendingRail />
        </div>
      </>
    );
  }

  return (
    <>
      {heroMovie && <ForYouHero movie={heroMovie} />}
      <div className={cn(maxWidth, heroMovie ? "lg:mt-8 mt-5" : "lg:mt-28 mt-24")}>
        <RefineStrip count={count} />
        {rows.map((row, idx) => (
          <VelaRow key={`${row.title}-${idx}`} row={row} />
        ))}
      </div>
    </>
  );
};

// ── First-time / no-profile experience ───────────────────────────────────────
const Discover = () => (
  <>
    <WelcomeHero hasProfile={false} />
    <div className={cn(maxWidth, "lg:mt-10 mt-6")}>
      <TrendingRail />

      {/* gentle pointer to the Lab — kept understated on the consumer home */}
      <Link
        to="/recommend"
        className="surface-panel group my-8 flex items-center gap-4 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-accent/40"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-accent text-[20px]">
          <LuFlaskConical />
        </span>
        <div className="flex-1">
          <h3 className="text-[15.5px] font-semibold text-primary">
            Curious how Vela decides?
          </h3>
          <p className="text-[13.5px] text-muted">
            Step into the Lab to compare algorithms, inspect metrics, and explore
            the movie galaxy.
          </p>
        </div>
        <LuArrowRight className="shrink-0 text-muted transition-colors group-hover:text-accent" />
      </Link>
    </div>
  </>
);

const Home = () => {
  const { ratings } = useProfile();
  const count = ratings.length;

  return count > 0 ? <ForYouFeed count={count} /> : <Discover />;
};

export default Home;
